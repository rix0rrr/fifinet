import { Edge, Graph, UserEdge, UserVertex, Vertex } from './graph';
import { gotoVertex, makeGremlin, MaybeGremlin } from './gremlin';
import { filterEdges, objectFilter } from './util';

export type Piperesult<V, E> = 'done' | 'pull' | MaybeGremlin<V, E>;

export interface IPipe<V, E> {
  step(graph: Graph<V, E>, gremlin: MaybeGremlin<V, E>): Piperesult<V, E>;
}

export class VertexSource<V, E> implements IPipe<V, E> {
  private vertices?: Array<Vertex<V, E>>;

  constructor(private readonly pattern?: string | string[] | Partial<UserVertex<V>>) {
  }

  public step(graph: Graph<V, E>, gremlin: MaybeGremlin<V, E>): Piperesult<V, E> {
    if (!this.vertices) {
      this.vertices = graph.findVertices(this.pattern).filter(notUndefined);
    }

    if (!this.vertices.length) {
      return 'done';
    }

    // FIXME: Only works if vertices have been cloned
    var vertex = this.vertices.pop()!;
    return makeGremlin(vertex, gremlin?.state);
  }
}

export class SimpleTraversal<V, E> implements IPipe<V, E> {
  private edges?: Array<Edge<V, E>>;
  private gremlin: MaybeGremlin<V, E>;

  constructor(private readonly dir: 'in' | 'out', private readonly edgeFilter?: string | string[] | Partial<UserEdge<E>>) {
  }

  public step(graph: Graph<V, E>, gremlin: MaybeGremlin<V, E>): Piperesult<V, E> {
    var find_method: 'findInEdges' | 'findOutEdges' = this.dir == 'out' ? 'findOutEdges' : 'findInEdges'
    var edge_list: '_in' | '_out' = this.dir == 'out' ? '_in' : '_out'

    if(!gremlin && (!this.edges || !this.edges.length)) {
      return 'pull';
    };

    if(!this.edges || !this.edges.length) {                     // state initialization
      if (!gremlin) {
        throw new Error('OOPS gremlin expected');
      }

      this.gremlin = gremlin;
      // FIXME: this copying ain't great either
      this.edges = graph[find_method](gremlin.vertex)            // get edges that match our query
                        .filter(filterEdges(this.edgeFilter));
    }

    if(!this.edges.length) {
      return 'pull';
    };

    const vertex = this.edges.pop()![edge_list];                   // use up an edge
    return gotoVertex(this.gremlin!, vertex);
  }
}

export class PropertyPipe<V, E> implements IPipe<V, E> {
  constructor(private readonly property: keyof V) {
  }

  public step(graph: Graph<V, E>, gremlin: MaybeGremlin<V, E>): Piperesult<V, E> {
    if(!gremlin) return 'pull';
    gremlin.result = gremlin.vertex[this.property];
    return gremlin.result == null ? undefined : gremlin;
  }
}

export class UniquePipe<V, E> implements IPipe<V, E> {
  private readonly seen = new Set<string>();

  public step(graph: Graph<V, E>, gremlin: MaybeGremlin<V, E>): Piperesult<V, E> {
    if(!gremlin) return 'pull';                            // query initialization
    if(this.seen.has(gremlin.vertex._id)) return 'pull';           // we've seen this gremlin, so get another instead
    this.seen.add(gremlin.vertex._id);
    return gremlin;
  }
}

export class VertexFilterPipe<V, E> implements IPipe<V, E> {
  constructor(private readonly pattern: Partial<UserVertex<V>> | ((x: UserVertex<V>, g: MaybeGremlin<V, E>) => boolean)) {
  }

  public step(graph: Graph<V, E>, gremlin: MaybeGremlin<V, E>): Piperesult<V, E> {
    if(!gremlin) return 'pull';                           // query initialization

    if(typeof this.pattern == 'object')                        // filter by object
      return objectFilter(gremlin.vertex, this.pattern)
           ? gremlin : 'pull';

    if(typeof this.pattern != 'function') {
      throw new Error('Filter is not a function: ' + this.pattern);
    }

    if(!this.pattern(gremlin.vertex, gremlin)) return 'pull';  // gremlin fails filter function
    return gremlin;
  }
}

export class TakePipe<V, E> implements IPipe<V, E> {
  private taken = 0;

  constructor(private readonly n: number) {
  }

  public step(graph: Graph<V, E>, gremlin: MaybeGremlin<V, E>): Piperesult<V, E> {
    if(this.taken >= this.n) {
      this.taken = 0;
      return 'done'                                       // all done
    }

    if(!gremlin) return 'pull';
    this.taken++;
    return gremlin;
  }
}

export class AliasPipe<V, E> implements IPipe<V, E> {
  constructor(private readonly alias: string) {
  }

  public step(graph: Graph<V, E>, gremlin: MaybeGremlin<V, E>) {
    if(!gremlin) return 'pull'                            // query initialization
    gremlin.state.as = gremlin.state.as || {};            // initialize gremlin's 'as' state
    gremlin.state.as[this.alias] = gremlin.vertex;           // set label to the current vertex
    return gremlin;
  }
}

export class MergePipe<V, E> implements IPipe<V, E> {
  private vertices?: Array<Vertex<V, E>>;

  constructor(private readonly aliases: string[]) {
  }

  public step(graph: Graph<V, E>, gremlin: MaybeGremlin<V, E>) {
    if(!this.vertices && !gremlin) return 'pull'                   // query initialization

    if(!this.vertices || !this.vertices.length) {                 // state initialization
      const obj = (gremlin?.state||{}).as || {}
      this.vertices = this.aliases.map((id) => obj[id]).filter(Boolean)
    }

    if(!this.vertices.length) return 'pull';                       // done with this batch

    const vertex = this.vertices.shift()!;
    return makeGremlin(vertex, gremlin?.state);
  }
}

export class ExceptPipe<V, E> implements IPipe<V, E> {
  constructor(private readonly alias: string) {
  }

  public step(graph: Graph<V, E>, gremlin: MaybeGremlin<V, E>) {
    if(!gremlin) return 'pull'                            // query initialization
    if(gremlin.vertex == gremlin.state.as[this.alias]) return 'pull';
    return gremlin;
  }
}

export class BackPipe<V, E> implements IPipe<V, E> {
  constructor(private readonly alias: string) {
  }

  public step(graph: Graph<V, E>, gremlin: MaybeGremlin<V, E>) {
    if(!gremlin) return 'pull'                            // query initialization
    const target = gremlin.state.as[this.alias];
    if (!target) {
      throw new Error(`back: no target named '${this.alias}'`);
    }
    return gotoVertex(gremlin, target);
  }
}

function notUndefined<A>(x: A): x is NonNullable<A> {
  return x !== undefined;
}
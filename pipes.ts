import { Edge, Graph, EdgeProps, VertexProps, Vertex } from './graph';
import { moveGremlin, makeGremlin, MaybeGremlin } from './gremlin';
import { objectFilter } from './util';

export type Piperesult<V, E> = 'done' | 'pull' | MaybeGremlin<V, E>;

export interface IPipe<V, E> {
  step(graph: Graph<V, E>, gremlin: MaybeGremlin<V, E>): Piperesult<V, E>;
}

export class VertexSource<V, E> implements IPipe<V, E> {
  private vertices?: Array<Vertex<V, E>>;

  constructor(private readonly pattern?: string | string[] | Partial<VertexProps<V>>) {
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

export class TraverseEdgePipe<V, E> implements IPipe<V, E> {
  protected edges: Array<Edge<V, E>> = [];
  protected gremlin: MaybeGremlin<V, E>;
  private readonly findMethod: 'findInEdges' | 'findOutEdges';
  private readonly edgeList: '_in' | '_out';
  private readonly cycleBreaker = new Set<string>();

  constructor(dir: 'in' | 'out', private readonly steps: 'one' | 'many', private readonly edgeFilter?: string | string[] | Partial<EdgeProps<E>>) {
    this.findMethod = dir == 'out' ? 'findOutEdges' : 'findInEdges';
    this.edgeList = dir == 'out' ? '_in' : '_out';
  }

  public step(graph: Graph<V, E>, gremlin: MaybeGremlin<V, E>): Piperesult<V, E> {
    if(!gremlin && !this.edges.length) { return 'pull'; };

    if(!this.edges.length) {
      if (!gremlin) { throw new Error('OOPS gremlin expected'); }

      this.gremlin = gremlin;
      this.edges = this.edgesFrom(graph, gremlin.vertex);
    }

    const nextEdge = this.edges.pop();
    if (!nextEdge) { return 'pull' };

    const vertex = this.followEdge(nextEdge);

    if (this.steps === 'many') {
      // If we're asked to do multiple steps, queue up the edges
      // from the vertex we found as well. Put them in a queue, so
      // we'll do BFS.
      this.edges.unshift(...this.edgesFrom(graph, vertex));
    }

    return moveGremlin(this.gremlin!, vertex);
  }

  protected edgesFrom(graph: Graph<V, E>, vertex: Vertex<V, E>) {
    // The 2nd time we're asked to return edges from a vertex, return
    // an empty list.
    if (this.cycleBreaker.has(vertex._id)) { return []; }
    this.cycleBreaker.add(vertex._id);

    return graph[this.findMethod](vertex, this.edgeFilter);
  }

  protected followEdge(edge: Edge<V, E>): Vertex<V, E> {
    return edge[this.edgeList];
  }
}

export class PropertyPipe<V, E> implements IPipe<V, E> {
  constructor(private readonly property: keyof VertexProps<V>) {
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
  constructor(private readonly pattern: Partial<VertexProps<V>> | ((x: VertexProps<V>, g: MaybeGremlin<V, E>) => boolean)) {
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
    return moveGremlin(gremlin, target);
  }
}

function notUndefined<A>(x: A): x is NonNullable<A> {
  return x !== undefined;
}
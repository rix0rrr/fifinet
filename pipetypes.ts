import { Edge, EdgeBase, Graph, Vertex, VertexBase } from './graph';
import { objectFilter } from './util';

export type Piperesult = 'done' | 'pull' | MaybeGremlin;

export type Pipetype = (graph: Graph<any, any>, args: any[], maybeGremlin: MaybeGremlin, state: any) => Piperesult;

const Pipetypes: Record<string, Pipetype> = {
  vertex: (graph, args, gremlin, state) => {
    if (!state.vertices) {
      state.vertices = graph.findVertices(args[0]);
    }

    if (!state.vertices.length) {
      return 'done';
    }

    // FIXME: Only works if vertices have been cloned
    var vertex = state.vertices.pop();
    return makeGremlin(vertex, gremlin?.state);
  },

  in: simpleTraversal('in'),
  out: simpleTraversal('out'),

  /**
   * Return a property of an object
   */
  property: (graph, args, gremlin, state) => {
    if(!gremlin) return 'pull';
    gremlin.result = gremlin.vertex[args[0]];
    return gremlin.result == null ? undefined : gremlin;
  },

  unique: (graph, args, gremlin, state) => {
    if(!gremlin) return 'pull';                            // query initialization
    if(state[gremlin.vertex._id]) return 'pull';           // we've seen this gremlin, so get another instead
    state[gremlin.vertex._id] = true;
    return gremlin
  },

  filter: (graph, args, gremlin, state) => {
    if(!gremlin) return 'pull';                           // query initialization

    if(typeof args[0] == 'object')                        // filter by object
      return objectFilter(gremlin.vertex, args[0])
           ? gremlin : 'pull';

    if(typeof args[0] != 'function') {
      throw new Error('Filter is not a function: ' + args[0]);
    }

    if(!args[0](gremlin.vertex, gremlin)) return 'pull';  // gremlin fails filter function
    return gremlin;
  },

  take: (graph, args, gremlin, state) => {
    state.taken = state.taken || 0;

    if(state.taken >= args[0]) {
      state.taken = 0;
      return 'done'                                       // all done
    }

    if(!gremlin) return 'pull';
    state.taken++;
    return gremlin;
  },

  as: (graph, args, gremlin, state) => {
    if(!gremlin) return 'pull'                            // query initialization
    gremlin.state.as = gremlin.state.as || {}             // initialize gremlin's 'as' state
    gremlin.state.as[args[0]] = gremlin.vertex            // set label to the current vertex
    return gremlin;
  },

  merge: (graph, args, gremlin, state) => {
    if(!state.vertices && !gremlin) return 'pull'                   // query initialization

    if(!state.vertices || !state.vertices.length) {                 // state initialization
      const obj = (gremlin?.state||{}).as || {}
      state.vertices = args.map((id) => obj[id]).filter(Boolean)
    }

    if(!state.vertices.length) return 'pull';                       // done with this batch

    const vertex = state.vertices.shift();
    return makeGremlin(vertex, gremlin?.state);
  },

  except: (graph, args, gremlin, state) => {
    if(!gremlin) return 'pull'                            // query initialization
    if(gremlin.vertex == gremlin.state.as[args[0]]) return 'pull';
    return gremlin
  },

  back: (graph, args, gremlin, state) => {
    if(!gremlin) return 'pull'                            // query initialization
    const target = gremlin.state.as[args[0]];
    if (!target) {
      throw new Error(`back: no target named '${args[0]}'`);
    }
    return gotoVertex(gremlin, target);
  },
};

function simpleTraversal(dir: string): Pipetype {
  var find_method: 'findInEdges' | 'findOutEdges' = dir == 'out' ? 'findOutEdges' : 'findInEdges'
  var edge_list   = dir == 'out' ? '_in' : '_out'

  return (graph, args, gremlin, state) => {
    if(!gremlin && (!state.edges || !state.edges.length)) {
      return 'pull';
    };

    if(!state.edges || !state.edges.length) {                     // state initialization
      if (!gremlin) {
        throw new Error('OOPS gremlin expected');
      }

      state.gremlin = gremlin;
      // FIXME: this copying ain't great either
      state.edges = graph[find_method](gremlin.vertex)            // get edges that match our query
                         .filter(filterEdges(args[0]));
    }

    if(!state.edges.length) {
      return 'pull';
    };

    const vertex = state.edges.pop()[edge_list];                   // use up an edge
    return gotoVertex(state.gremlin, vertex);
  }
}

export function getPipetype(name: string) {
  const p = Pipetypes[name];
  if (!p) { throw new Error(`No such pipetype: ${name}`); }
  return p;
}

type State = Record<string, any>;

export type MaybeGremlin = Gremlin | undefined;

export interface Gremlin {
  readonly vertex: Vertex<any, any>;
  readonly state: State;
  result?: any;
}

function makeGremlin<V, E>(vertex: Vertex<V, E>, state?: State) {
  return { vertex, state: state ?? {} };
}

function gotoVertex(gremlin: Gremlin, vertex: Vertex<any, any>) {
  return makeGremlin(vertex, gremlin.state);
}

function filterEdges(filter?: string | string[] | Partial<EdgeBase>) {
  return (edge: Edge<VertexBase, EdgeBase>) => {
    if (!filter) {
      return true;
    }

    if (typeof filter == 'string') {
      return edge._label === filter;
    }

    if (Array.isArray(filter)) {
      return edge._label !== undefined && !!~filter.indexOf(edge._label);
    };

    return objectFilter(edge, filter)            // try the filter as an object
  }
}
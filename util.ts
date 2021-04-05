import { FullEdge, Edge } from "./graph";

export function objectFilter<F extends object, T extends F>(thing: T, filter: F) {
  for (const key in filter) {
    if (thing[key] !== filter[key]) {
      return false;
    }
  }

  return true;
}

export function filterEdges<V, E>(filter?: string | string[] | Partial<Edge<E>>) {
  return (edge: FullEdge<V, E>) => {
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

import { Edge, EdgeProps } from "./graph";

export function objectFilter<F extends object, T extends F>(thing: T, filter: F) {
  for (const key in filter) {
    if (thing[key] !== filter[key]) {
      return false;
    }
  }

  return true;
}

export function filterEdges<V, E>(filter?: string | string[] | Partial<EdgeProps<E>>) {
  return (edge: Edge<V, E>) => {
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

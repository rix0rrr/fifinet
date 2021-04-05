import { Vertex } from './graph';

type State = Record<string, any>;

export type MaybeGremlin = Gremlin | undefined;

export interface Gremlin {
  readonly vertex: Vertex<any, any>;
  readonly state: State;
  result?: any;
}

export function makeGremlin<V, E>(vertex: Vertex<V, E>, state?: State) {
  return { vertex, state: state ?? {} };
}

export function gotoVertex(gremlin: Gremlin, vertex: Vertex<any, any>) {
  return makeGremlin(vertex, gremlin.state);
}

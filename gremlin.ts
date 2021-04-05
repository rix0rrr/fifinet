import { Vertex } from './graph';

type State = Record<string, any>;

export type MaybeGremlin<V, E> = Gremlin<V, E> | undefined;

export interface Gremlin<V, E> {
  readonly vertex: Vertex<V, E>;
  readonly state: State;
  result?: any;
}

export function makeGremlin<V, E>(vertex: Vertex<V, E>, state?: State) {
  return { vertex, state: state ?? {} };
}

export function moveGremlin<V, E>(gremlin: Gremlin<V, E>, vertex: Vertex<V, E>) {
  return makeGremlin(vertex, gremlin.state);
}

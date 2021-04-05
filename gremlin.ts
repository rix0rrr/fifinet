import { FullVertex } from './graph';

type State = Record<string, any>;

export type MaybeGremlin<V, E> = Gremlin<V, E> | undefined;

export interface Gremlin<V, E> {
  readonly vertex: FullVertex<V, E>;
  readonly state: State;
  result?: any;
}

export function makeGremlin<V, E>(vertex: FullVertex<V, E>, state?: State) {
  return { vertex, state: state ?? {} };
}

export function moveGremlin<V, E>(gremlin: Gremlin<V, E>, vertex: FullVertex<V, E>) {
  return makeGremlin(vertex, gremlin.state);
}

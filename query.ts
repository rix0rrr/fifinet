import { EdgeBase, Graph, VertexBase } from './graph';
import { getPipetype, Gremlin, MaybeGremlin } from './pipetypes';

export class Query<V extends VertexBase, E extends EdgeBase> {
  private readonly state = [];
  private readonly program: Array<[string, any[]]> = [];
  private aliasCtr = 1;

  constructor(private readonly graph: Graph<V, E>) {
  }

  public add(pipetype: string, args: any[]) {
    var step: [string, any[]] = [pipetype, args];
    this.program.push(step);
    return this;
  }

  public out(edgeFilter?: string | string[] | Partial<E>) {
    return this.add('out', edgeFilter ? [edgeFilter] : []);
  }

  public in(edgeFilter?: string | string[] | Partial<E>) {
    return this.add('in', edgeFilter ? [edgeFilter] : []);
  }

  public property(propertyName: string) {
    return this.add('property', [propertyName]);
  }

  public unique() {
    return this.add('unique', []);
  }

  public filter(pattern: Partial<V> | ((x: V) => boolean)) {
    return this.add('filter', [pattern]);
  }

  public take(n: number) {
    return this.add('take', [n]);
  }

  public as(alias: string) {
    return this.add('as', [alias]);
  }

  public merge(...aliases: string[]) {
    return this.add('merge', aliases);
  }

  public except(alias: string) {
    return this.add('except', [alias]);
  }

  public back(alias: string) {
    return this.add('back', [alias]);
  }

  /**
   * Automatically insert an as()/back().unique() pair around a subquery
   */
  public having(fn: (q: Query<V, E>) => Query<V, E>) {
    const alias = `n${this.aliasCtr++}`;

    return fn(this.as(alias)).back(alias).unique();
  }

  public run() {
    const max = this.program.length - 1;                     // index of the last step in the program
    let maybeGremlin: MaybeGremlin = undefined;
    const results: Array<Gremlin> = [];
    let done = -1;
    let pc = max;

    let step, state, pipetype;
    while (done < max) {
      step = this.program[pc];
      state = (this.state[pc] = this.state[pc] ?? {});
      pipetype = getPipetype(step[0]);

      const pipeResult = pipetype(this.graph, step[1], maybeGremlin, state);
      if (pipeResult === 'pull') {
        // 'pull' tells us the pipe wants further input
        maybeGremlin = undefined;
        if (pc - 1 > done) {
          pc--;
          continue;
        } else {
          // previous pipe is finished, so we are too
          done = pc;
        }
      }
      else if (pipeResult === 'done') {
        // 'done' tells us the pipe is finished
        maybeGremlin = undefined;
        done = pc;
      }
      else {
        maybeGremlin = pipeResult;
      }

      pc++;
      if (pc > max) {
        if (maybeGremlin) {
          results.push(maybeGremlin);
        }
        maybeGremlin = undefined;
        pc--;
      }
    }

    return results.map(g => g.result ?? g.vertex);
  }
}

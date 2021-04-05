import { Graph, UserVertex } from './graph';
import { Gremlin, MaybeGremlin } from './gremlin';
import { AliasPipe, BackPipe, ExceptPipe, IPipe, MergePipe, PropertyPipe, SimpleTraversal, TakePipe, UniquePipe, VertexFilterPipe } from './pipes';

export interface PropertyQuery<P> {
  run(): P[];
}

export class Query<V, E> {
  private readonly program: Array<IPipe<V, E>> = [];
  private aliasCtr = 1;

  constructor(private readonly graph: Graph<V, E>) {
  }

  /**
   * Add a pipe to this query
   *
   * You should never need to call this, call any of the other
   * convenience functions.
   */
  public add(pipe: IPipe<V, E>): this {
    this.program.push(pipe);
    return this;
  }

  public out(edgeFilter?: string | string[] | Partial<E>): this {
    return this.add(new SimpleTraversal('out', edgeFilter));
  }

  public in(edgeFilter?: string | string[] | Partial<E>): this {
    return this.add(new SimpleTraversal('in', edgeFilter));
  }

  public property<P extends keyof V>(propertyName: P): PropertyQuery<V[P]> {
    this.add(new PropertyPipe(propertyName));
    return {
      // Not correct but I don't want to figure out how to properly type this
      // class. It's going to involve separate generics for the class and interfaces,
      // and that just adds to a surface area I'm not keen on typing out.
      run: () => this.run() as any,
    }
  }

  public unique(): this {
    return this.add(new UniquePipe());
  }

  public filter(pattern: Partial<V> | ((x: V) => boolean)): this {
    return this.add(new VertexFilterPipe(pattern));
  }

  public take(n: number): this {
    return this.add(new TakePipe(n));
  }

  public as(alias: string): this {
    return this.add(new AliasPipe(alias));
  }

  public merge(...aliases: string[]): this {
    return this.add(new MergePipe(aliases));
  }

  public except(alias: string): this {
    return this.add(new ExceptPipe(alias));
  }

  public back(alias: string): this {
    return this.add(new BackPipe(alias));
  }

  /**
   * Automatically insert an as()/back().unique() pair around a subquery
   */
  public having(fn: (q: Query<V, E>) => Query<V, E>): Query<V, E> {
    const alias = `n${this.aliasCtr++}`;

    return fn(this.as(alias)).back(alias).unique();
  }

  public run(): Array<UserVertex<V>> {
    const max = this.program.length - 1;                     // index of the last step in the program
    let maybeGremlin: MaybeGremlin = undefined;
    const results: Array<Gremlin> = [];
    let done = -1;
    let pc = max;

    while (done < max) {
      const step = this.program[pc];

      const pipeResult = step.step(this.graph, maybeGremlin);
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

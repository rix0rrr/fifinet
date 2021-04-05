import { VertexSource } from './pipes';
import { Query } from './query';
import { objectFilter } from './util';

export interface VertexBase {
  readonly _id?: string;
}

export interface EdgeBase {
  readonly _label?: string;
  readonly _in: string;
  readonly _out: string;
}

export type InVertex<V> = V & { _id?: string; }
export type InEdge<E> = E & { _label?: string; _in: string; _out: string; }

export type UserVertex<V> = V & { _id?: string; }
export type UserEdge<E> = E & { _label?: string; }

export type Vertex<V, E> = V & { _id: string, _in: Array<Edge<V, E>>, _out: Array<Edge<V, E>> };
export type Edge<V, E> = E & { _label?: string; _in: Vertex<V, E>, _out: Vertex<V, E> };

export class Graph<V, E> {
  private readonly vertices: Array<Vertex<V, E>> = [];
  private readonly edges: Array<Edge<V, E>> = [];
  private readonly vertexIndex: Record<string, Vertex<V, E>> = {};
  private autoId = 1;

  constructor(vs?: InVertex<V>[], es?: InEdge<E>[]) {
    if (vs) { this.addVertices(vs); }
    if (es) { this.addEdges(es); }
  }

  public addVertices(vs: InVertex<V>[]) {
    for (const v of vs) {
      this.addVertex(v);
    }
  }

  public addEdges(es: InEdge<E>[]) {
    for (const e of es) {
      this.addEdge(e);
    }
  }

  public addVertex(v: InVertex<V>) {
    if (v._id && this.findVertexById(v._id)) {
      throw new Error(`A vertex with id '${v._id}' already exists`);
    }
    let id = v._id ?? `${this.autoId++}`;

    const vertex = {
      ...v,
      _id: id,
      _in: [],
      _out: [],
    };
    this.vertices.push(vertex);
    this.vertexIndex[vertex._id] = vertex;
    return vertex;
  }

  public addEdge(e: InEdge<E>) {
    const _in  = this.findVertexById(e._in);
    const _out = this.findVertexById(e._out);

    if (!_in || !_out) {
      throw new Error(`That edge's ${_in ? 'out' : 'in'} vertex wasn't found: ${_in ? e._out : e._in }`);
    }

    const edge: Edge<V, E> = {
      ...e,
      _in,
      _out,
    };

    edge._out._out.push(edge);
    edge._in._in.push(edge);
    this.edges.push(edge);
  }

  public findVertexById(id: string): Vertex<V, E> | undefined {
    return this.vertexIndex[id];
  }

  public findVerticesByIds(ids: string[]): Array<Vertex<V, E> | undefined> {
    return ids.map(this.findVertexById.bind(this));
  }

  public findVertices(pattern?: Partial<UserVertex<V>> | string | string[]): Array<Vertex<V, E> | undefined> {
    if (!pattern || (Array.isArray(pattern) && pattern.length === 0)) {
      // FIXME: Copying is expensive
      return this.vertices.slice();
    }

    if (Array.isArray(pattern)) {
      return this.findVerticesByIds(pattern);
    }

    if (typeof pattern === 'object') {
      return this.searchVertices(pattern);
    }

    if (typeof pattern === 'string') {
      return [this.findVertexById(pattern)];
    }

    throw new Error(`Did not understand argument: ${pattern}`);
  }

  public searchVertices(pattern: Partial<UserVertex<V>>): Array<Vertex<V, E> | undefined> {
    return this.vertices.filter((vertex) => {
      return objectFilter(vertex, pattern);
    })
  }

  public v(arg?: string | string[] | Partial<V>) {
    const query = new Query<V, E>(this);
    query.add(new VertexSource(arg));
    return query;
  }

  public findInEdges(vertex: Vertex<V, E>) {
    return vertex._in;
  }

  public findOutEdges(vertex: Vertex<V, E>) {
    return vertex._out;
  }
}

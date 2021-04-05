import { VertexSource } from './pipes';
import { Query } from './query';
import { objectFilter } from './util';

export type InVertex<V> = V & { _id?: string; }
export type InEdge<E> = E & { _label?: string; _in: string; _out: string; }

export type Vertex<V> = V & { _id: string; }
export type Edge<E> = E & { _label?: string; }

export type FullVertex<V, E> = V & { _id: string, _in: Array<FullEdge<V, E>>, _out: Array<FullEdge<V, E>> };
export type FullEdge<V, E> = E & { _label?: string; _in: FullVertex<V, E>, _out: FullVertex<V, E> };

export class Graph<V, E> {
  private readonly vertices: Array<FullVertex<V, E>> = [];
  private readonly edges: Array<FullEdge<V, E>> = [];
  private readonly vertexIndex: Record<string, FullVertex<V, E>> = {};
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

    const edge: FullEdge<V, E> = {
      ...e,
      _in,
      _out,
    };

    edge._out._out.push(edge);
    edge._in._in.push(edge);
    this.edges.push(edge);
  }

  public findVertexById(id: string): FullVertex<V, E> | undefined {
    return this.vertexIndex[id];
  }

  public findVerticesByIds(ids: string[]): Array<FullVertex<V, E> | undefined> {
    return ids.map(this.findVertexById.bind(this));
  }

  public findVertices(pattern?: Partial<Vertex<V>> | string | string[]): Array<FullVertex<V, E> | undefined> {
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

  public searchVertices(pattern: Partial<Vertex<V>>): Array<FullVertex<V, E> | undefined> {
    return this.vertices.filter((vertex) => {
      return objectFilter(vertex, pattern);
    })
  }

  public v(arg?: string | string[] | Partial<Vertex<V>>) {
    const query = new Query<V, E>(this);
    query.add(new VertexSource(arg));
    return query;
  }

  public findInEdges(vertex: FullVertex<V, E>) {
    return vertex._in;
  }

  public findOutEdges(vertex: FullVertex<V, E>) {
    return vertex._out;
  }
}

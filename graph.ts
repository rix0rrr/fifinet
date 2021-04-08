import { VertexSource } from './pipes';
import { Query } from './query';
import { filterEdges, isDefined, objectFilter } from './util';

export type InVertex<V> = V & { _id?: string; }
export type InEdge<E> = E & { _label?: string; _in: string; _out: string; }

export type VertexProps<V> = V & { _id: string; }
export type EdgeProps<E> = E & { _label?: string; }

export type Vertex<V, E> = V & { _id: string, _in: Array<Edge<V, E>>, _out: Array<Edge<V, E>> };
export type Edge<V, E> = E & { _label?: string; _in: Vertex<V, E>, _out: Vertex<V, E> };

export interface GraphOptions<V> {
  /**
   * Fields on vertices that should be indexed
   *
   * `_id` is always indexed.
   */
  readonly indexedFields?: Array<keyof V>;
}

export class Graph<V, E> {
  private readonly vertices: Array<Vertex<V, E>> = [];
  private readonly edges: Array<Edge<V, E>> = [];
  private readonly vertexIndex = new Map<string, Vertex<V, E>>();
  private readonly additionalIndices = new Map<keyof V, Map<any, Set<string>>>();
  private readonly indexedFields: Array<keyof V>;
  private autoId = 1;

  constructor(vs?: InVertex<V>[], es?: InEdge<E>[], options: GraphOptions<V> = {}) {
    this.indexedFields = options.indexedFields ?? [];
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
    this.vertexIndex.set(vertex._id, vertex);

    for (const indexed of this.indexedFields) {
      const value = vertex[indexed];
      if (value !== undefined) {
        this.indexField(indexed, value, id);
      }
    }

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
    return this.vertexIndex.get(id);
  }

  public findVerticesByIds(ids: string[]): Array<Vertex<V, E> | undefined> {
    return ids.map(this.findVertexById.bind(this));
  }

  public findVertices(pattern?: Partial<VertexProps<V>> | string | string[]): Array<Vertex<V, E> | undefined> {
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

  public searchVertices(pattern: Partial<VertexProps<V>>): Array<Vertex<V, E> | undefined> {
    if (pattern._id) {
      return [this.findVertexById(pattern._id)];
    }

    // Search for indexed fields first
    const indices = Object.keys(pattern)
      .filter(key => key !== '_id')
      .map(key => this.additionalIndices.get(key as any)?.get((pattern as any)[key]))
      .filter(isDefined);


    const initialVertexSet = indices.length > 0
      ? this.findVerticesByIds(intersectSets(indices)).filter(isDefined)
      : this.vertices;

    return initialVertexSet.filter((vertex) => {
      return objectFilter(vertex, pattern);
    })
  }

  public v(arg?: string | string[] | Partial<VertexProps<V>>) {
    const query = new Query<V, E>(this);
    query.add(new VertexSource(arg));
    return query;
  }

  public findInEdges(vertex: Vertex<V, E>, edgeFilter?: string | string[] | Partial<EdgeProps<E>>) {
    // FIXME: this copying ain't great either
    return vertex._in.filter(filterEdges(edgeFilter));
  }

  public findOutEdges(vertex: Vertex<V, E>, edgeFilter?: string | string[] | Partial<EdgeProps<E>>) {
    // FIXME: this copying ain't great either
    return vertex._out.filter(filterEdges(edgeFilter));
  }

  private indexField(index: keyof V, value: any, id: string) {
    let map = this.additionalIndices.get(index);
    if (!map) {
      map = new Map();
      this.additionalIndices.set(index, map);
    }

    let set = map.get(value);
    if (!set) {
      set = new Set();
      map.set(value, set);
    }

    set.add(id);
  }
}

function intersectSets(indices: Set<string>[]): string[] {
  const ret = new Array<string>();
  const otherIndices = indices.slice(1);
  for (const el of indices[0]) {
    if (otherIndices.every(id => id.has(el))) {
      ret.push(el);
    }
  }
  return ret;
}

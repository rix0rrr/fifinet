# fifinet

Tiny in-memory graph database and query engine implementation.

The query engine looks a lot like the Gremlin traversal engine, and this
module is heavily based upon [Dagoba by Dann
Toliver](https://github.com/dxnn/dagoba).

## What's this?

This is a tiny implementation of an in-memory graph database, with a non-optimized
but functional query engine based on a fluent API.

The graph is a *property graph*, which means that vertices and edges can have
arbitrary properties which you can use to store information in.

You can then use the query functionality to query the database.

## Creating a graph

Define your own types to hold the properties of vertices and edges.

On vertices, the `_id` property is special: it will hold the ID of the
vertex. You can provide one, otherwise one will be assigned automatically.

On edges, the `_label` property is special: it is the type of edge. It is
optional, in case you only have one type of edge.

Creating a graph looks like this:

```ts
import * as fn from 'fifinet';

interface GreekProps {
  species: 'god' | 'titan' | 'halfgod' | 'mortal';
}

interface EdgeProps {
}

const graph = new fn.Graph<GreekProps, EdgeProps>(
  [
    { _id: 'zeus',       species: 'god' },
    { _id: 'herakles',   species: 'halfgod' },
    { _id: 'alcmene',    species: 'mortal' },
    { _id: 'amphitryon', species: 'mortal' },
  ], [
    { _out: 'amphitryon', _in: 'alcmene',    _label: 'marriedTo' },
    { _out: 'alcmene',    _in: 'amphitryon', _label: 'marriedTo' },
    { _out: 'zeus',       _in: 'amphitryon', _label: 'impersonates' },
    { _out: 'zeus',       _in: 'alcmene',    _label: 'rapes' },
    { _out: 'herakles',   _in: 'zeus',       _label: 'childOf' },
    { _out: 'herakles',   _in: 'alcmene',    _label: 'childOf' },
  ],
);
```

The `graph` object also has methods to mutate and inspect the graph:

```ts
graph.addVertices([
  { _id: 'perseus', species: 'mortal' },
  { _id: 'electryon', species: 'mortal' },
]);
graph.addEges([
  { _out: 'perseus',   _in: 'zeus',      _label: 'childOf' },
  { _out: 'electryon', _in: 'perseus',   _label: 'childOf' },
  { _out: 'alcmene',   _in: 'electryon', _label: 'childOf' },
]);
```

## Querying

Querying starts with the `graph.v()` function, which selects one or more
vertices from the graphs. You then chain a number of operations onto the
query, before finally calling `run()` to execute the query:

```ts
const results = graph.v()./* any number of operations here */.run();
```

For example, to find all the parents of Herakles:

```ts
const results = graph.v('herakles').out('childOf').run();
```

### Graph: v()

Returns a set of nodes to start the query. The following filter call
patterns are accepted:

```ts
graph.v()                      // All nodes
graph.v('zeus')                // Single ID
graph.v(['zeus', 'herakles'])  // Multiple IDs
graph.v({ species: 'god' })    // Filter by example
```

### Query: in()/out()/inAny()/outAny()

Traverse edges from the currently selected set of nodes:

* `in`, `out`: traverse one edge either coming into or going
  out of the current node.
* `inAny`, `outAny`: traverse one or more edges either coming into or going
  out of the current node.

Takes an argument filtering the edges:

```ts
graph.v().out()                         // All outgoing edges
graph.v().out('marriedTo')              // Single label
graph.v().out(['marriedTo', 'childOf']) // Multiple labels
graph.v().out({ _label: 'marriedTo' })  // Filter by example
```

### Query: property()

For convenience, return a properties from each vertex in the query
result set, instead of returning the whole query object.

```ts
graph.v('zeus').in('childOf').property('species').run()
```

### Query: filter()

Filter the current set of nodes down by subsetting it.

```ts
query.filter({ species: 'mortal' })                 // Filter by example
query.filter(vertex => vertex.species === 'mortal') // Filter by callback
```

Example:

```ts
graph.v()
  .filter({ species: 'halfgod' })
  .run()
```

### Query: unique()

If the query would yield duplicate nodes, return only the unique
ones.

```ts
graph.v('zeus')
  .in('childOf')
  .out('childOf') // This would return Zeus as many times as he has children
  .unique()       // Suppress duplicate Zeuses
  .run()
```

### Query: take()

Instead of returning all results, return only the next `N`.

You can run the query multiple times to obtain multiple subsets of results:

```ts
const query = graph.v().take(2);

query.run(); // Returns the first 2 nodes
query.run(); // Returns the next 2 nodes, etc.
```

### Query: as()

Label the current set of vertices in the query with an alias. This
can be used to refer back to the current vertex set later on, using
other operators like `merge()`, `except()` and `back()`.

```ts
g.v().as('root')
```

### Query: merge()

Replace the current vertex set with those of one or more aliases from
previous node sets.

To return Zeus' children and grandchildren:

```ts
g.v('zeus')
  .in('childOf').as('children')
  .in('childOf').as('grandchildren')
  .merge('children', 'grandchildren')
  .run()
```

### Query: except()

Exclude the vertices from a previously named vertex set from the current
set of vertices.

The following returns all of Herakles' siblings who aren't Herakles:

```ts
g.v('herakles').as('me')
  .out('childOf').in('childOf')
  .except('me')
  .run()
```

### Query: back()/having()

Back returns to a previous vertex in the query, but only if the query
so far has been successful.

The following returns all nodes that have mortal children:

```ts
g.v().as('me')
  .in('childOf').filter({ species: 'mortal' })
  .back('me')
  .unique()
  .run()
```

`having()` can be used as an alias for `as()/back()/unique()`:

```ts
g.v()
  .having(me => me.in('childOf').filter({ species: 'mortal' ]))
  .run()
```
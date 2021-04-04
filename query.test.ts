import { EdgeBase, Graph, VertexBase } from "./graph";

interface MyVertex extends VertexBase {
  hair: string;
}

interface MyEdge extends EdgeBase {
  color: string;
};

function odinGraph() {
  return new Graph<MyVertex, MyEdge>(
    [
      { _id: 'odin', hair: 'magnificent' },
      { _id: 'thor', hair: 'magnificent' },
      { _id: 'balder', hair: 'middling' },
      { _id: 'hoder', hair: 'y' },
    ],
    [
      { _label: 'childOf', _in: 'odin', _out: 'thor', color: 'green' },
      { _label: 'childOf', _in: 'odin', _out: 'balder', color: 'green', },
      { _label: 'childOf', _in: 'odin', _out: 'hoder', color: 'blue', },
    ]
  );
}

test('vertex', () => {
  const g = odinGraph();

  expect(g.v().run()).toHaveLength(4);
  expect(g.v('thor').run()).toHaveLength(1);
  expect(g.v(['thor', 'hoder']).run()).toHaveLength(2);
  expect(g.v({ hair: 'magnificent' }).run()).toHaveLength(2);
});

test('in', () => {
  const g = odinGraph();

  expect(g.v('odin').in().run()).toHaveLength(3);
  expect(g.v('odin').in('childOf').run()).toHaveLength(3);
  expect(g.v('odin').in('banana').run()).toHaveLength(0);
  expect(g.v('odin').in({ color: 'green' }).run()).toHaveLength(2);
});

test('out', () => {
  const g = odinGraph();

  expect(g.v('thor').out().run()).toHaveLength(1);
  expect(g.v('thor').out('childOf').run()).toHaveLength(1);
  expect(g.v('thor').out('banana').run()).toHaveLength(0);
  expect(g.v('thor').out({ color: 'green' }).run()).toHaveLength(1);
});

test('inout', () => {
  const g = odinGraph();

  expect(g.v('odin').in().out().run().map(v => v._id)).toEqual(['odin', 'odin', 'odin']);
});

test('unique', () => {
  const g = odinGraph();

  expect(g.v('odin').in().out().unique().property('_id').run()).toEqual(['odin']);
});

test('property', () => {
  const g = odinGraph();

  expect(g.v('odin').property('hair').run()).toEqual(['magnificent']);
});

test('filter', () => {
  const g = odinGraph();

  expect(g.v('odin').in('childOf').filter(v => v.hair === 'magnificent').run()).toHaveLength(1);
});

test('take', () => {
  const g = odinGraph();

  const query = g.v().take(1);

  expect(query.run()).toHaveLength(1);
  expect(query.run()).toHaveLength(1);
  expect(query.run()).toHaveLength(1);
  expect(query.run()).toHaveLength(1);
  expect(query.run()).toHaveLength(0);
});

test('as/merge', () => {
  const g = odinGraph();

  const query = g.v().as('parent')
    .in('childOf').as('child')
    .merge('parent', 'child')
    .property('_id');

  expect(query.run()).toEqual([
    'odin',
    'hoder',
    'odin',
    'balder',
    'odin',
    'thor',
  ]);
});

test('as/except', () => {
  const g = odinGraph();

  const query = g.v('thor').as('me')
    .out('childOf').in('childOf')
    .except('me')
    .property('_id');

  expect(query.run()).toEqual([
    'hoder',
    'balder',
  ]);
});

test('as/back', () => {
  const g = odinGraph();

  // Who is the father of Thor, in a roundabout way
  const query = g.v().as('me')
    .in('childOf').filter({ _id: 'thor' })
    .back('me')
    .property('_id');

  expect(query.run()).toEqual([
    'odin',
  ]);
});

test('having', () => {
  const g = odinGraph();

  // Who is the father of Thor, in a roundabout way
  const query = g.v().having(c => c
    .in('childOf').filter({ _id: 'thor' })
  ).property('_id');

  expect(query.run()).toEqual([
    'odin',
  ]);
});

test('having does not return duplicates', () => {
  // Any node that has children
  const g = odinGraph();

  const query = g.v().having(c => c.in('childOf')).property('_id');

  expect(query.run()).toEqual([
    'odin',
  ]);
});
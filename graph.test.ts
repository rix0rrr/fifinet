import { Graph } from './graph';

interface Props {
  readonly id1?: string;
  readonly id2?: string;
  readonly unind?: string;
}

interface Empty {
}


test('indexed search', () => {
  const graph = new Graph<Props, Empty>([
    { _id: '1', id1: 'a', id2: 'b' },
    { _id: '2', id1: 'a', id2: 'b', unind: 'c' },
    { _id: '3', id1: 'x', id2: 'y', unind: 'z' },
  ], [], {
    indexedFields: ['id1', 'id2'],
  });

  expect(graph.searchVertices({ id1: 'a' }).map(x => x?._id)).toEqual(['1', '2']);
  expect(graph.searchVertices({ id1: 'a', id2: 'b' }).map(x => x?._id)).toEqual(['1', '2']);
  expect(graph.searchVertices({ id1: 'a', unind: 'c' }).map(x => x?._id)).toEqual(['2']);
  expect(graph.searchVertices({ unind: 'z' }).map(x => x?._id)).toEqual(['3']);
});

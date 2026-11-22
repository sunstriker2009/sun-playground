const latest = 'csharp-linq-latest-per-group';
const join = 'csharp-linq-join-by-key';
const duplicates = 'csharp-linq-duplicate-keys';

export const linqCases = [
  {
    name: 'Latest record uses the highest revision within a tied timestamp',
    id: latest,
    assertions: [
      'Equal("North:3,South:1", string.Join(",", latest.Select(row => $"{row.Account}:{row.Revision}")));',
    ],
  },
  {
    name: 'Latest record can use the lowest revision after ordering by timestamp',
    id: latest,
    values: { tieBreak: 'lowest' },
    assertions: [
      'Equal("North:2,South:1", string.Join(",", latest.Select(row => $"{row.Account}:{row.Revision}")));',
    ],
  },
  {
    name: 'Latest record keeps the first input row on a complete tie',
    id: latest,
    values: { includeSample: false },
    setup: [
      'var updates = new[]',
      '{',
      '    (Account: "A", UpdatedAt: DateTimeOffset.UnixEpoch, Revision: 2, Label: "First"),',
      '    (Account: "A", UpdatedAt: DateTimeOffset.UnixEpoch, Revision: 2, Label: "Second"),',
      '};',
    ],
    assertions: ['Equal("First", latest.Single().Label);'],
  },
  {
    name: 'Inner join returns every matching pair and skips unmatched orders',
    id: join,
    assertions: [
      'Equal(2, joined.Length);',
      'Equal(true, joined.All(row => row.OrderId == 101));',
      'Equal("Ada,Ada (legacy)", string.Join(",", joined.Select(row => row.CustomerName)));',
    ],
  },
  {
    name: 'Left join preserves order, repeated matches, and unmatched rows',
    id: join,
    values: { joinType: 'left' },
    assertions: [
      'Equal("101,101,102", string.Join(",", joined.Select(row => row.OrderId)));',
      'Equal("Ada", joined[0].CustomerName);',
      'Equal("Ada (legacy)", joined[1].CustomerName);',
      'Equal<string>(null, joined[2].CustomerName);',
    ],
  },
  {
    name: 'Left join handles an empty customer sequence',
    id: join,
    values: { joinType: 'left', includeSample: false },
    setup: [
      'var orders = new[] { (OrderId: 5, CustomerId: 12) };',
      'var customers = new[] { new { Id = 12, Name = "Unused" } }.Take(0);',
    ],
    assertions: [
      'Equal(5, joined.Single().OrderId);',
      'Equal<string>(null, joined.Single().CustomerName);',
    ],
  },
  {
    name: 'Composite grouping reports both key values and the matching rows',
    id: duplicates,
    values: { minCount: 3 },
    assertions: [
      'var group = duplicates.Single();',
      'Equal("East", group.Warehouse);',
      'Equal("A-10", group.Sku);',
      'Equal(3, group.Count);',
      'Equal("1,3,5", string.Join(",", group.RowIds));',
    ],
  },
  {
    name: 'Composite grouping returns no groups below the chosen threshold',
    id: duplicates,
    values: { minCount: 4 },
    assertions: ['Equal(0, duplicates.Length);'],
  },
  {
    name: 'Composite grouping keeps case and other key values distinct',
    id: duplicates,
    values: { includeSample: false },
    setup: [
      'var inventory = new[]',
      '{',
      '    (Warehouse: "East", Sku: "X", RowId: 1),',
      '    (Warehouse: "east", Sku: "X", RowId: 2),',
      '    (Warehouse: "West", Sku: "X", RowId: 3),',
      '    (Warehouse: "East", Sku: "Y", RowId: 4),',
      '    (Warehouse: "East", Sku: "X", RowId: 5),',
      '};',
    ],
    assertions: [
      'Equal(2, duplicates.Single().Count);',
      'Equal("1,5", string.Join(",", duplicates.Single().RowIds));',
    ],
  },
];

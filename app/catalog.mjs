import { defaultValues, parseValues } from './parameters.mjs';

export { defaultValues } from './parameters.mjs';

const shellLiteral = (value) => "'" + value.replaceAll("'", "'\\''") + "'";

function xpathLiteral(value) {
  if (!value.includes("'")) return "'" + value + "'";
  if (!value.includes('"')) return '"' + value + '"';
  return 'concat(' + value.split("'").map((part) => "'" + part + "'").join(', "\'", ') + ')';
}

const xpathNamePattern = '[A-Za-z_][A-Za-z0-9_.\\-]*';

function csharpStringLiteral(value) {
  return JSON.stringify(value).replace(/[\u0085\u2028\u2029]/g, (character) =>
    '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));
}

function csharpMultilineLiteral(value) {
  const lines = value.split('\n');
  return lines.map((line, index) =>
    csharpStringLiteral(index < lines.length - 1 ? line + '\n' : line)).join(' +\n    ');
}

const regexTimeoutField = {
  id: 'timeout', type: 'integer', label: 'Match timeout (milliseconds)', default: 250,
  min: 10, max: 5000, hint: 'Enter a match timeout from 10 to 5000 milliseconds.',
};

const includeLinqSample = {
  id: 'includeSample', type: 'toggle', label: 'Include sample data', default: true,
};

function regexOptions(ignoreCase) {
  return 'RegexOptions.CultureInvariant' + (ignoreCase ? ' | RegexOptions.IgnoreCase' : '');
}

export const snippets = [
  {
    id: 'git-file-history',
    topic: 'History',
    prerequisites: "Git and a POSIX shell. Run from the repository root.",
    expected: "Up to five lines with a short commit hash and subject, newest first, for commits that changed src/app.js.",
    effects: "Reads commit history for the selected branch and path. File change details show the status and path of changed files.",
    aliases: ["git log --oneline", "file history"],
    useCases: ["Find old changes to a file", "See which commits changed a path"],
    relatedIds: ["git-branch-list", "git-compare-branch", "git-line-history"],
    language: 'Git',
    title: 'View a file’s commit history',
    description: 'List commits that changed a file. Leave the branch blank to use the current history, or enter a local branch name. Use a path relative to the repository root.',
    keywords: 'log commits history changes file path bash shell',
    example: 'Show the last five commits affecting src/app.js in a POSIX shell.',
    fields: [
      { id: 'path', type: 'text', label: 'File path', default: 'src/app.js' },
      { id: 'limit', type: 'integer', label: 'Commit count', default: 5, min: 1, max: 9999, hint: 'Commit count must be between 1 and 9999.' },
      { id: 'branch', type: 'text', label: 'Local branch (optional)', default: '', allowEmpty: true },
      { id: 'fileChanges', type: 'toggle', label: 'Show file change details', default: false },
    ],
    render: ({ path, limit, branch, fileChanges }) => {
      const args = ['git --literal-pathspecs log --oneline', '-n ' + limit];
      if (fileChanges) args.push('--name-status');
      if (branch.trim()) args.push('--end-of-options', shellLiteral('refs/heads/' + branch.trim()));
      args.push('--', shellLiteral(path));
      return args.join(' ');
    },
  },
  {
    id: 'git-branch-list',
    topic: 'Branches and tags',
    prerequisites: "Git in a local repository.",
    expected: "With the default sort order, up to three short branch names ordered by the date of each branch’s latest commit.",
    effects: "Reads local branch references.",
    aliases: ["git branch list", "recent branches"],
    useCases: ["Find recently updated local branches"],
    relatedIds: ["git-file-history", "git-compare-branch"],
    language: 'Git',
    title: 'List recent local branches',
    description: 'Show local branches by date of their latest commit or in name order.',
    keywords: 'branch list recent refs sort terminal bash',
    example: 'List the three branches with the most recent commits.',
    fields: [
      { id: 'limit', type: 'integer', label: 'Branch count', default: 3, min: 1, max: 9999, hint: 'Branch count must be between 1 and 9999.' },
      {
        id: 'sort', type: 'choice', label: 'Sort by', default: '-committerdate',
        options: [
          { value: '-committerdate', label: 'Latest commit' },
          { value: 'refname', label: 'Branch name' },
        ],
      },
    ],
    render: ({ limit, sort }) => 'git for-each-ref --sort=' + sort + ' --count=' + limit
      + " --format='%(refname:short)' refs/heads/",
  },
  {
    id: 'js-filter-array',
    topic: 'Arrays',
    prerequisites: "An array named items. Each element should be an object.",
    expected: "For [{ status: \"active\" }, { status: \"archived\" }], matches contains only the active record.",
    effects: "Creates a new array that shares references to the matching objects.",
    aliases: ["Array.filter", "filter array"],
    useCases: ["Find objects with a matching field", "Keep records with a particular status"],
    relatedIds: ["js-join-array", "js-map-property"],
    language: 'JavaScript',
    title: 'Filter an array by property',
    description: 'Keep objects whose chosen property equals a string. Property names can contain spaces or punctuation.',
    keywords: 'js filter array object match equality select list',
    example: 'From an array called items, keep only objects with status set to active.',
    fields: [
      { id: 'property', type: 'text', label: 'Property name', default: 'status' },
      { id: 'value', type: 'text', label: 'Matching text', default: 'active', allowEmpty: true },
    ],
    render: ({ property, value }) => 'const matches = items.filter((item) => item['
      + JSON.stringify(property) + '] === ' + JSON.stringify(value) + ');',
  },
  {
    id: 'js-join-array',
    topic: 'Text formatting',
    prerequisites: "An array named items.",
    expected: "For [\"alpha\", \"beta\", \"gamma\"], joined is \"alpha, beta, gamma\".",
    effects: "Creates a string and coerces non-string elements to text where applicable.",
    aliases: ["Array.join", "join array"],
    useCases: ["Turn a list of labels into comma-separated text"],
    relatedIds: ["js-filter-array", "js-map-property"],
    language: 'JavaScript',
    title: 'Join an array into a string',
    description: 'Combine the elements of an array called items into a string with a separator.',
    keywords: 'js array join delimiter concatenate string separator list',
    example: 'Convert an array of labels into a string separated by commas and spaces.',
    fields: [{ id: 'separator', type: 'text', label: 'Separator', default: ', ', allowEmpty: true }],
    render: ({ separator }) => 'const joined = items.join(' + JSON.stringify(separator) + ');',
  },
  {
    id: 'csharp-take-items',
    topic: 'LINQ',
    prerequisites: "A sequence named items and System.Linq in scope.",
    expected: "For twelve input elements, firstItems is a list containing the first ten in input order.",
    effects: "Enumerates up to the requested number of elements and materializes a new list.",
    aliases: ["Enumerable.Take", "LINQ Take"],
    useCases: ["Get the first N items from a collection"],
    relatedIds: ["csharp-distinct-strings", "csharp-any-above", "csharp-regex-named-group"],
    language: 'C#',
    title: 'Take the first items from a sequence',
    description: 'Use LINQ to take up to a fixed number of items from an enumerable called items. Calling ToList materializes the result.',
    keywords: 'csharp dotnet .net linq enumerable list limit',
    example: 'Take up to ten items from the input sequence. Add using System.Linq if needed.',
    fields: [
      { id: 'limit', type: 'integer', label: 'Item count', default: 10, min: 1, max: 9999, hint: 'Item count must be between 1 and 9999.' },
    ],
    render: ({ limit }) => 'var firstItems = items.Take(' + limit + ').ToList();',
  },
  {
    id: 'xpath-match-attribute',
    topic: 'Value matching',
    prerequisites: "An XML or HTML document and an XPath 1.0 evaluator.",
    expected: "For a document with one data-state=\"ready\" element and one data-state=\"queued\" element, only the ready element matches.",
    effects: "Evaluates the document and returns matching element nodes.",
    aliases: ["attribute selector", "attribute predicate"],
    useCases: ["Find HTML or XML elements with a matching attribute"],
    relatedIds: ["xpath-contains-text", "xpath-direct-children"],
    language: 'XPath',
    title: 'Find elements by attribute value',
    description: 'Find elements anywhere in a document whose selected unprefixed attribute exactly matches a value. Works in XPath 1.0.',
    keywords: 'xml xpath html locator select attribute predicate quotes',
    example: 'Find every element with a data-state attribute equal to ready.',
    fields: [
      { id: 'attribute', type: 'text', label: 'Attribute name', default: 'data-state', pattern: xpathNamePattern, hint: 'Use an unprefixed ASCII attribute name.' },
      { id: 'value', type: 'text', label: 'Attribute value', default: 'ready', allowEmpty: true },
    ],
    render: ({ attribute, value }) => '//*[@' + attribute + '=' + xpathLiteral(value) + ']',
  },
  {
    id: 'git-compare-branch',
    topic: 'Branches and tags',
    language: 'Git',
    title: 'Summarize changes between branches',
    description: 'Compare the tip of a local branch with the current commit and show a summary by path.',
    keywords: 'git diff stat branch compare tips changed files',
    aliases: ['git diff --stat', 'compare branches'],
    useCases: ['See which files differ from the main branch'],
    relatedIds: ['git-file-history', 'git-branch-list'],
    example: 'Compare the local main branch with HEAD after committing a change to src/app.js.',
    prerequisites: 'Git, a POSIX shell, and a local main branch for the default example.',
    expected: 'A summary showing changed paths and line counts where available. Identical snapshots produce no output.',
    effects: 'Reads the two committed snapshots.',
    fields: [{ id: 'base', type: 'text', label: 'Base branch', default: 'main' }],
    render: ({ base }) => 'git diff --stat --end-of-options '
      + shellLiteral('refs/heads/' + base.trim()) + ' HEAD --',
  },
  {
    id: 'js-map-property',
    topic: 'Arrays',
    language: 'JavaScript',
    title: 'Extract a property from each array item',
    description: 'Create an array of values from one property on each object.',
    keywords: 'javascript map array project pluck property field',
    aliases: ['Array.map', 'pluck property'],
    useCases: ['Get all names from a collection of objects'],
    relatedIds: ['js-filter-array', 'js-join-array'],
    example: 'Extract the names from [{ name: "Ada" }, { name: "Lin" }].',
    prerequisites: 'An array named items containing objects.',
    expected: 'The values array contains ["Ada", "Lin"] in that order. An object with a missing property contributes undefined.',
    effects: 'Creates a new array with one entry per item.',
    fields: [{ id: 'property', type: 'text', label: 'Property name', default: 'name' }],
    render: ({ property }) => 'const values = items.map((item) => item[' + JSON.stringify(property) + ']);',
  },
  {
    id: 'csharp-distinct-strings',
    topic: 'LINQ',
    language: 'C#',
    title: 'Remove duplicate strings from a sequence',
    description: 'Use LINQ with an ordinal comparer to deduplicate strings. Choose whether case matters.',
    keywords: 'csharp dotnet linq distinct unique dedupe case ordinal',
    aliases: ['Enumerable.Distinct', 'deduplicate strings'],
    useCases: ['Merge repeated labels that use different capitalization'],
    relatedIds: ['csharp-take-items', 'csharp-any-above'],
    example: 'Deduplicate ["ALPHA", "alpha", "beta"] while ignoring case.',
    prerequisites: 'A string sequence named items with System and System.Linq in scope.',
    expected: 'The uniqueItems list has one entry for ALPHA/alpha and one for beta.',
    effects: 'Enumerates the input and materializes a list.',
    fields: [{ id: 'ignoreCase', type: 'toggle', label: 'Ignore case', default: true }],
    render: ({ ignoreCase }) => 'var uniqueItems = items.Distinct(StringComparer.'
      + (ignoreCase ? 'OrdinalIgnoreCase' : 'Ordinal') + ').ToList();',
  },
  {
    id: 'csharp-any-above',
    topic: 'LINQ',
    language: 'C#',
    title: 'Check whether any number exceeds a threshold',
    description: 'Use LINQ to test whether at least one item is greater than an integer threshold.',
    keywords: 'csharp dotnet linq any predicate condition greater number threshold',
    aliases: ['Enumerable.Any', 'any above threshold'],
    useCases: ['Check for a reading over the allowed limit'],
    relatedIds: ['csharp-take-items', 'csharp-distinct-strings'],
    example: 'Check whether [5, 10, 11] contains a value greater than 10.',
    prerequisites: 'A numeric sequence named items with System.Linq in scope.',
    expected: 'hasMatch is true for [5, 10, 11] and false for [5, 10] or an empty sequence.',
    effects: 'Stops enumerating as soon as the predicate matches.',
    fields: [{
      id: 'threshold', type: 'integer', label: 'Threshold', default: 10, min: -9999, max: 9999,
      hint: 'Threshold must be an integer from -9999 to 9999.',
    }],
    render: ({ threshold }) => 'var hasMatch = items.Any(item => item > ' + threshold + ');',
  },
  {
    id: 'csharp-linq-latest-per-group',
    topic: 'LINQ',
    language: 'C#',
    title: 'Select the latest record per group',
    description: 'Group records by account, then pick the newest timestamp in each group. Choose which revision wins when timestamps tie.',
    keywords: 'csharp dotnet linq groupby orderbydescending thenby latest newest record per group timestamp tie breaker',
    aliases: ['latest per group', 'latest record by key'],
    useCases: ['Select the latest record per account', 'Resolve tied timestamps when picking the newest record'],
    relatedIds: ['csharp-linq-duplicate-keys', 'csharp-linq-join-by-key', 'csharp-take-items'],
    example: 'North has one older revision and two revisions at the latest timestamp. South has one record.',
    prerequisites: 'System and System.Linq in scope. With sample data off, supply an in-memory sequence named updates with comparable Account, UpdatedAt, and Revision values.',
    expected: 'The default returns North revision 3 and South revision 1. Choosing Lowest revision returns North revision 2 and South revision 1.',
    effects: 'Materializes one record per account, in first-seen account order. If both the timestamp and revision tie, the first input record wins.',
    fields: [
      {
        id: 'tieBreak', type: 'choice', label: 'Timestamp tie-breaker', default: 'highest',
        options: [{ value: 'highest', label: 'Highest revision' }, { value: 'lowest', label: 'Lowest revision' }],
      },
      includeLinqSample,
    ],
    render: ({ tieBreak, includeSample }) => [
      ...(includeSample ? [
        'var start = DateTimeOffset.UnixEpoch;',
        'var updates = new[]',
        '{',
        '    (Account: "North", UpdatedAt: start, Revision: 1),',
        '    (Account: "South", UpdatedAt: start, Revision: 1),',
        '    (Account: "North", UpdatedAt: start.AddHours(1), Revision: 2),',
        '    (Account: "North", UpdatedAt: start.AddHours(1), Revision: 3),',
        '};',
        '',
      ] : []),
      'var latest = updates',
      '    .GroupBy(update => update.Account)',
      '    .Select(group => group',
      '        .OrderByDescending(update => update.UpdatedAt)',
      '        .' + (tieBreak === 'highest' ? 'ThenByDescending' : 'ThenBy') + '(update => update.Revision)',
      '        .First())',
      '    .ToArray();',
    ].join('\n'),
  },
  {
    id: 'csharp-linq-join-by-key',
    topic: 'LINQ',
    language: 'C#',
    title: 'Join two collections by key',
    description: 'Match orders to customer records by ID. Choose an inner join for matching orders or a left join to include orders whose customer is missing.',
    keywords: 'csharp dotnet linq inner join leftjoin left outer join lookup duplicate keys unmatched rows',
    aliases: ['Enumerable.Join', 'Enumerable.LeftJoin', 'join collections by key'],
    useCases: ['Join orders and customers by customer ID', 'Keep unmatched orders in a left join'],
    relatedIds: ['csharp-linq-latest-per-group', 'csharp-linq-duplicate-keys'],
    example: 'Order 101 matches two customer records for ID 7. Order 102 uses customer ID 9, which is missing.',
    prerequisites: '.NET 10 and System.Linq in scope. With sample data off, supply orders with OrderId and CustomerId and customers with Id and Name. Customer records must be reference types for the left join.',
    expected: 'The inner join returns two rows for order 101. The left join also returns order 102 with a null CustomerName.',
    effects: 'Materializes one row per matching pair. Repeated customer keys produce multiple rows. Orders stay in input order and matching customers stay in their input order.',
    fields: [
      {
        id: 'joinType', type: 'choice', label: 'Join type', default: 'inner',
        options: [{ value: 'inner', label: 'Inner join' }, { value: 'left', label: 'Left join' }],
      },
      includeLinqSample,
    ],
    render: ({ joinType, includeSample }) => [
      ...(includeSample ? [
        'var orders = new[] { (OrderId: 101, CustomerId: 7), (OrderId: 102, CustomerId: 9) };',
        'var customers = new[]',
        '{',
        '    new { Id = 7, Name = "Ada" },',
        '    new { Id = 7, Name = "Ada (legacy)" },',
        '};',
        '',
      ] : []),
      'var joined = orders',
      '    .' + (joinType === 'left' ? 'LeftJoin' : 'Join') + '(customers,',
      '        order => order.CustomerId,',
      '        customer => customer.Id,',
      '        (order, customer) => new',
      '        {',
      '            order.OrderId,',
      '            CustomerName = ' + (joinType === 'left' ? 'customer?.Name' : 'customer.Name') + ',',
      '        })',
      '    .ToArray();',
    ].join('\n'),
  },
  {
    id: 'csharp-linq-duplicate-keys',
    topic: 'LINQ',
    language: 'C#',
    title: 'Find duplicates by a composite key',
    description: 'Group inventory rows by warehouse and SKU together. Report groups that meet a configurable occurrence count.',
    keywords: 'csharp dotnet linq groupby tuple composite key duplicate groups count inventory sku',
    aliases: ['duplicates by composite key', 'GroupBy composite key'],
    useCases: ['Find repeated records using multiple key fields', 'Report duplicate inventory rows per warehouse and SKU'],
    relatedIds: ['csharp-linq-latest-per-group', 'csharp-linq-join-by-key', 'csharp-distinct-strings'],
    example: 'East has three A-10 rows and one B-20 row. West has one A-10 row.',
    prerequisites: 'System.Linq in scope. With sample data off, supply an in-memory sequence named inventory with Warehouse, Sku, and RowId values.',
    expected: 'The default returns the East/A-10 group with count 3 and row IDs 1, 3, and 5. A minimum of 4 returns no groups.',
    effects: 'Materializes the qualifying groups and their row IDs in input order. String keys use case-sensitive equality.',
    fields: [
      {
        id: 'minCount', type: 'integer', label: 'Minimum occurrences', default: 2, min: 2, max: 9999,
        hint: 'Enter a minimum occurrence count from 2 to 9999.',
      },
      includeLinqSample,
    ],
    render: ({ minCount, includeSample }) => [
      ...(includeSample ? [
        'var inventory = new[]',
        '{',
        '    (Warehouse: "East", Sku: "A-10", RowId: 1),',
        '    (Warehouse: "West", Sku: "A-10", RowId: 2),',
        '    (Warehouse: "East", Sku: "A-10", RowId: 3),',
        '    (Warehouse: "East", Sku: "B-20", RowId: 4),',
        '    (Warehouse: "East", Sku: "A-10", RowId: 5),',
        '};',
        '',
      ] : []),
      'var duplicates = inventory',
      '    .GroupBy(row => (row.Warehouse, row.Sku))',
      '    .Where(group => group.Count() >= ' + minCount + ')',
      '    .Select(group => new',
      '    {',
      '        group.Key.Warehouse,',
      '        group.Key.Sku,',
      '        Count = group.Count(),',
      '        RowIds = group.Select(row => row.RowId).ToArray(),',
      '    })',
      '    .ToArray();',
    ].join('\n'),
  },
  {
    id: 'xpath-contains-text',
    topic: 'Value matching',
    language: 'XPath',
    title: 'Find named elements containing text',
    description: 'Select elements of a given name whose normalized text contains a case-sensitive phrase.',
    keywords: 'xml xpath html contains text match normalized whitespace',
    aliases: ['XPath contains', 'normalize-space'],
    useCases: ['Find a link whose visible label includes a phrase'],
    relatedIds: ['xpath-match-attribute', 'xpath-direct-children'],
    example: 'Find links containing "Install guide", including a link with extra spaces in its text.',
    prerequisites: 'An XPath 1.0 evaluator and an XML document with link elements in no namespace.',
    expected: 'In <a>Install   guide</a> and <a>Release notes</a>, only the first link matches.',
    effects: 'Evaluates each selected element’s string value, including descendant text.',
    fields: [
      { id: 'element', type: 'text', label: 'Element name', default: 'a', pattern: xpathNamePattern, hint: 'Use an unprefixed ASCII element name.' },
      { id: 'text', type: 'text', label: 'Text to find', default: 'Install guide' },
    ],
    render: ({ element, text }) => '//' + element + '[contains(normalize-space(.), ' + xpathLiteral(text) + ')]',
  },
  {
    id: 'xpath-direct-children',
    topic: 'Tree navigation',
    language: 'XPath',
    title: 'Select direct children by element name',
    description: 'Find named elements immediately inside a named parent.',
    keywords: 'xml xpath html child axis direct nested element',
    aliases: ['XPath child axis', 'direct child elements'],
    useCases: ['Find only the immediate line items in each order'],
    relatedIds: ['xpath-match-attribute', 'xpath-contains-text'],
    example: 'Find item elements that are immediate children of an order.',
    prerequisites: 'An XPath 1.0 evaluator and an XML document with elements in no namespace.',
    expected: 'For <order><item/><group><item/></group></order>, the first item matches.',
    effects: 'Returns matching element nodes in document order.',
    fields: [
      { id: 'parent', type: 'text', label: 'Parent name', default: 'order', pattern: xpathNamePattern, hint: 'Use an unprefixed ASCII element name.' },
      { id: 'child', type: 'text', label: 'Child name', default: 'item', pattern: xpathNamePattern, hint: 'Use an unprefixed ASCII element name.' },
    ],
    render: ({ parent, child }) => '//' + parent + '/' + child,
  },
  {
    id: 'git-line-history',
    topic: 'History',
    language: 'Git',
    title: 'Trace changes to a line',
    description: 'Follow a line backward from the current commit to see when it was added or changed.',
    keywords: 'git log -L line history commit introduced changed blame patch origin',
    aliases: ['git log -L', 'line history'],
    useCases: ['Find the commit that introduced a line', 'See what a specific line used to contain'],
    relatedIds: ['git-file-history', 'git-tag-commits'],
    example: 'Trace line 3 of src/app.js back through its history.',
    prerequisites: 'Git and a POSIX shell. Run from the repository root. The file and line must exist in HEAD.',
    expected: 'Commit messages and patches for the selected line, starting with the most recent change.',
    effects: 'Reads the commit history for the selected line.',
    fields: [
      { id: 'path', type: 'text', label: 'File path', default: 'src/app.js' },
      { id: 'line', type: 'integer', label: 'Line number', default: 3, min: 1, max: 999999, hint: 'Enter a line number from 1 to 999999.' },
    ],
    render: ({ path, line }) => 'git log -L ' + shellLiteral(line + ',' + line + ':' + path),
  },
  {
    id: 'git-tag-commits',
    topic: 'Branches and tags',
    language: 'Git',
    title: 'Review commits between two tags',
    description: 'List commits reachable from the target tag that are outside the base tag’s history.',
    keywords: 'git log release tag tags range two-dot compare changelog notes',
    aliases: ['git log tag range', 'commits between tags'],
    useCases: ['Review changes between two releases', 'Prepare release notes from Git tags'],
    relatedIds: ['git-compare-branch', 'git-line-history'],
    example: 'List commits in v1.1.0 that are outside the history of v1.0.0.',
    prerequisites: 'Git and a POSIX shell. Both tags must exist in the local repository.',
    expected: 'One line per included commit, with a short hash and subject.',
    effects: 'Reads commit history.',
    fields: [
      { id: 'base', type: 'text', label: 'Base tag', default: 'v1.0.0' },
      { id: 'target', type: 'text', label: 'Target tag', default: 'v1.1.0' },
    ],
    render: ({ base, target }) => 'git log --oneline --end-of-options '
      + shellLiteral('refs/tags/' + base.trim() + '..refs/tags/' + target.trim()) + ' --',
  },
  {
    id: 'csharp-regex-named-group',
    topic: 'Regex',
    language: 'C#',
    title: 'Extract a named Regex group from a log line',
    description: 'Match a structured line and read one named capture, with a null result if the group did not match.',
    keywords: 'csharp dotnet regex regular expressions named capture groups parse log level',
    aliases: ['Regex.Match', 'named capture group'],
    useCases: ['Extract a log level from a structured line', 'Read a named group from a regular expression'],
    relatedIds: ['csharp-regex-multiline-logs', 'csharp-regex-reformat-date', 'csharp-regex-repeated-words', 'csharp-regex-generated', 'csharp-regex-escape-literal'],
    example: 'Extract the level from WARN Disk latency is high.',
    prerequisites: 'System and System.Text.RegularExpressions in scope. Supply an input string and a pattern that defines the selected group.',
    expected: 'The default inputs produce WARN. A line with no capture in the selected group produces null.',
    effects: 'Reads the input. The regex API can throw RegexMatchTimeoutException if a match exceeds the configured timeout.',
    fields: [
      { id: 'input', type: 'text', label: 'Input text', default: 'WARN Disk latency is high', allowEmpty: true },
      { id: 'pattern', type: 'text', label: '.NET regex pattern', default: String.raw`^(?<level>[A-Z]+)\s+(?<message>.+)$` },
      { id: 'group', type: 'text', label: 'Group name', default: 'level', pattern: '[A-Za-z][A-Za-z0-9]*', hint: 'Use a group name starting with an ASCII letter, followed by letters or digits.' },
      regexTimeoutField,
    ],
    render: ({ input, pattern, group, timeout }) => [
      'var match = Regex.Match(' + csharpStringLiteral(input) + ', ' + csharpStringLiteral(pattern) + ',',
      '    RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(' + timeout + '));',
      'var group = match.Groups[' + csharpStringLiteral(group) + '];',
      'var value = group.Success ? group.Value : null;',
    ].join('\n'),
  },
  {
    id: 'csharp-regex-reformat-date',
    topic: 'Regex',
    language: 'C#',
    title: 'Reformat date text with Regex substitutions',
    description: 'Use Regex.Replace and named captures to rearrange the year, month, and day in date-shaped text.',
    keywords: 'csharp dotnet regex regular expressions replace named capture template date format substitution',
    aliases: ['Regex.Replace', 'regex named substitutions'],
    useCases: ['Reorder date components in text', 'Build a replacement string from named captures'],
    relatedIds: ['csharp-regex-named-group', 'csharp-regex-repeated-words'],
    example: 'Rewrite Due 2026-11-21 as Due 21/11/2026.',
    prerequisites: 'System and System.Text.RegularExpressions in scope. The default replacement uses the day, month, and year named groups.',
    expected: 'The default inputs produce Due 21/11/2026. The pattern matches digit shapes, so dates such as 2026-02-31 also match.',
    effects: 'Creates a string with all matching date shapes rewritten. A match can throw RegexMatchTimeoutException.',
    fields: [
      { id: 'input', type: 'text', label: 'Input text', default: 'Due 2026-11-21', allowEmpty: true },
      { id: 'replacement', type: 'text', label: 'Replacement template', default: '${day}/${month}/${year}', allowEmpty: true },
      regexTimeoutField,
    ],
    render: ({ input, replacement, timeout }) => [
      'var result = Regex.Replace(' + csharpStringLiteral(input) + ',',
      '    ' + csharpStringLiteral(String.raw`\b(?<year>[0-9]{4})-(?<month>[0-9]{2})-(?<day>[0-9]{2})\b`) + ',',
      '    ' + csharpStringLiteral(replacement) + ', RegexOptions.CultureInvariant,',
      '    TimeSpan.FromMilliseconds(' + timeout + '));',
    ].join('\n'),
  },
  {
    id: 'csharp-regex-repeated-words',
    topic: 'Regex',
    language: 'C#',
    title: 'Find repeated words with a Regex backreference',
    description: 'Capture a word and use a named backreference to find it again immediately after whitespace.',
    keywords: 'csharp dotnet regex regular expressions backreference repeated duplicate consecutive words',
    aliases: ['Regex.IsMatch', 'regex backreference'],
    useCases: ['Detect accidental duplicate words in a sentence', 'Find two consecutive copies of the same word'],
    relatedIds: ['csharp-regex-named-group', 'csharp-regex-reformat-date'],
    example: 'Find the repeated word in Read the The instructions.',
    prerequisites: 'System and System.Text.RegularExpressions in scope. Enable Ignore case to match repeats with different capitalization.',
    expected: 'The default inputs produce true. Turning off Ignore case produces false for the same sentence.',
    effects: 'Reads the input and reports whether a match exists. A match can throw RegexMatchTimeoutException.',
    fields: [
      { id: 'input', type: 'text', label: 'Input text', default: 'Read the The instructions.', allowEmpty: true },
      { id: 'ignoreCase', type: 'toggle', label: 'Ignore case', default: true },
      regexTimeoutField,
    ],
    render: ({ input, ignoreCase, timeout }) => {
      return [
        'var hasRepeatedWord = Regex.IsMatch(' + csharpStringLiteral(input) + ',',
        '    ' + csharpStringLiteral(String.raw`\b(?<word>[\p{L}\p{M}]+)\s+\k<word>\b`) + ',',
        '    ' + regexOptions(ignoreCase) + ', TimeSpan.FromMilliseconds(' + timeout + '));',
      ].join('\n');
    },
  },
  {
    id: 'csharp-regex-generated',
    topic: 'Regex',
    language: 'C#',
    title: 'Validate ticket IDs with GeneratedRegex',
    description: 'Generate a reusable regex at compile time to validate a ticket prefix followed by a fixed number of digits.',
    keywords: 'csharp dotnet regex source generator compile time partial method ticket id validate full string',
    aliases: ['GeneratedRegex', '[GeneratedRegex(', 'regex source generator'],
    useCases: ['Validate ticket identifiers in an application', 'Reuse a constant regex pattern across calls'],
    relatedIds: ['csharp-regex-named-group', 'csharp-regex-escape-literal', 'csharp-regex-mask-ids', 'csharp-regex-match-timeout'],
    example: 'Validate identifiers like OPS-0042 using the prefix OPS and four digits.',
    prerequisites: 'A .NET 7 or later project. Put the generated class in its own source file and call TicketIds.Pattern().IsMatch(ticketId) within the project.',
    expected: 'With the default settings, OPS-0042 matches. OPS-42, lowercase ops-0042, and OPS-0042 followed by a newline fail.',
    effects: 'The SDK generates the implementation during the build. An evaluated match can throw RegexMatchTimeoutException.',
    fields: [
      { id: 'prefix', type: 'text', label: 'Ticket prefix', default: 'OPS', pattern: '[A-Z]{1,12}', hint: 'Use 1 to 12 uppercase ASCII letters.' },
      { id: 'digits', type: 'integer', label: 'Digit count', default: 4, min: 1, max: 12, hint: 'Enter a digit count from 1 to 12.' },
      { id: 'ignoreCase', type: 'toggle', label: 'Ignore case', default: false },
      regexTimeoutField,
    ],
    render: ({ prefix, digits, ignoreCase, timeout }) => {
      const pattern = '\\A' + prefix + '-[0-9]{' + digits + '}\\z';
      return [
        'using System.Text.RegularExpressions;',
        '',
        'internal static partial class TicketIds',
        '{',
        '    [GeneratedRegex(' + csharpStringLiteral(pattern) + ', ' + regexOptions(ignoreCase) + ', ' + timeout + ')]',
        '    internal static partial Regex Pattern();',
        '}',
      ].join('\n');
    },
  },
  {
    id: 'csharp-regex-escape-literal',
    topic: 'Regex',
    language: 'C#',
    title: 'Search for literal text with Regex.Escape',
    description: 'Use a user-supplied term as literal text inside a regex. Optionally search for the term after a label.',
    keywords: 'csharp dotnet regex escape literal user input punctuation metacharacters search label',
    aliases: ['Regex.Escape', 'escape regex punctuation'],
    useCases: ['Search for C++ without treating plus signs as operators', 'Match a value literally inside a structured line'],
    relatedIds: ['csharp-regex-named-group', 'csharp-regex-generated'],
    example: 'Match the literal value C++ after the language: label in Build language: C++.',
    prerequisites: 'System and System.Text.RegularExpressions in scope. Enter a literal label or leave it empty to find the term anywhere.',
    expected: 'The default inputs produce true. Replacing C++ with C# in the input produces false.',
    effects: 'Escapes the label and term before matching. A match can throw RegexMatchTimeoutException.',
    fields: [
      { id: 'input', type: 'text', label: 'Input text', default: 'Build language: C++', allowEmpty: true },
      { id: 'label', type: 'text', label: 'Label (optional)', default: 'language:', allowEmpty: true },
      { id: 'term', type: 'text', label: 'Literal term', default: 'C++' },
      { id: 'ignoreCase', type: 'toggle', label: 'Ignore case', default: false },
      regexTimeoutField,
    ],
    render: ({ input, label, term, ignoreCase, timeout }) => {
      const literal = 'Regex.Escape(' + csharpStringLiteral(term) + ')';
      const pattern = label
        ? 'Regex.Escape(' + csharpStringLiteral(label) + ') + @"\\s*" + ' + literal
        : literal;
      return [
        'var pattern = ' + pattern + ';',
        'var found = Regex.IsMatch(' + csharpStringLiteral(input) + ', pattern,',
        '    ' + regexOptions(ignoreCase) + ', TimeSpan.FromMilliseconds(' + timeout + '));',
      ].join('\n');
    },
  },
  {
    id: 'csharp-regex-multiline-logs',
    topic: 'Regex',
    language: 'C#',
    title: 'Extract structured records from a multiline log',
    description: 'Match timestamped log lines and project their named captures into records with Timestamp, Level, and Message fields.',
    keywords: 'csharp dotnet regex matches multiline named groups structured log parsing severity',
    aliases: ['Regex.Matches', 'multiline log parsing'],
    useCases: ['Extract error and warning records from application logs', 'Parse multiple log lines into structured records'],
    relatedIds: ['csharp-regex-named-group', 'csharp-regex-escape-literal', 'csharp-regex-mask-ids', 'csharp-regex-match-timeout'],
    example: 'Parse a four-line worker log with INFO, WARN, and ERROR records and a continuation line.',
    prerequisites: 'System, System.Linq, and System.Text.RegularExpressions in scope. Each record starts with a UTC timestamp in yyyy-MM-ddTHH:mm:ssZ form, followed by INFO, WARN, or ERROR and a message.',
    expected: 'The default search returns three records in input order. The WARN record has Timestamp 2026-11-21T09:10:03Z and Message “Queue depth is 42”. Choosing Warnings and errors returns the final two records.',
    effects: 'Reads the input and materializes the matches as an array. Continuation lines and blank messages are skipped. Timestamp is captured as text. Matching can throw RegexMatchTimeoutException.',
    fields: [
      {
        id: 'input', type: 'text', multiline: true, label: 'Log text', allowEmpty: true,
        default: [
          '2026-11-21T09:10:00Z INFO Worker started',
          '2026-11-21T09:10:03Z WARN Queue depth is 42',
          'Detail: retry after 3 seconds',
          '2026-11-21T09:10:07Z ERROR Processing failed',
        ].join('\n'),
      },
      {
        id: 'levels', type: 'choice', label: 'Log levels', default: 'all',
        options: [
          { value: 'all', label: 'All supported levels' },
          { value: 'warnings', label: 'Warnings and errors' },
          { value: 'errors', label: 'Errors only' },
        ],
      },
      regexTimeoutField,
    ],
    render: ({ input, levels, timeout }) => {
      const severity = { all: 'INFO|WARN|ERROR', warnings: 'WARN|ERROR', errors: 'ERROR' }[levels];
      const pattern = '^(?<timestamp>[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z)'
        + '[ \\t]+(?<level>' + severity + ')[ \\t]+(?<message>[^ \\t\\r\\n][^\\r\\n]*)\\r?$';
      return [
        'var log = ' + csharpMultilineLiteral(input) + ';',
        'var records = Regex.Matches(log, ' + csharpStringLiteral(pattern) + ',',
        '        RegexOptions.Multiline | RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(' + timeout + '))',
        '    .Cast<Match>()',
        '    .Select(match => new',
        '    {',
        '        Timestamp = match.Groups["timestamp"].Value,',
        '        Level = match.Groups["level"].Value,',
        '        Message = match.Groups["message"].Value,',
        '    })',
        '    .ToArray();',
      ].join('\n');
    },
  },
  {
    id: 'csharp-regex-mask-ids',
    topic: 'Regex',
    language: 'C#',
    title: 'Mask IDs while keeping the last four digits',
    description: 'Use a Regex match evaluator to mask the leading digits of a labeled numeric ID while retaining its last four digits.',
    keywords: 'csharp dotnet regex replace mask redact identifiers trailing digits logs match evaluator',
    aliases: ['MatchEvaluator', 'mask IDs'],
    useCases: ['Mask numeric account IDs in logs', 'Keep the last four digits of an identifier'],
    relatedIds: ['csharp-regex-multiline-logs', 'csharp-regex-reformat-date', 'csharp-regex-match-timeout'],
    example: 'Mask accountId=1234567890 in a log line that also contains requestId=9876543210.',
    prerequisites: 'C# 8 or later with System and System.Text.RegularExpressions in scope. Enter a case-sensitive field label. The example recognizes fields separated by whitespace, commas, or semicolons, and accepts = or : after the label.',
    expected: 'The default inputs produce accountId=******7890 requestId=9876543210.',
    effects: 'Returns a new string. IDs with four or fewer digits, mixed alphanumeric IDs, and other fields stay as written. Matching can throw RegexMatchTimeoutException.',
    fields: [
      {
        id: 'input', type: 'text', multiline: true, label: 'Log text', allowEmpty: true,
        default: 'accountId=1234567890 requestId=9876543210',
      },
      { id: 'label', type: 'text', label: 'ID label', default: 'accountId' },
      {
        id: 'mask', type: 'choice', label: 'Mask character', default: '*',
        options: [{ value: '*', label: 'Asterisk (*)' }, { value: 'X', label: 'X' }],
      },
      regexTimeoutField,
    ],
    render: ({ input, label, mask, timeout }) => [
      'var input = ' + csharpMultilineLiteral(input) + ';',
      'var label = Regex.Escape(' + csharpStringLiteral(label) + ');',
      String.raw`var pattern = $@"(?<![^\s,;])(?<prefix>{label}[ \t]*[:=][ \t]*)(?<id>[0-9]{{5,}})(?=\z|[\s,;])";`,
      'var masked = Regex.Replace(input, pattern, match =>',
      '{',
      '    var id = match.Groups["id"].Value;',
      '    return match.Groups["prefix"].Value + new string(\'' + mask + '\', id.Length - 4) + id[^4..];',
      '}, RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(' + timeout + '));',
    ].join('\n'),
  },
  {
    id: 'csharp-regex-match-timeout',
    topic: 'Regex',
    language: 'C#',
    title: 'Handle a Regex match timeout',
    description: 'Set a match timeout and handle three outcomes separately: a match, no match, and a timed-out attempt.',
    keywords: 'csharp dotnet regex ismatch time limit timeout exception nullable bool',
    aliases: ['RegexMatchTimeoutException', 'regex match timeout'],
    useCases: ['Distinguish a timeout from no match', 'Handle a regex match that exceeds its time limit'],
    relatedIds: ['csharp-regex-multiline-logs', 'csharp-regex-mask-ids', 'csharp-regex-generated'],
    example: 'Check a release label against an anchored pattern and map the result to a status message.',
    prerequisites: 'C# 8 or later with System and System.Text.RegularExpressions in scope. Enter a valid .NET regex pattern.',
    expected: 'The default inputs produce “Matched”. Input containing a space produces “No match”. If matching exceeds the time limit, the result is “Timed out”.',
    effects: 'Returns null for a timeout. Invalid patterns still raise an exception.',
    fields: [
      { id: 'input', type: 'text', multiline: true, label: 'Input text', default: 'release-2026', allowEmpty: true },
      { id: 'pattern', type: 'text', label: 'Regex pattern', default: String.raw`\A[a-z][a-z0-9-]{2,31}\z` },
      regexTimeoutField,
    ],
    render: ({ input, pattern, timeout }) => [
      'static bool? TryMatch(string input, string pattern)',
      '{',
      '    try',
      '    {',
      '        return Regex.IsMatch(input, pattern, RegexOptions.CultureInvariant,',
      '            TimeSpan.FromMilliseconds(' + timeout + '));',
      '    }',
      '    catch (RegexMatchTimeoutException)',
      '    {',
      '        return null;',
      '    }',
      '}',
      '',
      'var input = ' + csharpMultilineLiteral(input) + ';',
      'var outcome = TryMatch(input, ' + csharpStringLiteral(pattern) + ');',
      'var message = outcome switch',
      '{',
      '    true => "Matched",',
      '    false => "No match",',
      '    null => "Timed out",',
      '};',
    ].join('\n'),
  },
];

export function buildSnippet(snippet, values) {
  const parsed = parseValues(snippet, values);
  if (parsed.error) return parsed;
  return { output: snippet.render(parsed.parameters), parameters: parsed.parameters };
}

const normalizeSearch = (value) => value.toLowerCase().trim().replace(/\s+/g, ' ');
const taskWords = new Set(['a', 'an', 'i', 'in', 'me', 'of', 'the', 'to', 'with']);

const searchIndex = snippets.map((snippet) => {
  const names = [snippet.title, ...snippet.aliases].map(normalizeSearch);
  const exampleCode = normalizeSearch(buildSnippet(snippet, defaultValues(snippet)).output);
  const searchable = normalizeSearch([
    ...names, snippet.language, snippet.description, snippet.keywords, snippet.example,
    ...snippet.useCases, exampleCode,
  ].join(' '));
  return { snippet, names, exampleCode, searchable };
});

function relevance(entry, phrase, terms) {
  if (entry.names.includes(phrase)) return 4;
  if (entry.exampleCode.includes(phrase)) return 3;
  if (entry.searchable.includes(phrase)) return 2;
  return terms.every((term) => entry.searchable.includes(term)) ? 1 : 0;
}

export function findSnippets(query, language) {
  const phrase = normalizeSearch(query);
  const words = phrase.split(' ');
  const taskTerms = words.filter((word) => !taskWords.has(word));
  const terms = taskTerms.length ? taskTerms : words;

  return searchIndex
    .filter(({ snippet }) => !language || snippet.language === language)
    .map((entry) => ({ snippet: entry.snippet, score: phrase ? relevance(entry, phrase, terms) : 1 }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ snippet }) => snippet);
}

export function browseSnippets(query, { language, topic } = {}) {
  const matches = query.trim() ? findSnippets(query, language) : snippets;
  return matches.filter((snippet) =>
    (!language || snippet.language === language) && (!topic || snippet.topic === topic));
}

const titleOrder = new Intl.Collator('en', { sensitivity: 'base' });

export function sortSnippetResults(entries, favorites) {
  return [...entries].sort((left, right) =>
    Number(favorites.has(right.id)) - Number(favorites.has(left.id))
    || titleOrder.compare(left.title, right.title));
}

export const snippetsPerPage = 8;

export function paginateSnippets(entries, requestedPage) {
  const pageCount = Math.max(1, Math.ceil(entries.length / snippetsPerPage));
  const page = Number.isInteger(requestedPage) ? Math.max(1, Math.min(requestedPage, pageCount)) : 1;
  const start = (page - 1) * snippetsPerPage;
  return { page, pageCount, items: entries.slice(start, start + snippetsPerPage) };
}

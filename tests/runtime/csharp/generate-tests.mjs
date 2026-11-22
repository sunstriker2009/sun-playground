import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildSnippet, defaultValues, snippets } from '../../../app/catalog.mjs';
import { linqCases } from './linq-cases.mjs';

const parser = 'csharp-regex-multiline-logs';
const masking = 'csharp-regex-mask-ids';
const timeout = 'csharp-regex-match-timeout';

const sampleLog = [
  '2026-11-21T09:10:00Z INFO Worker started',
  '2026-11-21T09:10:03Z WARN Queue depth is 42',
  'Continuation line',
  '2026-11-21T09:10:05Z WARN ',
  '2026-11-21T09:10:07Z ERROR Processing failed',
];

const cases = [
  {
    name: 'Log parser extracts timestamp, level, and message',
    id: parser,
    assertions: [
      'Equal(3, records.Length);',
      'Equal("2026-11-21T09:10:03Z", records[1].Timestamp);',
      'Equal("WARN", records[1].Level);',
      'Equal("Queue depth is 42", records[1].Message);',
    ],
  },
  {
    name: 'Log parser filters CRLF records and skips blank messages',
    id: parser,
    values: { input: sampleLog.join('\r\n'), levels: 'warnings' },
    assertions: [
      'Equal(2, records.Length);',
      'Equal("WARN", records[0].Level);',
      'Equal("ERROR", records[1].Level);',
      'Equal("Processing failed", records[1].Message);',
    ],
  },
  {
    name: 'Log parser handles empty input',
    id: parser,
    values: { input: '' },
    assertions: ['Equal(0, records.Length);'],
  },
  {
    name: 'Masking keeps four digits and preserves another field',
    id: masking,
    assertions: ['Equal("accountId=******7890 requestId=9876543210", masked);'],
  },
  {
    name: 'Masking handles literal labels, delimiters, and short or mixed IDs',
    id: masking,
    values: {
      label: 'account.id',
      mask: 'X',
      input: 'account.id : 12345; accountXid=123456, myaccount.id=987654\r\n'
        + 'account.id=1234 account.id=123456-7 account.id=123456abc\r\n'
        + 'account.id=12345678\taccount.id=00001',
    },
    assertions: [
      String.raw`Equal("account.id : X2345; accountXid=123456, myaccount.id=987654\r\n"`,
      String.raw`    + "account.id=1234 account.id=123456-7 account.id=123456abc\r\n"`,
      String.raw`    + "account.id=XXXX5678\taccount.id=X0001", masked);`,
    ],
  },
  {
    name: 'Masking handles empty input',
    id: masking,
    values: { input: '' },
    assertions: ['Equal("", masked);'],
  },
  {
    name: 'Regex check reports a match',
    id: timeout,
    assertions: ['Equal<bool?>(true, outcome);', 'Equal("Matched", message);'],
  },
  {
    name: 'Regex check reports a completed non-match',
    id: timeout,
    values: { input: 'release 2026' },
    assertions: ['Equal<bool?>(false, outcome);', 'Equal("No match", message);'],
  },
  {
    name: 'Regex check distinguishes a real timeout from no match',
    id: timeout,
    values: { timeout: 10 },
    assertions: [
      'Equal("Matched", message);',
      '// A large valid input and a linear, capture-heavy pattern exercise .NET’s timeout check.',
      'var longInput = string.Concat(Enumerable.Repeat("A1", 4_000_000));',
      String.raw`Equal<bool?>(null, TryMatch(longInput, @"\A(?:(?<letter>[A-Z])[0-9])+\z"));`,
    ],
  },
  {
    name: 'Regex check propagates malformed patterns',
    id: timeout,
    assertions: [
      'Equal("Matched", message);',
      'try',
      '{',
      '    TryMatch("release", "[");',
      '    throw new Exception("Expected RegexParseException.");',
      '}',
      'catch (RegexParseException) { }',
    ],
  },
  ...linqCases,
];

function generateCase({ name, id, values, setup = [], assertions }) {
  const snippet = snippets.find((entry) => entry.id === id);
  if (!snippet) throw new Error(`Missing catalog snippet: ${id}`);
  const { output, error } = buildSnippet(snippet, { ...defaultValues(snippet), ...values });
  if (error) throw new Error(`${id} (${name}): ${error}`);

  return [
    `Console.WriteLine(${JSON.stringify(`${id}: ${name}`)});`,
    '{',
    ...[...setup, ...output.split('\n'), ...assertions].map((line) => line ? '    ' + line : ''),
    '}',
  ].join('\n');
}

const outputPath = process.argv[2];
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, [
  'using System;',
  'using System.Linq;',
  'using System.Text.RegularExpressions;',
  '',
  'static void Equal<T>(T expected, T actual)',
  '{',
  '    if (!Equals(expected, actual))',
  '        throw new Exception($"Expected {expected}, got {actual}.");',
  '}',
  '',
  cases.map(generateCase).join('\n\n'),
  '',
  `Console.WriteLine("Passed ${cases.length} C# runtime cases.");`,
  '',
].join('\n'));

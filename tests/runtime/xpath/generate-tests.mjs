import { buildSnippet, defaultValues, snippets } from '../../../app/catalog.mjs';

const xml = `
<catalog xmlns:demo="urn:demo">
  <task id="ready-first" data-state="ready"/>
  <task id="queued" data-state="queued"/>
  <group>
    <task id="ready-nested" data-state="ready"/>
    <task id="empty" data-state=""/>
    <task id="missing"/>
    <task id="namespaced" demo:data-state="ready"/>
    <task id="quoted-attribute" data-label="O'Reilly &quot;guide&quot;"/>
    <task id="near-attribute" data-label="O'Reilly guide"/>
  </group>
  <links>
    <a id="spaced-link"> Install&#x9;   guide </a>
    <a id="nested-link">Install <strong>guide</strong> for Linux</a>
    <a id="case-mismatch">install guide</a>
    <a id="notes-link">Release notes</a>
    <span id="other-element">Install guide</span>
    <a id="quoted-link">Read O'Reilly "guide" today</a>
  </links>
  <order>
    <item id="first-item"/>
    <group><item id="nested-item"/></group>
    <item id="second-item"/>
  </order>
  <order><item id="third-item"/></order>
  <inventory><item id="inventory-item"/></inventory>
</catalog>`;

const attribute = 'xpath-match-attribute';
const text = 'xpath-contains-text';
const children = 'xpath-direct-children';

const cases = [
  {
    name: 'Attribute equality finds unprefixed attributes at any depth in document order',
    id: attribute,
    expected: ['ready-first', 'ready-nested'],
  },
  {
    name: 'Empty attribute value matches an existing empty attribute',
    id: attribute,
    values: { value: '' },
    expected: ['empty'],
  },
  {
    name: 'Attribute equality handles both quote characters in the value',
    id: attribute,
    values: { attribute: 'data-label', value: `O'Reilly "guide"` },
    expected: ['quoted-attribute'],
  },
  {
    name: 'Attribute equality can return an empty node set',
    id: attribute,
    values: { value: 'archived' },
    expected: [],
  },
  {
    name: 'Text matching normalizes whitespace and includes descendant text',
    id: text,
    expected: ['spaced-link', 'nested-link'],
  },
  {
    name: 'Text matching handles both quote characters in a phrase',
    id: text,
    values: { text: `O'Reilly "guide"` },
    expected: ['quoted-link'],
  },
  {
    name: 'Text matching can select a different element name',
    id: text,
    values: { element: 'span' },
    expected: ['other-element'],
  },
  {
    name: 'Child selection skips nested items and follows document order',
    id: children,
    expected: ['first-item', 'second-item', 'third-item'],
  },
  {
    name: 'Child selection uses the requested parent and child names',
    id: children,
    values: { parent: 'links', child: 'span' },
    expected: ['other-element'],
  },
];

const generatedCases = cases.map(({ name, id, values, expected }) => {
  const snippet = snippets.find((entry) => entry.id === id);
  if (!snippet) throw new Error(`Missing catalog snippet: ${id}`);
  const { output, error } = buildSnippet(snippet, { ...defaultValues(snippet), ...values });
  if (error) throw new Error(`${id} (${name}): ${error}`);
  return { Name: name, Expression: output, ExpectedIds: expected };
});

console.log(JSON.stringify({ Xml: xml, Cases: generatedCases }));

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileFunction } from 'node:vm';
import { buildSnippet, defaultValues, snippets } from '../../../app/catalog.mjs';

function runSnippet(id, items, result, overrides = {}) {
  const snippet = snippets.find((entry) => entry.id === id);
  assert.ok(snippet, `Missing catalog snippet: ${id}`);
  const { output, error } = buildSnippet(snippet, { ...defaultValues(snippet), ...overrides });
  assert.ok(output, error ?? `Empty generated code: ${id}`);

  // Run the checked-in builder's output against test data supplied as an argument.
  const execute = compileFunction(`"use strict";\n${output}\nreturn ${result};`, ['items'], {
    filename: `${id}.generated.js`,
  });
  return execute(items);
}

test('filter selects the default matching records in order and keeps object identity', () => {
  const first = Object.freeze({ status: 'active', id: 1 });
  const last = Object.freeze({ status: 'active', id: 3 });
  const items = Object.freeze([first, Object.freeze({ status: 'archived', id: 2 }), last]);
  const matches = runSnippet('js-filter-array', items, 'matches');
  assert.deepEqual(matches, [first, last]);
  assert.notEqual(matches, items);
  assert.equal(matches[0], first);
  assert.equal(matches[1], last);
});

test('filter handles quotes and line breaks in property names and values', () => {
  const property = `Team's "status"\nlabel`;
  const value = 'in "review"\nnow';
  const selected = { [property]: value };
  const items = [{ [property]: 'in review' }, selected, {}];
  assert.deepEqual(runSnippet('js-filter-array', items, 'matches', { property, value }), [selected]);
});

test('filter matches an empty string and preserves strict comparison', () => {
  const empty = { status: '' };
  const items = [{}, { status: 0 }, { status: false }, empty];
  assert.deepEqual(runSnippet('js-filter-array', items, 'matches', { value: '' }), [empty]);
});

test('join uses the default separator and handles an empty array', () => {
  assert.equal(runSnippet('js-join-array', ['alpha', 'beta', 'gamma'], 'joined'), 'alpha, beta, gamma');
  assert.equal(runSnippet('js-join-array', [], 'joined'), '');
});

test('join handles custom separators and coerces non-string values', () => {
  const separator = '\n"|"\n';
  assert.equal(runSnippet('js-join-array', ['alpha', 4, false], 'joined', { separator }),
    ['alpha', '4', 'false'].join(separator));
});

test('join accepts an empty separator', () => {
  assert.equal(runSnippet('js-join-array', ['alpha', 'beta'], 'joined', { separator: '' }), 'alphabeta');
});

test('property extraction preserves order and missing positions', () => {
  assert.deepEqual(runSnippet('js-map-property', [{ name: 'Ada' }, {}, { name: 'Lin' }], 'values'),
    ['Ada', undefined, 'Lin']);
});

test('property extraction returns original values for a customized key', () => {
  const property = `Owner's "display name"`;
  const items = [{ [property]: null }, { [property]: 0 }, { [property]: false }, { [property]: '' }];
  assert.deepEqual(runSnippet('js-map-property', items, 'values', { property }), [null, 0, false, '']);
});

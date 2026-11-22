import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { buildSnippet, defaultValues, snippets } from '../../../app/catalog.mjs';

const appPath = 'src/app.js';
const quotedPath = "src/my team's [draft].js";
const similarPath = "src/my team's d.js";
const releaseBranch = 'release/v1';
const env = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  LC_ALL: 'C',
};

let repository;

after(() => {
  if (repository) rmSync(repository, { recursive: true, force: true });
});

function git(args, extraEnv = {}) {
  return execFileSync('git', args, {
    cwd: repository,
    env: { ...env, ...extraEnv },
    encoding: 'utf8',
    timeout: 10_000,
  });
}

function commit(subject, date, files) {
  for (const [path, contents] of Object.entries(files)) {
    writeFileSync(join(repository, path), contents);
  }
  git(['add', '--all']);
  git(['commit', '-m', subject], { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
}

before(() => {
  repository = mkdtempSync(join(tmpdir(), 'codefolio-git-'));
  git(['init', '--initial-branch=main', '--template=']);
  git(['config', 'user.name', 'CodeFolio Test']);
  git(['config', 'user.email', 'codefolio@example.invalid']);
  mkdirSync(join(repository, 'src'));
  commit('Initial application', '2025-02-01T12:00:00Z', {
    [appPath]: '// App\n\nconst status = "draft";\n',
    [quotedPath]: 'const ready = false;\n',
    [similarPath]: 'const label = "old";\n',
  });
  git(['tag', 'v1.0.0']);
  git(['branch', 'archive']);

  commit('Add main-only notes', '2025-02-02T12:00:00Z', { 'notes.txt': 'Work on main\n' });
  git(['switch', '-q', '-c', releaseBranch, 'v1.0.0']);
  commit('Mark application ready', '2025-02-03T12:00:00Z', {
    [appPath]: '// App\n\nconst status = "ready";\n',
    [quotedPath]: 'const ready = true;\n',
  });
  commit('Update similarly named file', '2025-02-04T12:00:00Z', {
    [similarPath]: 'const label = "new";\n',
  });
  git(['tag', 'v1.1.0']);
  git(['switch', '-q', '-c', 'docs', 'main']);
  commit('Add guide', '2025-02-05T12:00:00Z', { 'guide.txt': 'Guide\n' });
  git(['switch', '-q', releaseBranch]);
});

function runSnippet(id, values = {}) {
  const snippet = snippets.find((entry) => entry.id === id);
  assert.ok(snippet, `Missing catalog snippet: ${id}`);
  const { output, error } = buildSnippet(snippet, { ...defaultValues(snippet), ...values });
  assert.ok(output, error ?? `Empty catalog snippet: ${id}`);
  return execFileSync('sh', ['-c', output], {
    cwd: repository,
    env,
    encoding: 'utf8',
    timeout: 10_000,
  });
}

function subjects(output) {
  return output.trimEnd().split('\n').map((line) => {
    const match = /^[0-9a-f]+ (.+)$/.exec(line);
    assert.ok(match, `Expected a commit hash and subject, got: ${line}`);
    return match[1];
  });
}

test('file history follows HEAD and shows only commits touching the chosen file', () => {
  assert.deepEqual(subjects(runSnippet('git-file-history')), [
    'Mark application ready',
    'Initial application',
  ]);
  assert.deepEqual(subjects(runSnippet('git-file-history', { limit: 1 })), ['Mark application ready']);
});

test('file history can read a different branch with file status', () => {
  const output = runSnippet('git-file-history', { path: 'notes.txt', branch: 'main', fileChanges: true });
  assert.match(output, /^[0-9a-f]+ Add main-only notes\n\n?A\tnotes\.txt\n$/);
});

test('file history treats spaces, apostrophes, and brackets in paths literally', () => {
  assert.deepEqual(subjects(runSnippet('git-file-history', { path: quotedPath })), [
    'Mark application ready',
    'Initial application',
  ]);
});

test('branch listing supports latest-first and alphabetical order with a limit', () => {
  assert.equal(runSnippet('git-branch-list'), 'docs\nrelease/v1\nmain\n');
  assert.equal(runSnippet('git-branch-list', { sort: 'refname', limit: 2 }), 'archive\ndocs\n');
});

test('branch comparison includes changes in both committed snapshots', () => {
  const output = runSnippet('git-compare-branch');
  assert.match(output, /^\s*notes\.txt\s+\|\s+1\s+-$/m);
  assert.match(output, /^\s*src\/app\.js\s+\|\s+2\s+\+-$/m);
});

test('branch comparison is empty when the snapshots are identical', () => {
  assert.equal(runSnippet('git-compare-branch', { base: releaseBranch }), '');
});

test('line history traces the default line through its change and introduction', () => {
  const output = runSnippet('git-line-history');
  assert.match(output, /^    Mark application ready$[\s\S]*^    Initial application$/m);
  assert.match(output, /^-const status = "draft";\n\+const status = "ready";$/m);
  assert.match(output, /^\+const status = "draft";$/m);
});

test('line history follows a file whose path contains spaces and an apostrophe', () => {
  const output = runSnippet('git-line-history', { path: quotedPath, line: 1 });
  assert.match(output, /^-const ready = false;\n\+const ready = true;$/m);
});

test('tag history includes the target changes and excludes the base and main-only commits', () => {
  assert.deepEqual(subjects(runSnippet('git-tag-commits')), [
    'Update similarly named file',
    'Mark application ready',
  ]);
  assert.equal(runSnippet('git-tag-commits', { target: 'v1.0.0' }), '');
});

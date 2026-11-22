import { parseValues, restoreValues } from './parameters.mjs';

import { cleanTag, tagKey } from './snippet-tags.mjs';

const backupFormat = 'codefolio.personal-backup';
const legacyBackupFormat = 'codefolio.saved-variants';
const backupVersion = 1;
const maxNameLength = 80;

export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isVariant(variant) {
  return isRecord(variant)
    && typeof variant.name === 'string' && variant.name.trim() === variant.name
    && variant.name.length > 0 && variant.name.length <= maxNameLength
    && isRecord(variant.values) && Object.values(variant.values).every((value) =>
      typeof value === 'string' || typeof value === 'boolean' || Number.isFinite(value));
}

function validateVariants(variants) {
  if (!isRecord(variants) || Object.values(variants).some((entries) =>
    !Array.isArray(entries) || entries.some((entry) => !isVariant(entry)))) {
    throw new Error('The backup contains invalid saved variants.');
  }
  return variants;
}

function validatePersonalData({ variants, tags, favorites }) {
  validateVariants(variants);
  if (!isRecord(tags) || Object.values(tags).some((names) =>
    !Array.isArray(names) || names.some((name) => typeof name !== 'string' || !cleanTag(name)))) {
    throw new Error('The backup contains invalid tags.');
  }
  if (!Array.isArray(favorites) || favorites.some((id) => typeof id !== 'string' || !id.trim())) {
    throw new Error('The backup contains invalid favorites.');
  }
  return { variants, tags, favorites };
}

function scopeEntries(entries, snippetIds) {
  if (!snippetIds) return entries;
  return Object.fromEntries(Object.entries(entries).filter(([id]) => snippetIds.has(id)));
}

function nonemptyEntries(entries) {
  return Object.fromEntries(Object.entries(entries).filter(([, values]) => values.length > 0));
}

export function exportPersonalBackup(data, snippetIds) {
  const { variants, tags, favorites } = validatePersonalData({
    variants: scopeEntries(data.variants, snippetIds),
    tags: scopeEntries(data.tags, snippetIds),
    favorites: data.favorites.filter((id) => !snippetIds || snippetIds.has(id)),
  });
  const scoped = {
    variants: nonemptyEntries(variants),
    tags: nonemptyEntries(tags),
    favorites: [...new Set(favorites)],
  };
  return {
    count: Object.values(scoped.variants).reduce((count, entries) => count + entries.length, 0)
      + Object.values(scoped.tags).reduce((count, names) => count + names.length, 0)
      + scoped.favorites.length,
    json: JSON.stringify({ format: backupFormat, version: backupVersion, ...scoped }, null, 2) + '\n',
  };
}

export function readPersonalBackup(text) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error('Choose a valid JSON backup exported by Playground or CodeFolio.');
  }
  if (!isRecord(backup) || ![backupFormat, legacyBackupFormat].includes(backup.format)) {
    throw new Error('Choose a backup exported by Playground or CodeFolio.');
  }
  if (backup.version !== backupVersion) {
    throw new Error('This version of Playground cannot read the backup format.');
  }
  if (backup.format === legacyBackupFormat) {
    return { variants: validateVariants(backup.variants), tags: {}, favorites: [] };
  }
  return validatePersonalData(backup);
}

function comparableValues(snippet, values) {
  if (!isRecord(values)) return null;
  const restored = restoreValues(snippet, values);
  return JSON.stringify(parseValues(snippet, restored).parameters ?? restored);
}

function conflictName(name, attempt) {
  const suffix = attempt === 1 ? ' (imported)' : ' (imported ' + attempt + ')';
  return name.slice(0, maxNameLength - suffix.length).replace(/[\uD800-\uDBFF]$/, '') + suffix;
}

function categoryKey({ language, topic }) {
  return JSON.stringify([language, topic]);
}

function rememberName(names, name, snippetId, values) {
  const entries = names.get(name) ?? new Map();
  entries.set(snippetId, values);
  names.set(name, entries);
}

function categoryNames(stored, snippets, category) {
  const names = new Map();
  for (const snippet of snippets) {
    if (categoryKey(snippet) !== category) continue;
    const entries = stored[snippet.id] ?? [];
    if (!Array.isArray(entries) || entries.some((item) => typeof item?.name !== 'string')) {
      throw new Error('Your existing saved variants could not be read.');
    }
    for (const entry of entries) {
      rememberName(names, entry.name, snippet.id, comparableValues(snippet, entry.values));
    }
  }
  return names;
}

export function mergeVariantBackup(stored, imported, snippets, snippetIds) {
  const variants = { ...stored };
  const counts = { added: 0, renamed: 0, duplicates: 0, unavailable: 0, outsideScope: 0 };
  const catalogById = new Map(snippets.map((snippet) => [snippet.id, snippet]));
  const namesByCategory = new Map();

  for (const [id, entries] of Object.entries(imported)) {
    if (!entries.length) continue;
    const snippet = catalogById.get(id);
    if (!snippet) {
      counts.unavailable += entries.length;
      continue;
    }

    if (snippetIds && !snippetIds.has(id)) {
      counts.outsideScope += entries.length;
      continue;
    }
    const category = categoryKey(snippet);
    if (!namesByCategory.has(category)) {
      namesByCategory.set(category, categoryNames(stored, snippets, category));
    }
    const names = namesByCategory.get(category);
    const combined = [...(stored[id] ?? [])];

    for (const variant of entries) {
      const values = comparableValues(snippet, variant.values);
      let name = variant.name;
      let attempt = 0;
      while (names.has(name) && names.get(name).get(id) !== values) {
        name = conflictName(variant.name, ++attempt);
      }
      if (names.has(name)) {
        counts.duplicates++;
        continue;
      }
      if (attempt) counts.renamed++;
      counts.added++;
      combined.push({ name, values: variant.values });
      rememberName(names, name, id, values);
    }
    variants[id] = combined;
  }

  return { variants, ...counts };
}

export function mergePersonalBackup(stored, imported, snippets, snippetIds) {
  const { variants, ...counts } = mergeVariantBackup(stored.variants, imported.variants, snippets, snippetIds);
  const tags = { ...stored.tags };
  const favorites = new Set(stored.favorites);
  const catalogIds = new Set(snippets.map(({ id }) => id));
  counts.tagsAdded = 0;
  counts.favoritesAdded = 0;

  function inScope(id, count) {
    if (!catalogIds.has(id)) {
      counts.unavailable += count;
      return false;
    }
    if (snippetIds && !snippetIds.has(id)) {
      counts.outsideScope += count;
      return false;
    }
    return true;
  }

  for (const [id, incoming] of Object.entries(imported.tags)) {
    if (!incoming.length || !inScope(id, incoming.length)) continue;

    const current = tags[id] ?? [];
    const known = new Set(current.map(tagKey));
    const additions = [];
    for (const tag of incoming) {
      const key = tagKey(tag);
      if (known.has(key)) {
        counts.duplicates++;
      } else {
        known.add(key);
        additions.push(cleanTag(tag));
      }
    }
    if (additions.length) tags[id] = [...current, ...additions];
    counts.tagsAdded += additions.length;
  }

  for (const id of imported.favorites) {
    if (!inScope(id, 1)) continue;
    if (favorites.has(id)) {
      counts.duplicates++;
    } else {
      favorites.add(id);
      counts.favoritesAdded++;
    }
  }

  return { variants, tags, favorites: [...favorites], ...counts };
}

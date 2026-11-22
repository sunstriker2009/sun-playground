import { browseSnippets, buildSnippet, defaultValues, paginateSnippets, snippets, snippetsPerPage, sortSnippetResults } from './catalog.mjs?v=linq-m8-1';
import { restoreValues } from './parameters.mjs';
import { exportPersonalBackup, isRecord, mergePersonalBackup, readPersonalBackup } from './variant-backup.mjs?v=linq-m8-1';
import { readSnippetLink, snippetHref } from './snippet-links.mjs?v=linq-m8-1';

import { cleanTag, findTaggedSnippets, tagKey } from './snippet-tags.mjs?v=linq-m8-1';

const byId = (id) => document.getElementById(id);
const workspace = byId('workspace');
const backToResults = byId('back-to-results');
const search = byId('search');
const searchFilters = byId('search-filters');
const activeFilters = byId('active-filters');
const tagFilter = byId('tag-filter');
const tagFilterSummary = tagFilter.querySelector('summary');
const tagFilterOptions = byId('tag-filter-options');
const knownTagOptions = new Map();
let selectedTags = new Set();
const personalFilters = [
  { key: 'savedVariants', label: 'Saved', control: byId('filter-saved') },
  { key: 'favorites', label: 'Favorites', control: byId('filter-favorites') },
];
const tagName = byId('tag-name');
const tagEditor = byId('tag-editor');
const tagToggle = byId('toggle-tag-editor');
const tagList = byId('snippet-tags');
const tagStatus = byId('tag-status');
const menu = byId('catalog-menu');
const catalogFilter = byId('catalog-disclosure');
const catalogFilterSummary = catalogFilter.querySelector('summary');
const compactNavigation = matchMedia('(max-width: 720px)');
const browseHeading = byId('browse-heading');
const pagination = byId('pagination');
const previousPage = byId('previous-page');
const nextPage = byId('next-page');
const favorite = byId('favorite');
const favoriteStatus = byId('favorite-status');
const results = byId('results');
const detail = byId('detail');
const fullScreen = byId('snippet-full-screen');
const openFullScreen = byId('open-full-screen');
const builder = byId('builder');
const fields = byId('fields');
const output = byId('output');
const copy = byId('copy');
const linkStatus = byId('link-status');
const linkFallback = byId('link-fallback');
const linkField = byId('snippet-link');
const save = byId('save-variant');
const nameInput = byId('variant-name');
const variantList = byId('variants');
const variantTools = byId('variant-tools');
const exportVariants = byId('export-variants');
const importVariants = byId('import-variants');
const shareVariants = byId('share-variants');
const backupFile = byId('variant-backup-file');
const transferStatus = byId('variant-transfer-status');
const builderStatus = byId('builder-status');
const variantStatus = byId('variant-status');
const storageKey = 'codefolio.variants.v1';
const favoritesStorageKey = 'codefolio.favorites.v1';
const tagsStorageKey = 'codefolio.snippet-tags.v1';

const allSnippets = { language: '', topic: '' };
let scope = history.state?.catalogScope ?? allSnippets;
let currentPage = history.state?.catalogPage ?? 1;
let favorites = readFavorites();
let tags = readTags();
let selected;
let browseScroll;

function readFavorites() {
  try {
    const ids = JSON.parse(localStorage.getItem(favoritesStorageKey) ?? '[]');
    return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function sameScope(left, right) {
  return left.language === right.language && left.topic === right.topic
    && Boolean(left.favorites) === Boolean(right.favorites)
    && Boolean(left.savedVariants) === Boolean(right.savedVariants);
}

function button(label, onClick) {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.addEventListener('click', onClick);
  return element;
}

const scopeButtons = [];
const languages = new Map();
for (const { language, topic } of snippets) {
  if (!languages.has(language)) languages.set(language, new Set());
  languages.get(language).add(topic);
}

function changeBrowsePage(page, nextScope = scope) {
  const url = new URL(location.href);
  url.searchParams.delete('snippet');
  if (!sameScope(scope, nextScope) || page !== currentPage || url.href !== location.href) {
    history.pushState({ catalogScope: nextScope, catalogPage: page }, '', url);
  }
  if (!sameScope(scope, nextScope)) transferStatus.textContent = '';
  scope = nextScope;
  currentPage = page;
  updateResults({ fromHistory: true });
}

function browseScope(nextScope) {
  changeBrowsePage(1, nextScope);
  catalogFilter.open = false;
  catalogFilterSummary.focus();
}

function scopeItem(label, language, topic = '') {
  const control = button(label, () => browseScope({ ...scope, language, topic }));
  scopeButtons.push({ control, language, topic });
  return control;
}

menu.append(scopeItem('All catalogs', ''));
for (const [language, topics] of languages) {
  const group = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = language;
  group.dataset.language = language;
  group.open = scope.language === language;
  const items = document.createElement('div');
  items.className = 'menu-items';
  items.append(scopeItem('All ' + language, language));
  for (const topic of [...topics].sort((left, right) => left.localeCompare(right))) {
    items.append(scopeItem(topic, language, topic));
  }
  group.append(summary, items);
  menu.append(group);
}

compactNavigation.addEventListener('change', () => {
  updateMobileDetail(readSnippetLink(location.search, snippets).snippet);
});

function updateMobileDetail(linkedSnippet) {
  const showing = compactNavigation.matches && Boolean(linkedSnippet);
  if (compactNavigation.matches && !showing && fullScreen.open) fullScreen.close();
  workspace.classList.toggle('mobile-detail', showing);
}

function rememberMobileResults(snippetId) {
  history.replaceState({
    catalogScope: scope,
    catalogPage: currentPage,
    mobileResults: {
      search: search.value,
      selectedTags: [...selectedTags],
      tagFilterOpen: tagFilter.open,
      catalogFilterOpen: catalogFilter.open,
      filtersOpen: searchFilters.open,
      scroll: window.scrollY,
      snippetId,
    },
  }, '', location.href);
}

function restoreSearch(snapshot) {
  if (!snapshot) return;
  search.value = snapshot.search;
  selectedTags = new Set((snapshot.selectedTags ?? []).filter((key) => knownTagOptions.has(key)));
  tagFilter.open = Boolean(snapshot.tagFilterOpen);
  catalogFilter.open = Boolean(snapshot.catalogFilterOpen);
  searchFilters.open = Boolean(snapshot.filtersOpen);
}

function restoreResultPosition(snapshot) {
  requestAnimationFrame(() => {
    if (!compactNavigation.matches || workspace.classList.contains('mobile-detail')) return;
    const link = results.querySelector('[data-snippet-id="' + snapshot.snippetId + '"]');
    (link ?? browseHeading).focus({ preventScroll: true });
    window.scrollTo(0, snapshot.scroll);
  });
}

function openSnippet(snippet) {
  const url = new URL(snippetHref(snippet.id), location.href);
  if (location.href !== url.href) {
    let mobileResultDepth = 0;
    if (compactNavigation.matches) {
      if (!workspace.classList.contains('mobile-detail')) {
        rememberMobileResults(snippet.id);
        mobileResultDepth = 1;
      } else if (history.state?.mobileResultDepth) {
        mobileResultDepth = history.state.mobileResultDepth + 1;
      }
    }
    history.pushState({ catalogScope: scope, catalogPage: currentPage, mobileResultDepth }, '', url);
  }
  updateResults();
  if (workspace.classList.contains('mobile-detail') && !fullScreen.open) window.scrollTo(0, 0);
  byId('snippet-title').focus({ preventScroll: workspace.classList.contains('mobile-detail') && !fullScreen.open });
}

backToResults.addEventListener('click', () => {
  const depth = history.state?.mobileResultDepth;
  if (depth) {
    history.go(-depth);
    return;
  }

  const url = new URL(location.href);
  url.searchParams.delete('snippet');
  history.replaceState({ catalogScope: scope, catalogPage: currentPage }, '', url);
  updateResults({ fromHistory: true });
  browseHeading.focus();
});

function snippetLink(snippet) {
  const link = document.createElement('a');
  link.href = snippetHref(snippet.id);
  link.dataset.snippetId = snippet.id;
  link.textContent = snippet.title;
  link.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey
      || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openSnippet(snippet);
  });
  return link;
}

function savedVariantGroups(matches) {
  const stored = readVariantStore();
  return new Map(matches.map(({ id }) => [id, variantsFor(stored, id)]));
}

function variantLinks(entry, saved) {
  const list = document.createElement('ul');
  list.className = 'saved-variant-links';
  for (const variant of saved) {
    const row = document.createElement('li');
    const load = button(variant.name, () => {
      openSnippet(entry);
      loadVariant(variant);
    });
    load.setAttribute('aria-label', 'Load ' + variant.name + ' from ' + entry.title);
    row.append(load);
    list.append(row);
  }
  return list;
}

function readTags() {
  try {
    const stored = JSON.parse(localStorage.getItem(tagsStorageKey) ?? '{}');
    if (isRecord(stored)) {
      return Object.fromEntries(Object.entries(stored).filter(([, names]) =>
        Array.isArray(names) && names.every((name) => typeof name === 'string')));
    }
  } catch {
    // The browser may block access to saved tags.
  }
  return {};
}

function updateTagOptions() {
  const names = new Map();
  for (const tag of Object.values(tags).flat()) {
    const key = tagKey(tag);
    if (key && !names.has(key)) names.set(key, cleanTag(tag));
  }

  knownTagOptions.clear();
  tagFilterOptions.replaceChildren();
  for (const [key, name] of [...names].sort((left, right) => left[1].localeCompare(right[1]))) {
    const control = document.createElement('input');
    control.type = 'checkbox';
    control.addEventListener('change', () => setTagFilter(key, control.checked));
    const label = document.createElement('label');
    const caption = document.createElement('span');
    caption.textContent = name;
    label.append(control, caption);
    tagFilterOptions.append(label);
    knownTagOptions.set(key, { name, control });
  }
  selectedTags = new Set([...selectedTags].filter((key) => knownTagOptions.has(key)));
  byId('no-tag-options').hidden = Boolean(knownTagOptions.size);
}

function setTagFilter(key, checked) {
  if (checked) selectedTags.add(key);
  else selectedTags.delete(key);
  refreshSearchResults();
}

function setPersonalFilter(key, checked) {
  changeBrowsePage(1, { ...scope, [key]: checked });
}

function catalogScopeLabel() {
  return [scope.language, scope.topic].filter(Boolean).join(' / ');
}

function renderActiveFilters() {
  activeFilters.replaceChildren();

  function addChip(label, control, clear) {
    const row = document.createElement('li');
    const chip = button(label + ' ×', () => {
      clear();
      (searchFilters.open ? control : searchFilters.querySelector('summary')).focus();
    });
    chip.setAttribute('aria-label', 'Remove filter ' + label);
    row.append(chip);
    activeFilters.append(row);
  }

  const catalog = catalogScopeLabel();
  if (catalog) {
    addChip('Catalog: ' + catalog, catalogFilterSummary, () => changeBrowsePage(1, { ...scope, ...allSnippets }));
  }
  for (const [key, { name, control }] of knownTagOptions) {
    control.checked = selectedTags.has(key);
    if (control.checked) {
      addChip('Tag · ' + name, tagFilter.open ? control : tagFilterSummary, () => setTagFilter(key, false));
    }
  }
  for (const { key, label, control } of personalFilters) {
    control.checked = Boolean(scope[key]);
    if (control.checked) addChip(label, control, () => setPersonalFilter(key, false));
  }
  activeFilters.hidden = !activeFilters.childElementCount;
}

function showTags() {
  tagList.replaceChildren();
  for (const name of tags[selected.id] ?? []) {
    const row = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = name;
    const remove = button('×', () => {
      const snippet = selected;
      if (!changeTags((names) => names.filter((tag) => tagKey(tag) !== tagKey(name)))) return;
      if (selected === snippet) {
        tagStatus.textContent = 'Removed tag ' + name + '.';
        (tagEditor.hidden ? tagToggle : tagName).focus();
      } else {
        browseHeading.focus();
      }
    });
    remove.setAttribute('aria-label', 'Remove tag ' + name);
    row.append(label, remove);
    tagList.append(row);
  }
}

function changeTags(change) {
  const stored = readTags();
  stored[selected.id] = change(stored[selected.id] ?? []);
  if (!stored[selected.id].length) delete stored[selected.id];
  try {
    localStorage.setItem(tagsStorageKey, JSON.stringify(stored));
  } catch {
    tagStatus.textContent = 'Tags couldn’t be saved in this browser.';
    return false;
  }
  const wasFilteringByTag = selectedTags.size > 0;
  tags = stored;
  updateTagOptions();
  showTags();
  if (wasFilteringByTag) updateResults();
  return true;
}

function updateResults({ fromHistory = false } = {}) {
  renderActiveFilters();
  const searchingTags = selectedTags.size > 0;
  const searchingText = Boolean(search.value.trim());
  const searching = searchingText || searchingTags;
  const showingFavorites = scope.favorites;
  const showingVariants = scope.savedVariants;
  const matches = findTaggedSnippets(browseSnippets(search.value, scope), tags, selectedTags);
  let savedGroups;
  if (showingVariants) {
    try {
      savedGroups = savedVariantGroups(matches);
    } catch {
      // The empty-state message will explain that the variants could not be read.
    }
  }
  const filtered = matches.filter(({ id }) =>
    (!showingFavorites || favorites.has(id)) && (!showingVariants || savedGroups?.get(id).length));
  const { id, snippet } = readSnippetLink(location.search, snippets);
  updateMobileDetail(snippet);
  const ordered = sortSnippetResults(filtered, favorites);
  const linkedIndex = searching ? -1 : ordered.indexOf(snippet);
  if (linkedIndex >= 0) currentPage = Math.floor(linkedIndex / snippetsPerPage) + 1;
  const { page, pageCount, items } = paginateSnippets(ordered, currentPage);
  currentPage = page;

  browseHeading.textContent = catalogScopeLabel() || (searching ? 'Search results' : 'All snippets');
  for (const { control, language, topic } of scopeButtons) {
    control.setAttribute('aria-pressed', scope.language === language && scope.topic === topic);
  }
  variantTools.hidden = !showingVariants;
  for (const group of menu.querySelectorAll('details')) {
    const active = group.dataset.language === scope.language;
    group.classList.toggle('active-language', active);
    if (fromHistory && active) group.open = true;
  }

  const count = filtered.length;
  byId('result-count').textContent = count + (count === 1 ? ' snippet' : ' snippets')
    + (showingVariants ? ' with saved variants' : '');
  byId('no-results').hidden = count > 0;
  let emptyMessage = 'No snippets match this selection.';
  if (showingVariants && !savedGroups) {
    emptyMessage = 'Saved variants couldn’t be read.';
  } else if (!searching && showingVariants && !showingFavorites) {
    emptyMessage = 'No saved variants in this selection.';
  } else if (!searching && showingFavorites && !showingVariants) {
    emptyMessage = 'Mark a snippet as a favorite to see it here.';
  }
  byId('no-results').textContent = emptyMessage;
  byId('unknown-snippet').hidden = id === null || Boolean(snippet);
  pagination.hidden = pageCount <= 1;
  previousPage.disabled = page <= 1;
  nextPage.disabled = page >= pageCount;
  byId('page-number').textContent = 'Page ' + page + ' of ' + pageCount;
  const preferred = !fromHistory && items.includes(selected) ? selected : items[0];
  selectSnippet(id === null ? preferred : snippet);
  updateFavoriteButton();

  results.replaceChildren(...items.map((entry) => {
    const row = document.createElement('li');
    const link = snippetLink(entry);
    link.className = 'result';
    link.dataset.catalog = entry.language;
    if (entry === selected) link.setAttribute('aria-current', 'page');

    const caption = document.createElement('span');
    caption.className = 'result-caption';
    caption.textContent = entry.title;
    if (favorites.has(entry.id)) {
      const star = document.createElement('span');
      star.className = 'result-star';
      star.setAttribute('role', 'img');
      star.setAttribute('aria-label', 'Favorite');
      star.textContent = '★';
      caption.prepend(star);
    }

    const languageLabel = document.createElement('span');
    languageLabel.className = 'result-meta';
    languageLabel.textContent = entry.language + ' · ' + entry.topic;
    link.replaceChildren(caption, languageLabel);
    row.append(link);
    if (showingVariants) row.append(variantLinks(entry, savedGroups.get(entry.id)));
    return row;
  }));
}

function selectSnippet(snippet) {
  if (selected === snippet) return;
  selected = snippet;
  favoriteStatus.hidden = true;
  linkStatus.textContent = '';
  linkFallback.hidden = true;
  detail.hidden = !snippet;
  if (!snippet) {
    if (fullScreen.open) fullScreen.close();
    return;
  }

  byId('snippet-title').textContent = snippet.title;
  byId('snippet-language').textContent = snippet.language + ' · ' + snippet.topic;
  byId('snippet-description').textContent = snippet.description;
  setTagEditorOpen(false);
  tagStatus.textContent = '';
  showTags();
  byId('example-context').textContent = snippet.example;
  byId('example').textContent = buildSnippet(snippet, defaultValues(snippet)).output;
  for (const field of ['prerequisites', 'expected', 'effects']) {
    byId(field).textContent = snippet[field];
  }
  byId('related').replaceChildren(...snippet.relatedIds.map((id) => {
    const row = document.createElement('li');
    row.append(snippetLink(snippets.find((entry) => entry.id === id)));
    return row;
  }));

  fields.replaceChildren(...snippet.fields.map(parameterControl));
  nameInput.value = '';
  variantStatus.textContent = '';
  updateOutput();
  showVariants();
}

openFullScreen.addEventListener('click', () => {
  browseScroll = { left: window.scrollX, top: window.scrollY };
  byId('full-screen-content').append(detail);
  fullScreen.showModal();
  fullScreen.scrollTop = 0;
});

fullScreen.addEventListener('close', () => {
  fullScreen.before(detail);
  if (!detail.hidden && (!compactNavigation.matches || workspace.classList.contains('mobile-detail'))) {
    window.scrollTo(browseScroll);
    openFullScreen.focus({ preventScroll: true });
  }
});

function updateFavoriteButton() {
  const starred = Boolean(selected && favorites.has(selected.id));
  favorite.setAttribute('aria-pressed', starred);
  favorite.querySelector('span').textContent = starred ? '★' : '☆';
}

favorite.addEventListener('click', () => {
  const updated = readFavorites();
  if (updated.has(selected.id)) {
    updated.delete(selected.id);
  } else {
    updated.add(selected.id);
  }
  try {
    localStorage.setItem(favoritesStorageKey, JSON.stringify([...updated]));
  } catch {
    favoriteStatus.textContent = 'Favorites couldn’t be saved in this browser.';
    favoriteStatus.hidden = false;
    return;
  }
  favoriteStatus.hidden = true;
  favorites = updated;
  updateResults();
  if (detail.hidden) browseHeading.focus();
});

function movePage(offset, control, otherControl) {
  changeBrowsePage(currentPage + offset);
  if (pagination.hidden) browseHeading.focus();
  else if (control.disabled) otherControl.focus();
}

previousPage.addEventListener('click', () => movePage(-1, previousPage, nextPage));
nextPage.addEventListener('click', () => movePage(1, nextPage, previousPage));

function setControlValue(control, value) {
  if (control.type === 'checkbox') {
    control.checked = value === true;
  } else {
    control.value = typeof value === 'string' || typeof value === 'number' ? value : '';
  }
}

function parameterControl(field) {
  const row = document.createElement('div');
  const label = document.createElement('label');
  const elementName = field.multiline ? 'textarea' : field.type === 'choice' ? 'select' : 'input';
  const control = document.createElement(elementName);
  if (field.multiline) {
    row.className = 'multiline-field';
    control.rows = 5;
  }
  control.id = 'parameter-' + field.id;
  control.name = field.id;
  control.setAttribute('aria-describedby', 'builder-status');
  label.htmlFor = control.id;
  label.textContent = field.label;

  if (field.type === 'choice') {
    for (const { value, label } of field.options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      control.append(option);
    }
  } else if (field.type === 'toggle') {
    control.type = 'checkbox';
    row.className = 'toggle-field';
  } else if (field.type === 'integer') {
    control.type = 'number';
    control.min = field.min;
    control.max = field.max;
    control.required = true;
  } else {
    control.required = !field.allowEmpty;
    control.autocomplete = 'off';
    control.spellcheck = false;
    if (field.pattern) control.pattern = field.pattern;
  }

  setControlValue(control, field.default);
  row.append(label, control);
  return row;
}

function parameterControls() {
  return fields.querySelectorAll('input, select, textarea');
}

function fieldValues() {
  return Object.fromEntries(Array.from(parameterControls(), (control) => [
    control.name, control.type === 'checkbox' ? control.checked : control.value,
  ]));
}

function updateOutput() {
  const result = buildSnippet(selected, fieldValues());
  output.value = result.output ?? '';
  copy.disabled = Boolean(result.error);
  save.disabled = Boolean(result.error);
  builderStatus.textContent = result.error ?? '';
  for (const control of parameterControls()) {
    if (control.name === result.fieldId) {
      control.setAttribute('aria-invalid', 'true');
    } else {
      control.removeAttribute('aria-invalid');
    }
  }
}

function readVariantStore() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    if (isRecord(stored)) return stored;
  } catch {
    // Storage can be blocked, or the browser may contain invalid data.
  }
  throw new Error('Saved variants couldn’t be read from this browser.');
}

function writeVariantStore(stored) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(stored));
  } catch {
    throw new Error('Saved variants couldn’t be written to this browser.');
  }
}

function variantsFor(stored, id) {
  const variants = stored[id] ?? [];
  if (!Array.isArray(variants) || variants.some((variant) => typeof variant?.name !== 'string')) {
    throw new Error('Invalid saved variants');
  }

  return variants;
}

function loadVariant(variant) {
  const validObject = isRecord(variant.values);
  const values = restoreValues(selected, validObject ? variant.values : {});
  for (const control of parameterControls()) {
    setControlValue(control, values[control.name]);
  }
  nameInput.value = variant.name;
  updateOutput();
  variantStatus.textContent = !validObject || buildSnippet(selected, values).error
    ? 'Review the parameters and save this variant again.'
    : 'Loaded ' + variant.name + '.';
}

function showVariants() {
  variantList.replaceChildren();
  const empty = byId('variants-empty');
  let variants;
  try {
    variants = variantsFor(readVariantStore(), selected.id);
  } catch {
    empty.hidden = false;
    empty.textContent = 'Saved variants are unavailable in this browser.';
    return;
  }

  empty.hidden = variants.length > 0;
  empty.textContent = 'Save a named variant to reuse these values in this browser.';
  for (const variant of variants) {
    const row = document.createElement('li');
    const load = button(variant.name, () => loadVariant(variant));
    load.setAttribute('aria-label', 'Load ' + variant.name);
    const remove = button('Delete', () => {
      if (modifyVariants((current) => current.filter((item) => item.name !== variant.name))) {
        variantStatus.textContent = 'Deleted ' + variant.name + '.';
        (detail.hidden ? browseHeading : nameInput).focus();
      }
    });
    remove.setAttribute('aria-label', 'Delete ' + variant.name);
    row.append(load, remove);
    variantList.append(row);
  }
}

function refreshVariants() {
  if (scope.savedVariants) updateResults();
  if (selected) showVariants();
}

function modifyVariants(change) {
  try {
    const stored = readVariantStore();
    const variants = variantsFor(stored, selected.id);
    stored[selected.id] = change(variants);
    writeVariantStore(stored);
    refreshVariants();
    return true;
  } catch {
    variantStatus.textContent = 'Your variants could not be updated in this browser.';
    return false;
  }
}

function transferSnippetIds(transferScope) {
  if (!transferScope.language && !transferScope.topic) return undefined;
  return new Set(browseSnippets('', transferScope).map(({ id }) => id));
}

function backupFilename() {
  const parts = [scope.language.replace('#', 'sharp'), scope.topic]
    .filter(Boolean)
    .map((part) => part.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  return ['playground-backup', ...parts].join('-') + '.json';
}

function readPersonalData() {
  return { variants: readVariantStore(), tags: readTags(), favorites: [...readFavorites()] };
}

function preparePersonalBackup() {
  let backup;
  try {
    backup = exportPersonalBackup(readPersonalData(), transferSnippetIds(scope));
  } catch {
    transferStatus.textContent = 'The backup couldn’t be prepared.';
    return;
  }
  if (!backup.count) {
    transferStatus.textContent = 'This selection has no saved variants, tags, or favorites.';
    return;
  }
  return backup;
}

exportVariants.addEventListener('click', () => {
  const backup = preparePersonalBackup();
  if (!backup) return;

  const href = URL.createObjectURL(new Blob([backup.json], { type: 'application/json' }));
  const download = document.createElement('a');
  download.href = href;
  download.download = backupFilename();
  document.body.append(download);
  download.click();
  download.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
  transferStatus.textContent = 'Exported ' + backup.count + (backup.count === 1 ? ' saved item.' : ' saved items.');
});

function showShareFallback() {
  const draft = document.createElement('a');
  draft.href = 'mailto:?subject=Playground%20backup';
  draft.textContent = 'open an email draft';
  transferStatus.replaceChildren('Use Export to download the JSON file and attach it in your app. You can also ',
    draft, '.');
}

shareVariants.addEventListener('click', async () => {
  const backup = preparePersonalBackup();
  if (!backup) return;

  const shareScope = scope;
  const file = new File([backup.json], backupFilename(), { type: 'application/json' });
  const shareData = { files: [file], title: 'Playground backup' };
  shareVariants.disabled = true;
  try {
    if (!navigator.share || !navigator.canShare?.(shareData)) {
      showShareFallback();
      return;
    }
    transferStatus.textContent = 'Choose an app from the share menu.';
    await navigator.share(shareData);
    if (sameScope(scope, shareScope)) {
      transferStatus.textContent = 'Finish sharing in the app you chose.';
    }
  } catch (error) {
    if (!sameScope(scope, shareScope)) return;
    if (error.name === 'AbortError') {
      transferStatus.textContent = 'Sharing canceled. Use Export to attach the backup manually.';
    } else {
      showShareFallback();
    }
  } finally {
    shareVariants.disabled = false;
  }
});

function saveImportedBackup(backup) {
  const changes = [
    [backup.added, storageKey, backup.variants],
    [backup.tagsAdded, tagsStorageKey, backup.tags],
    [backup.favoritesAdded, favoritesStorageKey, backup.favorites],
  ].filter(([count]) => count);
  const applied = [];
  try {
    for (const [, key, value] of changes) {
      const previous = localStorage.getItem(key);
      localStorage.setItem(key, JSON.stringify(value));
      applied.push([key, previous]);
    }
  } catch {
    for (const [key, previous] of applied.reverse()) {
      if (previous === null) localStorage.removeItem(key);
      else localStorage.setItem(key, previous);
    }
    throw new Error('The backup couldn’t be saved in this browser.');
  }
}

function itemCount(count, singular) {
  return count + ' ' + (count === 1 ? singular : singular + 's');
}

importVariants.addEventListener('click', () => backupFile.click());

backupFile.addEventListener('change', async () => {
  const file = backupFile.files[0];
  if (!file) return;
  backupFile.value = '';
  const importScope = scope;
  importVariants.disabled = true;
  transferStatus.textContent = 'Reading backup…';
  try {
    const imported = readPersonalBackup(await file.text());
    const backup = mergePersonalBackup(readPersonalData(), imported, snippets, transferSnippetIds(importScope));
    saveImportedBackup(backup);
    const { added, tagsAdded, favoritesAdded, renamed, duplicates, unavailable, outsideScope } = backup;
    const summary = ['Imported ' + itemCount(added, 'variant') + ', '
      + itemCount(tagsAdded, 'tag') + ', and ' + itemCount(favoritesAdded, 'favorite') + '.'];
    if (renamed) summary.push(renamed + ' renamed to keep existing variants.');
    if (duplicates) summary.push(duplicates + ' already saved.');
    if (unavailable) summary.push(unavailable + ' skipped because the snippets are unavailable.');
    if (outsideScope) summary.push(outsideScope + ' skipped outside this selection.');
    if (sameScope(scope, importScope)) transferStatus.textContent = summary.join(' ');
    tags = backup.tags;
    favorites = new Set(backup.favorites);
    updateTagOptions();
    updateResults();
    if (selected) {
      showTags();
      showVariants();
    }
  } catch (error) {
    if (sameScope(scope, importScope)) transferStatus.textContent = error.message;
  } finally {
    importVariants.disabled = false;
  }
});

function setTagEditorOpen(open) {
  tagEditor.hidden = !open;
  tagToggle.setAttribute('aria-expanded', open);
  if (!open) tagName.value = '';
}

tagToggle.addEventListener('click', () => {
  const open = tagEditor.hidden;
  setTagEditorOpen(open);
  tagStatus.textContent = '';
  if (open) tagName.focus();
});

tagEditor.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  event.stopPropagation();
  setTagEditorOpen(false);
  tagStatus.textContent = '';
  tagToggle.focus();
});

tagEditor.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = cleanTag(tagName.value);
  if (!name) {
    tagStatus.textContent = 'Enter a tag name.';
    return;
  }
  if ((tags[selected.id] ?? []).some((tag) => tagKey(tag) === tagKey(name))) {
    tagStatus.textContent = 'This snippet already has that tag.';
    return;
  }
  if (changeTags((names) => names.some((tag) => tagKey(tag) === tagKey(name)) ? names : [...names, name])) {
    setTagEditorOpen(false);
    tagStatus.textContent = 'Added tag ' + name + '.';
    tagToggle.focus();
  }
});

function refreshSearchResults() {
  currentPage = 1;
  updateResults();
}

tagFilter.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !tagFilter.open) return;
  event.preventDefault();
  tagFilter.open = false;
  tagFilterSummary.focus();
});
for (const { key, control } of personalFilters) {
  control.addEventListener('change', () => setPersonalFilter(key, control.checked));
}
search.addEventListener('input', refreshSearchResults);
window.addEventListener('storage', (event) => {
  if (event.key === favoritesStorageKey || event.key === null) {
    favorites = readFavorites();
    updateResults();
  }
  if (event.key === storageKey || event.key === null) refreshVariants();
  if (event.key === tagsStorageKey || event.key === null) {
    const wasFilteringByTag = selectedTags.size > 0;
    tags = readTags();
    updateTagOptions();
    if (selected) showTags();
    if (wasFilteringByTag) updateResults();
  }
});
window.addEventListener('popstate', () => {
  scope = history.state?.catalogScope ?? allSnippets;
  currentPage = history.state?.catalogPage ?? 1;
  const snapshot = history.state?.mobileResults;
  restoreSearch(snapshot);
  updateResults({ fromHistory: true });
  if (snapshot) restoreResultPosition(snapshot);
});
fields.addEventListener('input', updateOutput);

byId('copy-link').addEventListener('click', async () => {
  const snippet = selected;
  const href = new URL(snippetHref(snippet.id), location.href).href;
  try {
    await navigator.clipboard.writeText(href);
    if (selected !== snippet) return;
    linkFallback.hidden = true;
    linkStatus.textContent = 'Snippet link copied.';
  } catch {
    if (selected !== snippet) return;
    linkStatus.textContent = 'Use your device’s Copy command to copy the selected link.';
    linkField.value = href;
    linkFallback.hidden = false;
    linkField.focus();
    linkField.select();
  }
});

byId('jump-to-builder').addEventListener('click', () => {
  const heading = byId('builder-heading');
  heading.focus({ preventScroll: true });
  heading.scrollIntoView({ block: 'start' });
});

copy.addEventListener('click', async () => {
  const copiedSnippet = selected;
  const copiedOutput = output.value;
  try {
    await navigator.clipboard.writeText(copiedOutput);
    if (selected === copiedSnippet && output.value === copiedOutput) {
      builderStatus.textContent = 'Copied to clipboard.';
    }
  } catch {
    if (selected === copiedSnippet && output.value === copiedOutput) {
      output.focus();
      output.select();
      builderStatus.textContent = 'Use your device’s Copy command to copy the selected snippet.';
    }
  }
});

builder.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    variantStatus.textContent = 'Enter a name for this variant.';
    return;
  }

  const { parameters, error } = buildSnippet(selected, fieldValues());
  if (error) return;
  if (modifyVariants((variants) => {
    const variant = { name, values: parameters };
    const existing = variants.findIndex((variant) => variant.name === name);
    if (existing === -1) return [...variants, variant];
    return variants.map((entry, index) => index === existing ? variant : entry);
  })) {
    variantStatus.textContent = 'Saved ' + name + '.';
  }
});

updateTagOptions();
restoreSearch(history.state?.mobileResults);
updateResults();

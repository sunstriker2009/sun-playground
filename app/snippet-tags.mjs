export const cleanTag = (tag) => tag.trim().replace(/\s+/g, ' ');
export const tagKey = (tag) => cleanTag(tag).toLowerCase();

export function findTaggedSnippets(entries, tags, selectedTags) {
  const keys = new Set(Array.from(selectedTags, tagKey));
  if (!keys.size) return entries;
  return entries.filter(({ id }) =>
    (tags[id] ?? []).some((tag) => keys.has(tagKey(tag))));
}

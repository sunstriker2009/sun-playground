export function snippetHref(id) {
  return '?' + new URLSearchParams({ snippet: id }).toString();
}

export function readSnippetLink(search, snippets) {
  const id = new URLSearchParams(search).get('snippet');
  return { id, snippet: snippets.find((entry) => entry.id === id) };
}

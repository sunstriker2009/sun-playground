export function defaultValues(snippet) {
  return Object.fromEntries(snippet.fields.map((field) => [field.id, field.default]));
}

export function restoreValues(snippet, savedValues) {
  return Object.fromEntries(snippet.fields.map((field) => [
    field.id, Object.hasOwn(savedValues, field.id) ? savedValues[field.id] : field.default,
  ]));
}

function parseParameter(field, value) {
  switch (field.type) {
    case 'integer': {
      const number = typeof value === 'string' && /^-?(0|[1-9][0-9]*)$/.test(value)
        ? Number(value)
        : value;
      return Number.isSafeInteger(number) && number >= field.min && number <= field.max
        ? number
        : undefined;
    }
    case 'choice':
      return field.options.some((option) => option.value === value) ? value : undefined;
    case 'toggle':
      return typeof value === 'boolean' ? value : undefined;
    case 'text':
      if (typeof value !== 'string' || (!field.allowEmpty && !value.trim())) return undefined;
      return !field.pattern || new RegExp('^(?:' + field.pattern + ')$', 'v').test(value)
        ? value
        : undefined;
  }
}

export function parseValues(snippet, values) {
  const parameters = {};
  for (const field of snippet.fields) {
    const parsed = parseParameter(field, values[field.id]);
    if (parsed === undefined) {
      return { error: field.hint ?? 'Enter a valid value for ' + field.label + '.', fieldId: field.id };
    }
    parameters[field.id] = parsed;
  }
  return { parameters };
}

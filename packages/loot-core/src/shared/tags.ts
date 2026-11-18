// for a given string, returns an array of unique words
// (whitespace-separated) with only a single # prepended,
// so "one #one ##one ##two three" becomes
// ["#one", "#two", "#three"]
export function extractTagsForFilter(value: string) {
  if (!value) return [];
  const tagValues = [];
  const seenTags = new Set();
  for (const [_, tag] of value.matchAll(/#*([^#\s]+)/g)) {
    const tagWithHash = '#' + tag;
    if (!seenTags.has(tagWithHash)) {
      seenTags.add(tagWithHash);
      tagValues.push(tagWithHash);
    }
  }
  return tagValues;
}

// Builds the regex source that matches `#<tag>` in transaction notes. This is
// the single definition of the `hasTags` / `hasAnyTag` matching rules, shared
// by the AQL filter and by tag usage counts so the two can't disagree.
//
// `tag` is the bare tag name, without the leading '#'. A match must not be
// preceded by '#' (a doubled '#' escapes the tag) and must be followed by
// whitespace, another '#', or the end of the notes, so `#food` doesn't match
// `#foodie`. Matching is case sensitive.
//
// The returned string is valid both as a JavaScript `RegExp` source and inside
// an AQL `$regexp` value: '$' is written as '[$]' because AQL string
// unescaping would turn '\$' into a bare '$' end-of-string anchor.
export function tagMatchPattern(tag: string) {
  const escapedTag = tag
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\$/g, '[$]');
  return `(?<!#)#${escapedTag}([\\s#]|$)`;
}

// Tags in notes are delimited by whitespace or another '#', and a doubled
// '#' escapes the tag (see `parseNotes`). Matching is case sensitive because
// tag identity elsewhere (colors, discovery) is case sensitive too.
export function renameTagInNotes(
  notes: string,
  oldTag: string,
  newTag: string,
) {
  const escaped = oldTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?<!#)#${escaped}(?=[\\s#]|$)`, 'g');
  return notes.replace(pattern, () => `#${newTag}`);
}

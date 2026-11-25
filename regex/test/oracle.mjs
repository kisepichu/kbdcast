// Test-only oracle: JS RegExp with the `u` and `d` flags. Positions are converted from UTF-16 to code point offsets.
const codePoints = (s, index) => [...s.slice(0, index)].length;

// Returns [] when there is no match. Otherwise [start, end] for the whole match and then for each group,
// with [-1, -1] for a group that did not take part.
export function find(pattern, flags, input) {
  const m = new RegExp(pattern, `ud${flags}`).exec(input);
  if (m === null) return [];
  return m.indices.flatMap((span) => (span === undefined ? [-1, -1] : [codePoints(input, span[0]), codePoints(input, span[1])]));
}

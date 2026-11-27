// Test-only oracle: the UTF-8 decoder of the WHATWG Encoding Standard (TextDecoder), which replaces each maximal
// subpart of an ill-formed sequence with U+FFFD. `ignoreBOM` keeps a leading U+FEFF, as Utf8 does.
// Returns what each chunk decodes to with `stream: true`, and then what the final flush gives.
export function decode(chunks) {
  const decoder = new TextDecoder("utf-8", { ignoreBOM: true });
  return [...chunks.map((chunk) => decoder.decode(chunk, { stream: true })), decoder.decode()];
}

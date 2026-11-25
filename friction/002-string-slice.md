# 002 string-slice

- 状態: open
- Emela: v0.28.2
- 意図: regex で一致した範囲（code point の offset）の文字列を取り出す．code point の List から文字列を組み立てる．kbdcast の regex の spec（`docs/superpowers/specs/2026-11-25-kbdcast-R-regex-design.md` §4，§10）が「String の部分文字列の関数が無い」として予想していた friction
- こう書きたかった:
  std の関数として `String.slice(s, from, to)` と `String.from_code_points(cps)` を呼ぶ．std の外で書くなら `wish/text.emel` の形（`String.code_points` を `List.drop` と `List.take` で切り，`String.from_scalars` で戻す）
- 診断:
  repo の外の使い捨ての Pome で `String.slice(s, 1, 2)` と `String.from_code_points(cps)` を `emela check` した結果（v0.28.2，2026-11-25）: ``error[E0212]: module `String` has no `slice` `` と ``error[E0212]: module `String` has no `from_code_points` ``（こちらには ``= help: did you mean `from_code_point`?`` が付く）．wish check では ``error[E0212]: module `String` has no `from_scalars` ``
- 回避策:
  `text` Pome（`text/src/lib.emel`）に `Text.slice` と `Text.from_code_points` を std に入れるならこうなる形で置いた．印はモジュールの先頭のコメント（Emela にモジュールの doc comment は無い．008）の `FRICTION(002)`．中身は `String.code_points` の List を `List.drop` と `List.take` で切り，`String.from_code_point` で 1 つずつ戻して `List.join` する（戻すときに起きない `None` を扱う回り道は 003）
- コスト:
  Pome が 1 つ（実装 20 行ほど，テスト 70 行ほど）．`slice` は呼ぶたびに `s` 全体を code point の List にするので O(`s` の code point の数)．`Bytes.slice` と `Array.slice` は O(`to - from`) 以下と書かれている．regex の `find_all` のように同じ文字列から k 回切り出すと O(k × n) になる．普段のコードに基盤レベルは漏れていない
  regex の `replace` と `split`（`regex/src/lib.emel`，計画の Task 7）は，一致の数 k に対して `Text.slice` を k + 1 回呼ぶので O(k × n) になった（`find_all` の一致の `text()` も 1 つごとに O(n)）．印は `regex/src/lib.emel` の先頭のコメントの `FRICTION(002)`．使い捨ての Pome で，`a1` を並べた入力を `\d` で `split` した時間（bun，compile を含む，2026-11-25）は，10000 code point（5001 個の piece）で 2.5 秒，20000 code point（10001 個の piece）で 10.2 秒で，n と k を 2 倍にすると 4 倍になる．`regex` の中で code point の Array から切れば O(piece の長さ) で済むが，それには `Text.from_code_points` の起きない `None`（003）をもう一度 `panic` で扱うことになり，`Text.slice` と同じ回り道を regex に複製するので，しなかった
- spec:
  `[target.string]`（「There is no API that takes a position as a number」），`[api.string]`，`[lib.api-rules]`，`[api.std.bytes]` と `[api.std.array]` の `slice`，`[api.std.json]` の `SyntaxError` の `offset`
- 既存:
  emela の issue に無い（`slice`，`substring`，`from_code_point` で検索，2026-11-25）．`proposals/` にも無い．`[target.string]` の「There is no API that takes a position as a number」は，v0.20.0 の spec（#114，c7e1e557，2026-10-13）の 16.2 に日本語で「位置を数値で指定する API は持たない。」としてあり，#388（spec/ を作った PR）はそれを英語にして移した．理由は当時の spec にも history にも書かれていない
- 行き先: 前提の範囲内で spec に足りない → proposal の下書き（下の節．未提出．出すのは user）

## proposal の下書き

### Summary

Add two functions to `String` in core: `slice(s, from, to)`, which takes the part of a string between two code point positions, and `from_code_points(cps)`, the inverse of `String.code_points`.

### Motivation

- std already reports positions in code points, but gives no way to use them. `Std.Json`'s `SyntaxError(message, offset)` counts code points from the start of the input, and so does `Base64Error` in `emela-lang/x/base64`. A program that has such an offset cannot take the text around it.
- A regex engine over code points (kbdcast's `regex` Pome, a Pike VM with ECMAScript semantics) finds matches and capture groups as pairs of code point offsets. Every `find`, capture and `split` result has to become a String: `slice(s, start, end)`. Case folding and replacement build strings from code points: `from_code_points`.
- kbdcast's VT emulator (planned) decodes the output of a terminal into code points, keeps them in screen cells, and builds the text of a line from them to run `wait /pattern` on it: `from_code_points`, then `slice` on the match.
- Without them, every caller writes the same detour: `s.code_points().drop(from).take(to - from)`, then `String.from_code_point` on each code point and `List.join`. Each `from_code_point` returns an Option that cannot be `None`, because the code points came from a String, so each caller either swallows it with `.or("")` (as `String.to_ascii_lowercase` does) or panics. `slice` written this way is O(n) in the whole string on every call, so taking k matches out of one string is O(k × n).

### Proposal

In `[api.string]`:

| Function | Signature | Implementation | Description |
|---|---|---|---|
| `slice` | `slice(s: String, from: Int, to: Int) -> String` | intrinsic | The code points from `from` inclusive to `to` exclusive. Both are clamped to 0 to the number of code points in `s`; empty if `from` is not less than `to` |
| `from_code_points` | `from_code_points(cps: List[Int]) -> Option[String]` | intrinsic | The string of the code points in order. `None` if one of them is not a Unicode scalar value |

- `slice("a\u{1F600}b", 1, 2)` is `"\u{1F600}"`, `slice("abc", -1, 2)` is `"ab"`, `slice("abc", 2, 1)` is `""`. `from_code_points([])` is `Some("")`, and `from_code_points([0xD800])` is `None`.
- For every String `s`: `from_code_points(code_points(s)) == Some(s)`, and for every `n`, `append(slice(s, 0, n), slice(s, n, len)) == s`, where `len` is the number of code points of `s`.
- `[lib.api-rules]`: the string comes first. `slice` clamps as `Bytes.slice` and `Array.slice` do, so an out-of-range position is not an error. `from_code_points` is a `from_*` creation and, like `from_code_point`, returns an Option for a value out of range.
- `[target.string]`: "There is no API that takes a position as a number" changes to say that `slice` is the one that does, and that it counts code points.

A working version in pure Emela, with these tests, is the `text` Pome in kbdcast (`text/src/lib.emel`, `text/test/text_test.emel`).

### Open questions

- The unit of positions. `String.length`, `String.chars` and `split(s, "")` count grapheme clusters, while the matching of `contains`, `starts_with`, `ends_with` and `split`, and the `offset` of `Std.Json`, count code points. A `slice` in code points can cut a grapheme cluster (`slice("e\u{301}", 0, 1)` is `"e"`), and `slice(s, 0, String.length(s))` is not `s` when a cluster has several code points. Should the name carry the unit (`slice_code_points`)? Is a grapheme version wanted too? Is a function for the number of code points needed, instead of `s.code_points().length()`?
- Cost. A String's internal encoding is not observable (`[target.string]`), and on JS it is a JS string (`[target.js.value]`), so a code point position is found by scanning from the start on every target unless the runtime caches it. Should `slice` promise a complexity, as `Bytes.slice` does (O(`to - from`) or less)?
- Whether a creation that cannot fail is also wanted, for code points known to be scalar values (friction 003). With `slice` in std, the main case for it goes away.

# 002 string-slice

- 状態: open
- Emela: v0.28.2
- 意図: regex で一致した範囲（code point の offset）の文字列を取り出す．code point の List から文字列を組み立てる．kbdcast の regex の spec（`docs/superpowers/specs/2026-11-25-kbdcast-R-regex-design.md` §4，§10）が「String の部分文字列の関数が無い」として予想していた friction
- こう書きたかった:
  std の関数として `String.slice(s, from, to)` と `String.from_code_points(cps)` を呼ぶ．std の外で書くなら `wish/text.emel` の形（`String.code_points` を `List.drop` と `List.take` で切り，`String.from_scalars` で戻す）
  key codec の表記（`wish/notation.emel:49`，`:56`，`:61`，サブプロジェクト 2 の計画の Task 3）でも，`<` と `>` の間の文字列（error に出す `<Ecs>` の中身）と名前を，code point の List から `String.from_code_points(...)` で作った
  VT の parser（`wish/parser.emel:52-64`，サブプロジェクト 3 の計画の Task 3）でも，Ground で書く文字の続き（`Print` の中身．`advance` が受けた String の中の続いた範囲）を，code point から 1 文字ずつ足して作った．`String.slice` があれば，入力の String の範囲をそのまま切り出す．テスト（`test/parser_test.emel`，Task 3．wish は無い）でも，入力をランダムな code point の位置で 2〜4 つに切り分けるのに `slice` がほしかった
  VT の公開 API（`wish/vt.emel:65-71`，サブプロジェクト 3 の計画の Task 6）の `text` でも，各行のセルの code point から行の文字列を作るのに，`String.from_code_point` で 1 文字ずつ String にして `join("")` した（wish は，std に `from_code_points` があるとは考えずにこの形で書いた）．テスト（`test/vt_test.emel`，Task 6）でも，parser のテストと同じく，入力を code point の位置で切り分けるのに `slice` がほしかった
- 診断:
  repo の外の使い捨ての Pome で `String.slice(s, 1, 2)` と `String.from_code_points(cps)` を `emela check` した結果（v0.28.2，2026-11-25）: ``error[E0212]: module `String` has no `slice` `` と ``error[E0212]: module `String` has no `from_code_points` ``（こちらには ``= help: did you mean `from_code_point`?`` が付く）．wish check では ``error[E0212]: module `String` has no `from_scalars` ``
  表記の wish check（v0.28.2）では，3 か所とも `let`（004）と前置の match（E0142）の行にあり，届かなかった（`:56` の ``error[E0217]: expected constructor, found type `String` `` は，`=>` の後ろの行がパターンとして読まれた後追い）
- 回避策:
  `text` Pome（`text/src/lib.emel`）に `Text.slice` と `Text.from_code_points` を std に入れるならこうなる形で置いた．印はモジュールの先頭のコメント（Emela にモジュールの doc comment は無い．008）の `FRICTION(002)`．中身は `String.code_points` の List を `List.drop` と `List.take` で切り，`String.from_code_point` で 1 つずつ戻して `List.join` する（戻すときに起きない `None` を扱う回り道は 003）
  表記（`src/key/notation.emel` の `string_of`，`FRICTION(002)` の印）: root の Pome は text に依存しない（key codec の spec §3 で，依存はテストの brix だけ）ので，`cps.map(text_of).join("")` を private に書いた（`text_of` の起きない `None` は 003）．`<C-C-x>` と `<Ecs>` の error の中身と，名前を string の literal のパターンで引く所（`named`）の 3 か所から呼ぶ（呼ぶ所にも `FRICTION(002)` の印）
  VT の parser（`src/vt/parser.emel` の `string_of`，`FRICTION(002)` の印）: root の Pome は text に依存しないので，表記と同じく `cps.map(character).join("")` を private に書いた（`character` の起きない `None` は 003）．書く文字は code point の List に逆順で持ち，`Print` にする所で `string_of` を 1 回呼ぶ．テスト（`test/cut.emel` の `string_of`，`FRICTION(002)` の印．Task 3 では `test/parser_test.emel` にあった）も，入力の `code_points()` を `take` と `drop` で切って（`Cut.pieces`）同じ形の `string_of` で戻す
  VT の公開 API（`src/vt.emel` の `string_of`，`FRICTION(002)` の印）: parser と同じく `cps.map(character).join("")` を private に書いた（`character` の起きない `None` は 003）．`text` が行ごとに 1 回呼ぶ．テスト（`test/vt_test.emel`）は，parser のテストと同じ `Cut.pieces` で入力を切って戻す．Task 6 では `string_of` の写しを `test/vt_test.emel` に置いたが，review の後で 2 つのテストが共有する `test/cut.emel`（module `Cut`）にまとめた（`test/` の module は `pub` にしても公開 API に出ないので，`src/` と違って private な写しを置く理由が無い）
- コスト:
  Pome が 1 つ（実装 20 行ほど，テスト 70 行ほど）．`slice` は呼ぶたびに `s` 全体を code point の List にするので O(`s` の code point の数)．`Bytes.slice` と `Array.slice` は O(`to - from`) 以下と書かれている．regex の `find_all` のように同じ文字列から k 回切り出すと O(k × n) になる．普段のコードに基盤レベルは漏れていない
  regex（`regex/src/lib.emel`）は `Text.slice` を避けることになった．`Text.slice` は呼ぶたびに文字列の全体をたどるので，`replace` と `split`（計画の Task 7）が一致の数 k に対して k + 1 回呼ぶと O(k × n) になり，`Match` の `text` と `group` も 1 つごとに O(n) だった．最終レビューのあとで，入力を code point の Array にするのを 1 回の呼び出しにつき 1 回にし，部分をその Array の範囲から `Text.from_code_points(input.slice(from, to).to_list())` で作るように変えた（`string_of`．`Match` は String の代わりにその Array を持つ．起きない `None` を `panic` にする回り道は 003）．印は `regex/src/lib.emel` の先頭のコメントの `FRICTION(002)`．std に O(`to - from`) の `slice` があれば，`Match` は String を持ったまま `slice` を呼べばよく，Array も `string_of` も要らない
  計測（bun，使い捨ての Pome で前と後の regex を並べ，`Regex.compile` を除いた時間を `Std.Clock` で計った，2026-11-26）: `a1` を並べた入力を `\d` で `split` すると（3 回ずつ），10000 code point（5001 個の piece）で前が 2073–2294 ms，後が 41–49 ms．20000 code point（10001 個の piece）で前が 9360–12216 ms（Task 7 の報告では compile を含めて 10.2 秒），後が 52–59 ms．前は入力を 2 倍にすると 4 倍を超えて増える．`a` を n 個並べた入力で各 `a` をその `text()` に置き換える `replace` を 10 回続けた時間は（3 回の実行で 3 組ずつ），n = 4000 で前が 7236–10754 ms，後が 224–296 ms．同じ組で計った，同じ入力の `find_all`（文字列を作らない）を 10 回続けた時間（前も後も 138–219 ms）に対して，前は 37–61 倍，後は 1.3–2.0 倍
  表記: 補助関数 1 つ（3 行）．入力の String から `<` と `>` の間を `slice` で取れれば，error の 2 か所は code point を String に戻さずに済み，名前も `String.to_ascii_lowercase(String.slice(...))` で引ける
  VT の parser: 補助関数 1 つ（3 行）．書く文字ごとに 1 文字の String を作ってからつなぐ．入力の範囲を切り出せれば，文字ごとの String も code point の List も要らない．テストにも同じ補助関数 1 つ（3 行．`test/cut.emel`）．唯一の使い手の `Vt.Terminal` は，`Print` の String を `code_points()` ですぐ code point に戻す（`src/vt/terminal.emel` の `apply`）ので，この String は `Action` の型（計画の Task 3 の Interfaces）と，テストで比べやすくするためだけに作る
  VT の公開 API: 補助関数 1 つ（3 行）．`text` を呼ぶたびにセルごとに 1 文字の String を作ってからつなぐ（80 × 24 で 1920 個）．テストは parser のテストと `test/cut.emel` の `string_of` を共有し，補助関数は増えない
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
- Without them, every caller writes the same detour: `s.code_points().drop(from).take(to - from)`, then `String.from_code_point` on each code point and `List.join`. Each `from_code_point` returns an Option that cannot be `None`, because the code points came from a String, so each caller either swallows it with `.or("")` (as `String.to_ascii_lowercase` does) or panics. `slice` written this way is O(n) in the whole string on every call, so taking k matches out of one string is O(k × n). On Bun, kbdcast's regex took 9.4–12.2 s to `split` 20 000 code points into 10 001 pieces this way. After it switched to keeping the code points in an Array and building each piece from a range of it, the same `split` took 52–59 ms. That switch needs its own copy of the `None` that cannot happen.

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

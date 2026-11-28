# 083 string-lines

- 状態: open
- Emela: v0.28.2
- 意図: cast の reader（`src/cast.emel` の `read`、サブプロジェクト 4 の計画の Task 1）で、cast の text を行に分ける。行が 1 つも無い text（空の text）は `the cast is empty` にする
- こう書きたかった:
  `wish/cast_read.emel:20-21`。Rust の `str::lines`、Haskell の `lines`、Kotlin の `lines()`、Python の `str.splitlines` のつもりで、空の text は空の List になり、最後の `\n` の後ろに空の行を作らない
  ```emela
  match String.lines(text) |> List.enumerate(from: 1) {
    [] -> fail CastError(1, "the cast is empty")
    [(n, first), ..rest] -> (read_header(n, first), read_events(rest))
  }
  ```
- 診断:
  wish check（v0.28.2）: `String.lines` に ``error[E0212]: module `String` has no `lines` ``。help は付かない。同じ行の前置の match（E0142）と `enumerate(from: 1)`（016）にも出た
- 回避策:
  `text.split("\n").enumerate()` にした。`split` は空の text に `[""]` を返す（`[api.string]`）ので、空の cast を最初の腕の guard `if text != ""` で分け、`_` の腕で `the cast is empty` にした（`src/cast.emel` の `read`、`FRICTION(083)` の印）。`_` の腕は、`split` が返さない `[]` も受ける。`split` は最後の `\n` の後ろにも空の部分を作るが、イベントの空の行は飛ばすので、そこには何も要らない
  tape のパーサ（`src/tape.emel` の `parse`、サブプロジェクト 1 の Task 1）も `source.split("\n")` で分けている。`run` の行が無いときの error の行（最後の行の次）は、最後の部分が `""` かどうかで分けて数える（`if lines.last() == Some("") { lines.length() } else { lines.length() + 1 }`）。`lines` があれば `lines.length() + 1` の 1 つで書ける
- コスト:
  cast: guard の 1 つと、それを説明するコメントの 1 行。tape: `if` の 1 つ。どちらも、`split` の結果の端の `""` が行かどうかを、使う側が毎回決める。普段のコードに基盤レベルは漏れていない
- spec:
  `[api.string]`（`split`。「With a non-empty separator, `split("", ",")` is `[""]`」）。`[api.std.process]` の `Stdin.read_line` は行を決めている: 「A line ends at `\n`. The `\n`, and a `\r` immediately before it, are not part of the line. The text after the last `\n`, if not empty, is the last line.」。同じ決まりで String を行に分ける関数は無い
- 既存:
  emela の issue と PR に無い（2026-11-28、`gh search issues --repo emela-lang/emela --include-prs` で「lines」「splitlines」「String.lines」を検索。「lines」で当たったのは `Std.Process` の標準入力の #575、#566 と、別の話題の proposal（#624、#492）など。ほかは当たりなし）。v0.28.2 の `spec/open-questions.md` にも無い
- 行き先:
  前提の範囲内で std に足りない → proposal の下書きの材料（まだ書かない。使う所は cast と tape の 2 か所）。`String.lines(s: String) -> List[String]`: `Stdin.read_line` と同じ決まりで分ける（`\n` と、その直前の `\r` は行に入れない。最後の `\n` の後ろの text は、空でなければ最後の行）。`lines("")` は `[]`、`lines("a\n")` は `["a"]`。asciicast や JSON Lines のような行の形式と、tape のような行ごとの言語を読む所で使える。未提出。出すのは user

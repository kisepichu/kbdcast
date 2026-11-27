# 059 string-trim-end

- 状態: open
- Emela: v0.28.2
- 意図:
  VT の公開 API の `text`（`src/vt.emel`、サブプロジェクト 3 の計画の Task 6）で、画面の各行の文字から行の末尾の空白を除く（spec §8）。`wait` が見る文字列で、avt 0.18.0 の `Buffer::text` は各行を Rust の `trim_end`（Unicode の White_Space を末尾から除く）で切る。行の先頭の空白は残す（`"  x"` は `"  x"`）
  tape のパーサ（`src/tape.emel`、サブプロジェクト 1 の計画の Task 1）でも、行頭の空白を捨て（spec §4）、`run` の後ろの文字列から行末の空白を除いて `Command.text`（cast の header の `command`）にし、`sleep`、`set` の値の行末の空白を除く。`wait` の pattern と `>` のキー列は行末の空白を残す
- こう書きたかった:
  `wish/vt.emel:70`
  ```emela
  line.filter(...).map(...).join("").trim_end()
  ```
  tape のパーサ（`wish/tape.emel:48`、`:59`、`:98`、`:111`、`:148`）: 行頭は `text.trim_start()` と `span.drop(...).trim_start()`、行末は `value.text.trim_end()` と `arg.text.trim_end()`（Rust の `trim_start` と `trim_end`）
- 診断:
  wish check（v0.28.2）: ``error[E0313]: type `String` has no field or function `trim_end` ``。help は付かない
  repo の外の使い捨ての Pome での最小の形（2026-11-27）: `s.trim_end()` は同じ E0313、`String.trim_end(s)` は ``error[E0212]: module `String` has no `trim_end` ``。どちらにも ``did you mean `trim`?`` のような help は付かない
  tape のパーサの wish check（v0.28.2）: 5 か所とも `let`（004）の行にあり、届かなかった
- 回避策:
  private な `trim_end(s)` を書いた（`src/vt.emel`、`FRICTION(059)` の印）。`String.trim(s)` で両端を除き、先頭から除かれた分を戻す。戻す分は、`String.split(s, kept)` の最初の部分（`kept` は `trim` が残したもの）。`kept` は White_Space でない文字で始まって終わるので、`s` の中に 1 回しか現れず、`split` はいつも 2 つに分ける（そうでない形は panic にした）。`kept` が空なら空の String を返す
  White_Space の表（25 文字）を `trim` と同じに保つため、表を自分で書く形（039 と同じく、code point の述語を書いて、末尾から落とす）にはしなかった
  tape のパーサ（`src/tape.emel`）: 行を code point の List で持つ（002）ので、List の上で書いた。行末は private な `trim_end(cps)`（`FRICTION(059)` の印。逆にした List の先頭から空白を落として戻す。List に `drop_while` が無いのは 041）、行頭は `skip_blanks`（`FRICTION(041)` の印。こちらは列も進めるので、`trim_start` があっても `Span` の関数は要る）。`String.trim` の White_Space の 25 文字でなく、空白と tab だけを落とす（tape の空白の定義。039）ので、`String.trim` を使う VT の形にはしなかった
- コスト:
  印とコメントを含めて 15 行。各行で `trim` と `split` が行の長さに対して O(n) を 1 回ずつ増やす（80 列なら小さい）。`split` が 2 つに分けることは、上の理屈でしか保証されず、compiler は確かめない（panic の腕が要る）。普段のコードに基盤レベルは漏れていない
  tape のパーサ: 補助関数 1 つ（`trim_end`、印とコメントを含めて 6 行）。値の List を `reverse` で 2 回なめる。String の `trim_end` があっても空白の定義が違う（White_Space）ので、`trim_end` が欲しいのは List の側の `drop_while`（041）とも言える
- spec:
  `[api.string]`（`trim` だけがあり、`trim_start` と `trim_end` は無い。White_Space の 25 文字の表は固定）。emela の main（596b603）の `spec/library/api.md` と bundled core にも無い（`git grep`）
- 既存:
  emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「trim_end」「trim_start」を検索して当たりなし。「trim」で当たったのは別の話題: 大文字小文字の変換の性能の PR #630、表示と文字列の一致の issue #216 など）。他の言語: Rust の `trim_end` と `trim_start`、Go の `strings.TrimRight`、JavaScript の `trimEnd`、Python の `rstrip`
- 行き先:
  前提の範囲内で spec に足りない → `[api.string]` に `trim_start(s: String) -> String` と `trim_end(s: String) -> String` を足す proposal の下書きの材料（まだ書かない）。`trim` と同じ White_Space の表を使う。使い道は、端末の画面の行の末尾の空白を落とす所（avt と同じ）と、テキストの行の末尾の空白を落とす所。診断の側（E0313 と E0212 に `trim` を示す help が無い）は、単独で診断の改善（emela の `spec/diagnostics.md`）にできる。未提出。出すのは user

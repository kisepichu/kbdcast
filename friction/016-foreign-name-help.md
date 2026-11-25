# 016 foreign-name-help

- 状態: open
- Emela: v0.28.2
- 意図: regex の parser（`wish/syntax.emel`）で、error で失敗する、Bool の値を書く、Option の中身を既定値つきで取り出す、という他の言語にもある操作を書く
- こう書きたかった:
  他の言語の名前で書いた（Python、Ruby、Kotlin の `raise`、多くの言語の `false`、Rust の `unwrap_or`）
  - `raise RegexSyntax(...)`: `wish/syntax.emel` の 29 行（`:60`、`:115`、`:234` など）
  - `false`: `:155`、`:158`、`:162`、`:359`
  - `.unwrap_or(...)`: `:155`、`:158`、`:192`、`:336`
  - regex の class の wish（`wish/class.emel:27`、`:30`、`:69`、`:71`、`:75`、`:78`、計画の Task 5）: List を Array にするのに `xs.to_array()`（`Array.to_list` の逆。Kotlin の `toTypedArray`、Ruby の `to_a` のつもり）
  - 同じ class の wish（計画の Task 5）: 2 つの List をつなぐのに `before ++ kept`（`wish/class.emel:124`。Haskell、Elm、Scala の `++`）、2 つの Int の大きい方に `max(a.to, b.to)`（`:89`。Python、Haskell の、型を書かずに呼ぶ `max`）
- 診断:
  wish check（v0.28.2）では、`raise` に ``error[E0211]: cannot find value `raise` in this scope``（5 つ。残りは同じ行の他の構文エラーに埋もれた）と、`raise` の後ろを値と読んだ ``E0301: type mismatch: expected `(Node, State)`, found `RegexSyntax` ``（6 つ）、`false` に ``E0211: cannot find value `false` in this scope``。`unwrap_or` には診断が届かなかった（4 か所とも、同じ行の `fn(m) { ... }`（E0148）か `let`（004）の構文エラーの後ろにあった）
  repo の外の使い捨ての Pome での最小の形（2026-11-25）:
  - `if c == 0 { raise Oops(message: "zero", offset: 0) } else { c }`: ``E0122: expected newline or `}` after statement``（`Oops` を指す）と ``E0211: cannot find value `raise` in this scope`` の 2 つ
  - `false`: ``E0211: cannot find value `false` in this scope`` の 1 つ
  - `x.unwrap_or(0)`（`x: Option[Int]`）: ``E0313: type `Option[Int]` has no field or function `unwrap_or` `` の 1 つ
  - class の wish check では、`to_array` の 7 か所（`:71` に 2 つ）のうち届いた 2 つに ``E0313: type `List[Span]` has no field or function `to_array` `` と ``E0313: type `List[Int]` has no field or function `to_array` ``（`:71`、`:75`）。残りは、`=` で書いた関数の本体（020）の中、`let`（004）の行、束縛されなかった `kept`（004）の上にあった。repo の外の使い捨ての Pome での `xs.to_array()`（`xs: List[Int]`、2026-11-25）も E0313 の 1 つ
  class の wish check では、`++`（`:124`）と `max`（`:89`）に診断が届かなかった（どちらも `=` で書いた関数の本体（020）の中にあった）。repo の外の使い捨ての Pome での最小の形（2026-11-25）:
  - `xs ++ ys`（`xs`、`ys`: `List[Int]`）: 2 つ目の `+` を指す ``E0118: expected expression``、`ys` を指す ``E0122: expected newline or `}` after statement``、`xs ++` を指す ``E0310: expected a number (`Int`, `Int64` or `Float`), found `List[Int]` `` の 3 つ。`++` を `+` と読み、List に数を求める
  - `max(a, b)`（`a`、`b`: `Int`）: ``E0211: cannot find value `max` in this scope`` の 1 つ
  どれにも help が付かず、`fail`、`False`、`Option.or`、`Array.from_list`、`List.append`、`Int.max` を示さない
- 回避策: 正しい名前に直した（`fail`、`False`、`.or`。`regex/src/syntax.emel`。`Array.from_list(xs)`、`Int.max(a, b)`、List をつなぐ所は `xs.append(ys)`。`regex/src/class.emel`）。`before ++ kept` の行そのものは、021 の書き換え（`before` を逆順の accumulator に cons する）で消えた。正しい書き方に直しただけなので、コードに印は付けない
- コスト:
  コードのコストは無い。直すには spec を引く必要があった（`[error.fail]`、`[lex.literal]` の「Boolean values are not literals. They are `True` and `False`」、`[api.option]`、`[fn.operator]` の演算子の表（`++` は無い）、`[lib.api-rules]` の「A function that joins two values is `append`」、`[api.int]` の `min` / `max`）。004（`let`）と同じく、wish-first（spec を読む前に wish を書く）では、そのときの手がかりは診断だけ
- spec:
  `[error.fail]`、`[kw.reserved]`（`fail`）、`[kw.future]`（`throw` は予約語）、`[lex.literal]`、`[kw.non-keyword]`（`True`、`False` は Prelude の enum の構成子）、`[api.option]`、`[fn.operator]`（「Arithmetic operators can be used only on Int, Int64, and Float (otherwise E0310)」）、`[api.list]`（`append`）、`[lib.api-rules]`、`[api.int]`（`max`。Int64 と Float にも `max` がある）、`spec/diagnostics.md` の E0211、E0313、E0118、E0310
- 既存:
  emela の issue と PR に無い（2026-11-25 に取得した 864 件を、「raise」「unwrap_or」「`false`」で検索。当たったのは `Cause.raise` や性能の PR など別の話題。`++` と `max` は 2026-11-25 に `gh api search/issues` で `is:issue` と `is:pull-request` のそれぞれを「"++"」「"concat operator"」「"append operator"」「"List.append"」「"Int.max"」「max in:title」「E0211 help」で検索。当たったのは別の話題: issue #264 は core に `min` / `max` を足す話（閉じた）、issue #683 は `Int.MIN` と `Int.MAX`、PR は文字列の連結の性能、core の同梱、名前解決、局所関数）。004 の E0146（`let` と `var` の専用の診断）は「AI 向けの案内は文書と skill で書く」として取り下げられた。他の言語の書き方に書き換えを示す診断は残っている: E0142（前置の match）、E0144、E0145、E0147、E0148（式の `fn(...)`）
- 行き先:
  自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: 他の言語でよく使う名前が E0211 や E0313 になったとき、Emela での名前が 1 つに決まるなら help で示してほしい。`raise` → `fail`、`true` と `false` → `True` と `False`、Option の `unwrap_or` → `or`、List の `to_array` → `Array.from_list`、引数が Int の `max(a, b)` → `Int.max(a, b)`（`a.max(b)`。Int64 と Float にも `max` があるので、引数の型で 1 つに決める）。演算子も同じ: List の `xs ++ ys`（E0118 と E0310。E0310 は List に数を求めると読める）→ `List.append(xs, ys)`（`xs.append(ys)`）。004 の `let` → `x = value` と、020 の `fn f() -> T = e` → `{ e }` も同じ表に入る。E0142 や E0148 と同じく、spec を読む前に書いたコードに届くのは診断だけなので

# 016 foreign-name-help

- 状態: open
- Emela: v0.28.2
- 意図: regex の parser（`wish/syntax.emel`）で、error で失敗する、Bool の値を書く、Option の中身を既定値つきで取り出す、という他の言語にもある操作を書く
- こう書きたかった:
  他の言語の名前で書いた（Python、Ruby、Kotlin の `raise`、多くの言語の `false`、Rust の `unwrap_or`）
  - `raise RegexSyntax(...)`: `wish/syntax.emel` の 29 行（`:60`、`:115`、`:234` など）
  - `false`: `:155`、`:158`、`:162`、`:359`
  - `.unwrap_or(...)`: `:155`、`:158`、`:192`、`:336`
- 診断:
  wish check（v0.28.2）では、`raise` に ``error[E0211]: cannot find value `raise` in this scope``（5 つ。残りは同じ行の他の構文エラーに埋もれた）と、`raise` の後ろを値と読んだ ``E0301: type mismatch: expected `(Node, State)`, found `RegexSyntax` ``（6 つ）、`false` に ``E0211: cannot find value `false` in this scope``。`unwrap_or` には診断が届かなかった（4 か所とも、同じ行の `fn(m) { ... }`（E0148）か `let`（004）の構文エラーの後ろにあった）
  repo の外の使い捨ての Pome での最小の形（2026-11-25）:
  - `if c == 0 { raise Oops(message: "zero", offset: 0) } else { c }`: ``E0122: expected newline or `}` after statement``（`Oops` を指す）と ``E0211: cannot find value `raise` in this scope`` の 2 つ
  - `false`: ``E0211: cannot find value `false` in this scope`` の 1 つ
  - `x.unwrap_or(0)`（`x: Option[Int]`）: ``E0313: type `Option[Int]` has no field or function `unwrap_or` `` の 1 つ
  どれにも help が付かず、`fail`、`False`、`Option.or` を示さない
- 回避策: 正しい名前に直した（`fail`、`False`、`.or`。`regex/src/syntax.emel`）。正しい書き方に直しただけなので、コードに印は付けない
- コスト:
  コードのコストは無い。直すには spec を引く必要があった（`[error.fail]`、`[lex.literal]` の「Boolean values are not literals. They are `True` and `False`」、`[api.option]`）。004（`let`）と同じく、wish-first（spec を読む前に wish を書く）では、そのときの手がかりは診断だけ
- spec:
  `[error.fail]`、`[kw.reserved]`（`fail`）、`[kw.future]`（`throw` は予約語）、`[lex.literal]`、`[kw.non-keyword]`（`True`、`False` は Prelude の enum の構成子）、`[api.option]`、`spec/diagnostics.md` の E0211 と E0313
- 既存:
  emela の issue と PR に無い（2026-11-25 に取得した 864 件を、「raise」「unwrap_or」「`false`」で検索。当たったのは `Cause.raise` や性能の PR など別の話題）。004 の E0146（`let` と `var` の専用の診断）は「AI 向けの案内は文書と skill で書く」として取り下げられた。他の言語の書き方に書き換えを示す診断は残っている: E0142（前置の match）、E0144、E0145、E0147、E0148（式の `fn(...)`）
- 行き先:
  自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: 他の言語でよく使う名前が E0211 や E0313 になったとき、Emela での名前が 1 つに決まるなら help で示してほしい。`raise` → `fail`、`true` と `false` → `True` と `False`、Option の `unwrap_or` → `or`。004 の `let` → `x = value` も同じ表に入る。E0142 や E0148 と同じく、spec を読む前に書いたコードに届くのは診断だけなので

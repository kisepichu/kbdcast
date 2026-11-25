# 026 reserved-word-name

- 状態: open
- Emela: v0.28.2
- 意図: regex の program（`regex/src/program.emel` の `item_set` と `escape_set`、計画の Task 6）で、AST の `Syntax.Escape(ClassEscape)`（class の中の `\d` `\w` `\s` とその否定）の中身を、そのまま `escape` という名前で束ねて渡す
- こう書きたかった:
  wish には無い（program は wish-first の単位でない）。構成子の名前を小文字にした束縛名と引数名
  ```emela
  Escape(escape) -> escape_set(escape, ignore_case)

  fn escape_set(escape: ClassEscape, ignore_case: Bool) -> CharSet {
    escape match { ... }
  }
  ```
  regex の差分テストの生成器（`wish/pattern_gen.emel:137` と呼ぶ所の `:100`、`:146-147`、計画の Task 8）でも、pattern の中の文字を書き出す関数を `fn escape(c: String) -> String` と名付け、wish の後の実装（`regex/test/pattern_gen.emel`）でも同じ名前で書いた
- 診断:
  `emela fmt --check` と `emela check`（v0.28.2、2026-11-25）。`escape` が予約語（`[kw.reserved]`）であることを言う診断は無い
  - `Escape(escape)` の `escape` に ``error[E0113]: expected pattern``、`escape_set(escape, ...)` の `escape` に ``error[E0118]: expected expression``
  - `fn escape_set(escape: ...)` の関数名に ``error[E0130]: a function without a body must be `@external` ``、`escape` に ``error[E0110]: expected parameter name``、続けて ``error[E0110]: expected `)` `` と ``error[E0122]: expected newline after declaration``
  - `emela check` ではさらに ``error[E0309]: pattern `Escape` has 1 fields, found 0`` と ``error: not supported yet: reference to this kind of definition``（番号の無い診断）
  E0130 は 020 と同じく「`@external` を付けよ」と読め、引数の名前が原因だとは分からない
  差分テストの生成器（Task 8）: wish check で関数名の `escape` に ``error[E0110]: expected lower name`` が出たのに、実装でまた同じ名前を書いた。`emela check` の診断は 15: 定義の `fn escape(` に ``E0110: expected lower name``、呼ぶ所（`Atom(escape(c))`、`Gen.map(escape)`、補間の中の `#{escape(a)}`）に ``E0118: expected expression`` と E0110、E0122、続けて後追いの ``E0305: wrong number of arguments: `Atom` takes 1, found 0``、``E0305: wrong number of arguments: `map` takes 2, found 1``、``E0301: type mismatch: expected `fn(?9) -> ?10`, found `String` ``。どれも `escape` が予約語だとは言わない
- 回避策: 名前を `class_escape` にした（`regex/src/program.emel`）。差分テストの生成器（Task 8）は `literal` にした（`regex/test/pattern_gen.emel`）。正しい書き方に直しただけなので、コードに印は付けない
- コスト: コードのコストは無い。8 つの診断のうち、原因に近いのは E0110 の「expected parameter name」だけで、`escape` が予約語だと分かるまで spec の `[kw.reserved]` を引く必要があった
- spec: `[kw.reserved]`（`escape` は式の予約語）、`[error.escape]`、`spec/diagnostics.md` の E0113、E0118、E0130、E0110、E0309
- 既存: emela の issue と PR に無い（2026-11-25、`gh api search/issues` で `is:issue` と `is:pull-request` のそれぞれを「reserved word」「keyword identifier」で検索。当たったのは `uses` の改名の proposal #488 と依存の更新 #526 で、別の話題）。020（`=` で書いた関数の本体に E0130 が出る）と同じく、E0130 が原因と別の所を指す
- 行き先: 自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: a reserved word written where a name is expected (a binding in a pattern, a parameter, an argument) should get one diagnostic that says so, ``error: `escape` is a reserved word and cannot be used as a name``, instead of E0113, E0118, E0110 and E0130 (`a function without a body must be @external`, which points at the function's name and suggests the wrong fix), followed by E0309 and an unnumbered `not supported yet: reference to this kind of definition`

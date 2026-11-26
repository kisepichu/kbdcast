# 034 single-letter-variant

- 状態: open
- Emela: v0.28.2
- 意図: key codec の型（`src/key.emel`、サブプロジェクト 2 の計画の Task 2）で、F1〜F12 のキーを `KeyCode` の構成子 `F(FKey)` で表す。spec（`docs/superpowers/specs/2026-11-27-kbdcast-2-key-codec-design.md` の §4）と計画の Interfaces も、この名前で書いた
- こう書きたかった:
  `wish/key.emel:10` の `| F(FKey)`。vim の表記（`<F1>`）と同じく、1 文字の構成子にした
  ```emela
  pub enum KeyCode {
    Char(Int)
    ...
    F(FKey)
  }
  ```
- 診断:
  wish check（v0.28.2）では、同じ行の variant の区切りの `|` の E0110 に埋もれて届かなかった
  実装の `emela check`（v0.28.2、2026-11-27）: `F(FKey)` の `F` に ``error[E0110]: expected variant name (a type name)``。テストで `F(fk)` と書いた 2 か所に ``error[E0211]: cannot find value `F` in this scope``（``= help: did you mean `n`?``）
  repo の外の使い捨ての Pome での最小の形（`enum Code { Up  F(Int) }` と、それを受ける match の腕 `F(n) -> n`、2026-11-27）で 5 つ: 宣言の `F` に ``E0110: expected variant name (a type name)``、パターンの `F(n)` に ``E0110: expected `->` ``、``E0122: expected newline or `}` after match arm``、``E0211: cannot find value `F` in this scope``（``= help: did you mean `c`?``）、``E0211: cannot find value `n` in this scope``。「`F` は大文字だけの名前（const の名前）で、type name には小文字が 1 つ要る」とは言わない。パターンの側は `F` を値として読み、`F(n)` を関数の呼び出しと見ている
- 回避策:
  構成子を `Function(FKey)` にした（`src/key.emel` の `KeyCode`、`FRICTION(034)` の印）。termwiz の `KeyCode::Function(u8)` と同じ名前。計画の Interfaces の名前が変わるので、Task 2 の報告で controller に返し、manager が `Function(FKey)` に決めた（ESCALATION 1）。spec §4 と計画は、manager がこの名前に直す。tape の表記（`<F1>`）は文字列の中なので変わらない
- コスト:
  名前が 1 文字から 8 文字になる（`Function(f)`）。spec、計画、wish の 3 つが同じ名前を前提にしていて、実装まで気づかなかった。wish check では別の診断（区切りの `|`）に隠れた。普段のコードに基盤レベルは漏れていない
- spec: `[lex.name]`（Type name は「PascalCase starting with an uppercase letter and containing at least one lowercase letter」、Uppercase name は「Only uppercase letters, digits, and underscores」で consts と type parameters に使う。「`HTTP` and `DB` cannot be used as type names」）、`[grammar.decl]`（`variant = { annotation } type_name ...`）、`spec/diagnostics.md` の E0110 と E0103
- 既存: 決まった設計（`[lex.name]`）。emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「uppercase name」「variant name」を検索。当たりなし）
- 行き先: 自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: an uppercase name written where a type name is expected (a variant, a type, an enum) gets ``expected variant name (a type name)``, which does not say why `F` is not one. It should say ``` `F` is an uppercase name (a const or a type parameter); a type name needs at least one lowercase letter ([lex.name]) ```, as `[lex.name]` already says for `HTTP`. A pattern `F(n)` with such a name is then read as a call of a value `F`, and gets three more diagnostics that do not point at the name class

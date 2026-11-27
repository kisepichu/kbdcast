# 075 handler-header-uses

- 状態: open
- Emela: v0.28.2
- 意図: recorder の handler `LiveDriver`（`src/recorder/live.emel`、サブプロジェクト 1 の計画の Task 5）が使う effect（`Pty`、`Clock`、`Stdout`。計画の Interfaces の「使うのは」）を、handler の宣言に書く
- こう書きたかった:
  `wish/live.emel:23`。fn の signature の `uses` と同じ形を、handler の頭に書いた
  ```emela
  pub handler LiveDriver: Driver uses { Pty, Clock, Stdout } {
  ```
- 診断:
  wish check（v0.28.2）: `uses` を指す ``error[E0110]: expected `{` `` と ``error[E0122]: expected newline after declaration``。help は付かない。handler の本体は top-level の宣言として読まれ、3 つの操作のそれぞれに ``error[E0130]: a top-level `suspend fn` must be `@external` ``、閉じの `}`（`:121`）に ``error[E0126]: expected declaration``、handler に ``error[E0404]: handler `LiveDriver` does not implement operations `press`, `idle`, `wait_for` ``。本体の中の欄（073）と補助関数（076）には、どちらの診断も届かなかった
  repo の外の使い捨ての Pome での最小の形（`handler Counting: Counter uses { Stdout } { fn tick() { ... } }`、v0.28.2、2026-11-28）: 同じ E0110、E0122、閉じの `}` の E0126、``E0404: handler `Counting` does not implement operation `tick` `` の 4 つ
- 回避策: `uses` を消した（`src/recorder/live.emel`）。handler の要求は、init、release、操作の本体の `use` から決まる。使う effect は handler の上のコメントに書いた（`LiveDriver` は 073 で private になり、外から見える `record` は要求を signature の `uses` に書く）。正しい書き方に直しただけなので、コードに印は付けない
- コスト: コードのコストは無い。handler の要求は宣言を見ても分からない（本体を読むか、コメントを信じる）。普段のコードに基盤レベルは漏れていない
- spec: `[effect.handler]`（「The `use` expressions inside `init` are the requirements of the handler. ... There is no syntax for writing requirements in the handler's header.」、requires(H) は init、release、操作の本体の R の和）、`[grammar.decl]` の `handler_decl`、`spec/diagnostics.md` の E0110、E0130、E0404
- 既存: 決まった設計（`[effect.handler]`）。emela の issue と PR に無い（2026-11-28、`gh search issues --repo emela-lang/emela --include-prs` で「handler uses clause」「handler requirements header」を検索。当たりなし）
- 行き先: 自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: `handler H: E uses { A, B } {` gets ``E0110: expected `{` `` on `uses` and E0122, and then the body of the handler is read as top-level declarations: E0130 on each `suspend fn`, E0126 on the closing `}`, E0404 for every operation. One diagnostic on `uses` with ``help: the requirements of a handler are not written; they are the effects that its init, release and operations use ([effect.handler])``, reading the body as the handler's, would keep the rest of the handler checked

# 072 wildcard-parameter

- 状態: open
- Emela: v0.28.2
- 意図: recorder のテストの handler `TestDriver`（`test/test_driver.emel`、サブプロジェクト 1 の計画の Task 4）で、`Driver.wait_for` の実装が使わない引数（`pattern: Regex`。記録するのは pattern の文字列の `source`、069）を受ける
- こう書きたかった:
  使わない引数を `_` にした（Rust、Haskell、OCaml、Scala と同じ。Emela の anonymous function の引数もパターンなので `|_| ...` と書ける）。test なので wish は書いていない
  ```emela
  suspend fn wait_for(_, source, timeout, resume) {
  ```
- 診断:
  `emela check`（2026-11-28）: `_` を指す ``error[E0110]: expected parameter name`` と ``error[E0134]: handler operation parameters take their types from the effect``。E0134 は型を書いていないのに型を書いたと言い、`_` が書けないとは言わない
  repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-28）: handler の `suspend fn ping(_, m, resume)` は、上の 2 つに続けて ``error[E0406]: wrong number of parameters: operation `ping` takes 3, found 2``（`_` を引数に数えない）と、`resume(())` に ``error[E0301]: type mismatch: expected `fn(?0) -> ?1`, found `Int` ``（引数が 1 つずれて、`resume` が `m` の Int になった）の 4 つ。ふつうの関数の `fn plain(_: Int) -> Int { 1 }` は ``error[E0130]: a function without a body must be `@external` ``、``E0110: expected parameter name``、``E0110: expected `)` ``、``E0122: expected newline after declaration`` の 4 つ（E0130 が違う直し方を勧めるのは 020、026 と同じ）
- 回避策: 引数に名前を付けた（`suspend fn wait_for(pattern, source, timeout, resume)`、`test/test_driver.emel`）。使わない引数の警告は出ない。正しい書き方に直しただけなので、コードに印は付けない
- コスト: コードのコストは無い。読む人には、`pattern` を使わないことが名前から分からない。普段のコードに基盤レベルは漏れていない
- spec: `[grammar.decl]`（`param = "self" | lower_name [ ":" type ]`、handler の操作も `lower_name` の列。`_` は lower_name でない）、`[grammar.expr]`（`lambda_param = pattern [ ":" type ]`）、`[effect.handler]`、`spec/diagnostics.md` の E0110、E0134、E0406、E0130
- 既存: emela の issue と PR に無い（2026-11-28、`gh search issues --repo emela-lang/emela --include-prs` で「wildcard parameter」「underscore parameter」「E0134」を検索。当たったのは parser の最初の PR #123 だけ）
- 行き先: 自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: `_` as a parameter of a fn or a handler operation gets ``E0110: expected parameter name`` and then diagnostics that point elsewhere: E0134 (``handler operation parameters take their types from the effect``, though no type is written), E0406 with the `_` not counted, and E0130 for a plain fn. One diagnostic would do: ``a parameter needs a name; `_` is only a pattern (in an anonymous function, `|_| ...`)``, and the parser could count the `_` as a parameter so that the rest of the signature is still checked. Allowing `_` as a parameter name (as anonymous functions already do) is the alternative, a proposal

# 063 handler-init-fails

- 状態: open
- Emela: v0.28.2
- 意図: pty-bun の handler `BunPty`（`pty-bun/src/lib.emel`、サブプロジェクト 1 の計画の Task 3）で、プロセスを起動できないときに init が `SpawnFailed` で失敗することを、init の宣言に書く。計画の Interfaces も `init(argv: List[String], cols: Int, rows: Int, cwd: String, env: List[String]) fails SpawnFailed` と書いている
- こう書きたかった:
  `wish/pty_bun.emel:37`。fn と同じく、引数の後ろに `fails` を書いた
  ```emela
  init(argv: List[String], cols: Int, rows: Int, cwd: String, env: List[String]) fails SpawnFailed {
  ```
- 診断:
  wish check（v0.28.2）は診断を出さずに compiler が panic した。wish のほかの誤り（065〜068、004、011、045、056）の診断も 1 つも出なかった
  ```
  thread 'main' panicked at crates/emela-syntax/src/parser.rs:219:9:
  expected to be at L_BRACE, found LOWER_NAME
  ```
  repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-28）: 引数のある init の `)` と `{` の間に何かを書くと、どれも同じ panic になる。`init(x: Int) fails SpawnFailed {`、`init(x: Int) uses { Pty } {`（`found LOWER_NAME`）、`init(x: Int) -> BunPty {`（`found THIN_ARROW`）。引数の無い `init fails SpawnFailed {` は panic せず、`init` を指す ``error[E0110]: expected `init`, `release`, operation (`fn`) or inner handler (`handler`)`` になる（`init` と書いてあるのに `init` を求める）
  v0.28.2 の parser（`crates/emela-syntax/src/parser/grammar/items.rs` の `handler_decl`）は、init の引数の後ろで `block(p)` を呼び、`block` が `{` の上にいることを assert する。checkout の main（596b6038）では `if p.at(L_BRACE) { block(p); }` に変わっていて、panic はしない見込み（[INFERENCE]: main の compiler では確かめていない）
- 回避策:
  init に `fails` を書かず、E を推論に任せた（`pty-bun/src/lib.emel` の init。`FRICTION(063)` の印）。`with BunPty(...)` の E には `SpawnFailed` が入る（`pty-bun/test/bun_pty_test.emel` の `run` が `fails SpawnFailed` で通り、`a_command_that_does_not_exist_fails_to_spawn` の escape の腕に W0302 が出ない）。Interfaces の意味は保てた。init が fail できないときの代わりの形（`read` が最初に `Exited(127)` を返す）は要らなかった
- コスト:
  1 行の注釈が書けないだけで、コードは増えない。公開の handler の失敗の範囲が宣言に出ず、読む人は init の本体を読むか language server の hover（`init fails E` の行、`[lsp.hover]`）を見る。init の本体が別の error を投げるように変わっても compiler は止めず、`with BunPty(...)` を書いた所すべての E が黙って広がる（fn なら `fails` が E0318 で止める）。普段のコードに基盤レベルは漏れていない
- spec:
  `[grammar.decl]`（`handler_item = "init" [ "(" [ params ] ")" ] block | ...`。init に fails も uses も書けない）、`[effect.handler]`（init の E は with の E に入る。handler member には `fails` を書け、それが init の E になる）、`[effect.with]`、`[dyn.order]`（init が失敗したら、その handler の release は走らない）、`[error.fails]`
- 既存: emela の issue と PR に無い（2026-11-28、`gh search issues --repo emela-lang/emela --include-prs` で「L_BRACE」「init fails」「handler init」「panicked parser」を検索。当たったのは init の引数の proposal #389 と実装 #398 など、別の話題）
- 行き先:
  - panic: spec と実装がずれている（バグ）→ issue。下書き（未提出。出すのは user）: A handler `init` with parameters followed by anything other than `{` (`init(x: Int) fails E {`, `init(x: Int) -> H {`, `init(x: Int) uses { R } {`) panics the parser in v0.28.2 (`parser.rs:219:9: expected to be at L_BRACE, found LOWER_NAME`) instead of reporting a diagnostic, and no other diagnostic of the file is shown. Without parameters, `init fails E {` gets ``E0110: expected `init`, `release`, ...`` at the `init` token. main (596b6038) no longer calls `block` unconditionally; a diagnostic that says init takes no `fails` (as E0136 does for impl methods) would help
  - init の E を宣言できない: 前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない。未提出。出すのは user）。handler member は `handler Open(path: String): ReadFile fails E` と init の E を宣言できるのに、ふつうの handler の init は書けない。`init(...) fails E { ... }` を fn と同じ意味（E を強制する）で許す案

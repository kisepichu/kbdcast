# 065 handler-op-signature

- 状態: open
- Emela: v0.28.2
- 意図: pty-bun の handler `BunPty`（`pty-bun/src/lib.emel`、サブプロジェクト 1 の計画の Task 3）で、effect `Pty` の操作 `read` と `write` を実装する
- こう書きたかった:
  `wish/pty_bun.emel:50`、`:55`。effect の宣言と同じ signature（引数の型と返り値の型）を、実装の側にも書いた（Rust の `impl Trait for T` の `fn`、Koka の handler の `fun` のつもり）
  ```emela
  suspend fn read() -> Output {
  fn write(b: Bytes) -> () {
  ```
- 診断:
  wish check（v0.28.2）は 063 の panic で何も出さなかった。panic の原因の `fails` だけを消した写しの `emela check`（2026-11-28）: 引数の型の `b: Bytes` に ``error[E0134]: handler operation parameters take their types from the effect``（何を直せばよいかを言う）。返り値の型の `-> Output` と `-> ()` には何も出ない
  返り値の型を書いても何も出ないのは、黙って捨てているから。repo の外の使い捨ての写しで、正しい実装の後ろに嘘の signature を足した `suspend fn read(resume) -> String fails Nope uses { Nothing } {` と、本体が `()` の `fn write(b) -> Int {` は、どちらも `emela check` が診断なしで通る（exit 0。`Nope` と `Nothing` はどこにも無い名前）
  v0.28.2 の parser は handler の操作を `fn_decl` で読むので、返り値の型と `fails` と `uses` も木に入る。validation（`crates/emela-syntax/src/validation.rs`）は、`HANDLER_DECL` の中の fn には引数の型（E0134）だけを調べ、`RET_TYPE`、`FAILS_CLAUSE`、`USES_CLAUSE` を E0136 で止めるのは `IMPL_DECL` の中の fn だけ。checkout の main（596b6038）も同じ
- 回避策: 引数の型と返り値の型を消した（`suspend fn read(resume)`、`fn write(b)`。`pty-bun/src/lib.emel`）。正しい書き方に直しただけなので、コードに印は付けない（`resume` は 066）
- コスト:
  コードのコストは無い。書いた返り値の型が嘘でも通るので、読む人は書いてある型を信じられない（effect の宣言と違う型を書いても、型検査は effect の側の型で進む）。普段のコードに基盤レベルは漏れていない
- spec:
  `[grammar.decl]`（`handler_item = ... | [ "suspend" ] "fn" lower_name "(" [ lower_name { "," lower_name } ] ")" block`。返り値の型を書く所が無い）、`[effect.handler]`（「The types of an operation's parameters and return value are determined by the effect's declaration, so they are not written.」）、`spec/diagnostics.md` の E0134 と E0136
- 既存: emela の issue と PR に無い（2026-11-28、`gh search issues --repo emela-lang/emela --include-prs` で「handler operation return type」を検索。当たりなし）
- 行き先:
  spec と実装がずれている（バグ）→ issue。下書き（未提出。出すのは user）: In a handler, an operation written with a return type, `fails` or `uses` (`fn write(b) -> Int { () }`, `suspend fn read(resume) -> String fails Nope uses { Nothing } { ... }`) passes `emela check` without a diagnostic in v0.28.2, even when the names in it do not exist. The grammar has no return type for a handler operation, and `[effect.handler]` says that the types are not written. Validation rejects these clauses with E0136 only for impl methods; a handler operation could get the same diagnostic (``handler operations take their signature from the effect``), as its parameters already do with E0134

# 068 external-type-file

- 状態: open
- Emela: v0.28.2
- 意図: pty-bun（`pty-bun/src/lib.emel`、サブプロジェクト 1 の計画の Task 3）で、JS の側（`./pty.mjs`）の端末とプロセスのオブジェクトを、Emela の側では中身の見えない host type `Host` として渡し回す
- こう書きたかった:
  `wish/pty_bun.emel:11-12`。関数の `@external` と同じく、型の `@external` にも、その値を作る JS のファイルを書いた
  ```emela
  @external(js, "./pty.mjs")
  type Host
  ```
- 診断:
  wish check（v0.28.2）は 063 の panic で何も出さなかった。panic の原因の `fails` だけを消した写しの `emela check`（2026-11-28）: 引数の `(js, "./pty.mjs")` を指す ``error[E0141]: `@external` on a type takes no arguments``。何を直せばよいかを言う
- 回避策: 引数を消して `@external` だけにした（`pty-bun/src/lib.emel` の `Host`）。どのファイルの値かはコメントに書いた。spec の決まった形に直しただけなので、コードに印は付けない
- コスト: コードのコストは無い。診断で直せた。普段のコードに基盤レベルは漏れていない
- spec: `[ext.host-type]`（「The annotation takes no arguments.」「Writing an argument list on the annotation of an `@external type` is E0141, even an empty `()`.」）、`spec/diagnostics.md` の E0141
- 既存: 決まった設計（`[ext.host-type]`）
- 行き先: 自分の誤解だった。診断は十分なので、出すものは無い

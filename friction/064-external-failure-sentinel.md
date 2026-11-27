# 064 external-failure-sentinel

- 状態: open
- Emela: v0.28.2
- 意図: pty-bun（`pty-bun/src/lib.emel`、サブプロジェクト 1 の計画の Task 3）で、host の `Bun.spawn` が投げる起動の失敗（コマンドが無いなど）を、handler の init の `SpawnFailed` にする
- こう書きたかった:
  external の関数そのものが、成功なら Host を、失敗なら理由を返す（`fn open(...) -> Host fails SpawnFailed`、または `-> Result[Host, String]`）。wish（`wish/pty_bun.emel:14-18`、`:38-42`）は、計画が決めた JS の形（`open` と `openError`）に合わせて、初めから次の形で書いた
  ```emela
  let h = open(argv.to_array(), cols, rows, cwd, env.to_array())
  let message = open_error(h)
  if message != "" {
    fail SpawnFailed(message)
  }
  ```
- 診断: なし（wish の形がそのまま通る。wish check の panic は 063）
- 回避策:
  JS の側の `open` が例外を受け止めて、理由を Host の中に持たせ、もう 1 つの external の `openError` が理由を返す。起動できたときは `""`。init は `open_error(host)` が `""` でなければ `SpawnFailed(message:)` で失敗する（`pty-bun/src/lib.emel` の `open_error`。`FRICTION(064)` の印）
- コスト:
  失敗を聞くためだけの external が 1 つ増え、JS の側に `error` の欄と、起動できなかった Host（プロセスの無い Host）ができる。「`""` なら成功」は約束でしかなく、型は何も言わない。Bun が空の message の Error を投げたら、起動できなかったのに init が成功し、`read` は来ない終了を待ち続ける（[INFERENCE]: そういう Error を Bun が投げるかは確かめていない）。普段のコードに基盤レベルは漏れていない
- spec:
  `[ext.exception]`（「`fails` cannot be written on the declaration of an external function. A result to be treated as a failure is returned as a value by the host side and turned into a fail inside a handler.」。JS の例外は defect になる）、`[ext.boundary]`（境界の型に Option も Result も無い。List と利用者の型も渡せない）
- 既存: 決まった設計（`[ext.exception]`）。emela の issue と PR は探していない
- 行き先: 前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない。未提出。出すのは user）。「host が値で返した失敗を handler の中で fail にする」ための境界の形が無く、毎回 sentinel か、問い合わせの external を作ることになる。`Option[A]`（JS の `null` / `undefined`）を境界の型に入れる案、または JS の reject を決まった error の型（`HostError(message: String)`）の fail として受ける宣言（`@external(...) fn f(...) -> A fails HostError`）の案

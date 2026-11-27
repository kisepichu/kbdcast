# 064 external-failure-sentinel

- 状態: open
- Emela: v0.28.2
- 意図: pty-bun（`pty-bun/src/lib.emel`、サブプロジェクト 1 の計画の Task 3）で、host の `Bun.spawn` が投げる起動の失敗（コマンドが無いなど）を、handler の init の `SpawnFailed` にする
  同じ pty-bun の `read` でも、host の側の「出力が終わった（プロセスが終了した）」と、その終了コードを、handler の `Output`（`Data(Bytes)` か `Exited(Int)`）にする
- こう書きたかった:
  external の関数そのものが、成功なら Host を、失敗なら理由を返す（`fn open(...) -> Host fails SpawnFailed`、または `-> Result[Host, String]`）。wish（`wish/pty_bun.emel:14-18`、`:38-42`）は、計画が決めた JS の形（`open` と `openError`）に合わせて、初めから次の形で書いた
  ```emela
  let h = open(argv.to_array(), cols, rows, cwd, env.to_array())
  let message = open_error(h)
  if message != "" {
    fail SpawnFailed(message)
  }
  ```
  `read` では、external の `read_output` が終わりを `None` で返す（`suspend fn read_output(h: Host) -> Option[Bytes]`）か、`Output` をそのまま返す形にしたかった。前者なら handler は `resume(read_output(self.host) match { Some(b) -> Data(b); None -> Exited(exit_code(self.host)) })` と書ける。wish（`wish/pty_bun.emel:20-21`、`:26-27`、`:50-53`）は、ここも計画の JS の形に合わせて、空の Bytes を終わりとし、終了コードを `exit_code` で問い合わせる形で書いた
- 診断: なし（wish の形がそのまま通る。wish check の panic は 063）
- 回避策:
  JS の側の `open` が例外を受け止めて、理由を Host の中に持たせ、もう 1 つの external の `openError` が理由を返す。起動できたときは `""`。init は `open_error(host)` が `""` でなければ `SpawnFailed(message:)` で失敗する（`pty-bun/src/lib.emel` の `open_error`。`FRICTION(064)` の印）
  `read`: JS の側の `read` は、出力が終わると空の `Uint8Array` を返し、`exitCode` が終了コードを返す（`pty-bun/src/pty.mjs` の `read` と `exitCode`。終了するまでの `code` は -1）。handler は `b.is_empty()` なら `Exited(exit_code(self.host))`、そうでなければ `Data(b)` にする（`pty-bun/src/lib.emel` の `read`。`read_output` に `FRICTION(064)` の印）
- コスト:
  失敗を聞くためだけの external が 1 つ増え、JS の側に `error` の欄と、起動できなかった Host（プロセスの無い Host）ができる。「`""` なら成功」は約束でしかなく、型は何も言わない。Bun が空の message の Error を投げたら、起動できなかったのに init が成功し、`read` は来ない終了を待ち続ける（[INFERENCE]: そういう Error を Bun が投げるかは確かめていない）。普段のコードに基盤レベルは漏れていない
  `read`: 終わりを知らせるための external（`exit_code`）がもう 1 つ増え、「空の Bytes なら終わり」も約束でしかない。JS の側の `read` は、`chunks` に入った chunk の数で出力の有無を見るので、Bun が長さ 0 の chunk で `data` を呼べば、`take` が空の `Uint8Array` を返し、handler は動いているプロセスに `Exited(-1)` を返す（[INFERENCE]: Bun が長さ 0 の chunk を渡すかは確かめていない）。打ち切られた `read` の空の結果は runtime が捨てるので、こちらで `Exited(-1)` になることは無い（最終レビュー）
- spec:
  `[ext.exception]`（「`fails` cannot be written on the declaration of an external function. A result to be treated as a failure is returned as a value by the host side and turned into a fail inside a handler.」。JS の例外は defect になる）、`[ext.boundary]`（境界の型に Option も Result も無い。List と利用者の型も渡せない）
- 既存: 決まった設計（`[ext.exception]`）。emela の issue と PR に、境界で失敗や Option を返す話は無い（2026-11-28、`gh search issues --repo emela-lang/emela --include-prs` で「external Option」「external fails」「external Result」「external function fail」「boundary Option」「Option boundary」「sentinel」「HostError」「ext.boundary」「ext.exception」を検索。当たったのは別の話題: `[ext.boundary]` の検査が外部関数の宣言に掛からないことの #815（open）、外部関数をそのモジュールの effect にする proposal #820、native の境界の Bytes の #881 と #884、wasm の module 分けの #376 など）
- 行き先: 前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない。未提出。出すのは user）。「host が値で返した失敗を handler の中で fail にする」ための境界の形が無く、毎回 sentinel か、問い合わせの external を作ることになる。`Option[A]`（JS の `null` / `undefined`）を境界の型に入れる案、または JS の reject を決まった error の型（`HostError(message: String)`）の fail として受ける宣言（`@external(...) fn f(...) -> A fails HostError`）の案

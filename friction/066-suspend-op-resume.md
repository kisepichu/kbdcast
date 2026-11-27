# 066 suspend-op-resume

- 状態: open
- Emela: v0.28.2
- 意図: pty-bun の handler `BunPty`（`pty-bun/src/lib.emel`、サブプロジェクト 1 の計画の Task 3）で、`Pty` の `suspend fn read()` を実装する。本体は host の `@external suspend fn` を 1 回待ち、その結果を `Output` にして返すだけ
- こう書きたかった:
  `wish/pty_bun.emel:50-53`。fn の操作と同じく、本体の値を操作の値にする（direct style）
  ```emela
  suspend fn read() -> Output {
    let bytes = read_host(host)
    if bytes.is_empty() { Exited(exit_code(host)) } else { Data(bytes) }
  }
  ```
  LiveDriver の wish（`wish/live.emel:39-56`、サブプロジェクト 1 の計画の Task 5）でも、3 つの suspend fn の操作を `resume` を受けない direct style で書いた（本体が終われば呼んだ側が続く）
- 診断:
  wish check（v0.28.2）は 063 の panic で何も出さなかった。panic の原因の `fails` だけを消した写しの `emela check`（2026-11-28）: `read` を指す ``error[E0406]: wrong number of parameters: operation `read` takes 1, found 0``。宣言の `read()` には引数が無いので「1 つ取る」と言われても分からず、それが `resume` だとは言わない。help も付かない
  `resume` を足して本体を direct style のままにした `suspend fn read(resume) { ...; if ... { Exited(...) } else { Data(b) } }` は、2 つの腕に ``error[E0301]: type mismatch: expected `()`, found `Output` ``。これも `resume` を呼ぶよう言わない
  `resume` を呼ばない本体（`suspend fn read(resume) { b = read_output(self.host); () }`）は、`emela check` が診断なしで通る（2026-11-28、使い捨ての写し）。呼び出した側は二度と再開されず、中断として巻き戻る（`[dyn.suspend]`）
  LiveDriver の wish check（v0.28.2）は、handler の頭の `uses`（075）で handler の本体を top-level として読んだので、3 つの操作に ``E0130: a top-level `suspend fn` must be `@external` `` が出ただけで、この論点の E0406 には届かなかった
- 回避策:
  `resume` を受けて呼ぶ形にした（`pty-bun/src/lib.emel` の `read`: `b = read_output(self.host)` の後に `resume(if b.is_empty() { Exited(...) } else { Data(b) })`）。spec の決まった形に直しただけなので、コードに印は付けない
  LiveDriver（`src/recorder/live.emel`）も、3 つの操作で `resume` を受け、本体の終わりで `resume(())` と呼んだ。失敗する所（`running()`、`Encode.encode`、`read_window` などの `ProcessExited`、`WaitTimeout`）は `resume` を呼ばずに fail で抜ける。印は付けない
- コスト:
  1 行の `resume(...)` で、コードはほとんど増えない。外部の待ちを 1 回するだけの操作でも継続を手で渡す形になり、`resume` を呼び忘れても compiler は止めない（その read を呼んだ fiber が黙って中断になる）。`@external suspend fn` を待つだけなら、本体の値をそのまま `resume` に渡す以外の使い方は無い。普段のコードに基盤レベルは漏れていない
- spec:
  `[effect.handler]`（「The implementation of a suspend fn receives `resume` as its last parameter.」「The value of the implementation body is discarded, so the type of the body MUST be `()`.」）、`[effect.async]`（`resume` を直接呼ぶだけなら Async を足さない）、`[ext.call]`（待っている外部の関数は、呼んだ側が中断されると abort され、実装も巻き戻る）、`[dyn.suspend]`、`spec/diagnostics.md` の E0406
- 既存: emela の issue と PR に無い（2026-11-28、`gh search issues --repo emela-lang/emela --include-prs` で「resume parameter」を検索。当たりなし）
- 行き先:
  - 自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: For `suspend fn read() { ... }` in a handler, E0406 says ``operation `read` takes 1, found 0`` although the effect declares `read()` with no parameter. When the missing parameter is the resume of a suspend fn, the message could say so: ``a `suspend fn` implementation takes `resume` as its last parameter: `suspend fn read(resume)` ``. The same help would fit the E0301 ``expected `()` `` on a body whose value has the return type of the operation
  - 前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない。未提出。出すのは user）。`resume` の引数を書かない suspend fn の実装は、本体の値で 1 回だけ再開する（`resume(body)` の糖衣）。継続は 1 回しか再開できないという前提（`[intro.premises]`）に沿う

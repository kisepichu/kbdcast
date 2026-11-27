# 071 effect-op-by-name

- 状態: open
- Emela: v0.28.2
- 意図: recorder の `run_tape`（`src/recorder.emel`、サブプロジェクト 1 の計画の Task 4）で、domain の port の effect `Driver` の操作（`press`、`idle`、`wait_for`）を呼ぶ
- こう書きたかった:
  `wish/recorder.emel:45-46`、`:54`、`:61`。module の関数と同じく、effect の名前で修飾して呼んだ（Unison の ability の `Driver.press`、Koka の操作を名前で呼ぶ形のつもり）
  ```emela
  keys.each(|key| {
    Driver.press(key)
    Driver.idle(typing)
  }) escape { ... }
  ```
- 診断:
  wish check（v0.28.2）は、4 か所とも `:36` の前置の match（E0142）の `=>` の腕の中にあり、届かなかった。実装をこの形で書いた `emela check`（2026-11-28、match と `=>` だけ直した）: 呼び出しごとに、`Driver` を指す ``error[E0217]: expected module or trait, found effect `Driver` `` と ``help: call the operations of an effect through its capability: `(use Driver).op(...)` `` が 4。直し方を言う
  続けて、その呼び出しの escape の腕に ``warning[W0302]: error `ProcessExited` is never raised here`` が 3 と、同じ形の `WaitTimeout` のものが 1。呼び出しが読めなかったので E が空になった後追いで、腕は正しい
- 回避策: `run_steps` の始めで `driver = use Driver` と capability を束ね、`driver.press(key)`、`driver.idle(typing)`、`driver.wait_for(...)` と呼んだ（`src/recorder.emel`）。spec の決まった形に直しただけなので、コードに印は付けない
- コスト: 束縛の 1 行。普段のコードに基盤レベルは漏れていない（`use` は基盤レベルの keyword ではない）
- spec: `[effect.use]`（「Operations can be called only through a capability value, in the form `log.info(...)`. There is no form that calls them directly by effect name (`Logger.info(...)`).」）、`spec/diagnostics.md` の E0217 と W0302
- 既存: 決まった設計（`[effect.use]`）
- 行き先: 自分の誤解だった。E0217 の help は十分。診断の改善の下書き（未提出。出すのは user）: when a call cannot be resolved (E0217 on `Driver.press(key)`), its E is unknown, so the arms of an `escape` around it should not get ``W0302: error `ProcessExited` is never raised here``; the arms are correct, and the warnings point away from the one error to fix（061 の `Int64.parse` の W0302 と同じ後追い）

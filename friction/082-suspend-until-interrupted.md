# 082 suspend-until-interrupted

- 状態: open
- Emela: v0.28.2
- 意図: LiveDriver のテスト用の handler `FakePty`（`test/fake_pty.emel`、サブプロジェクト 1 の計画の Task 5）で、script にもう出力も終了も無いときの `read` を、割り込まれるまで（LiveDriver の `Fiber.timeout` が打ち切るまで）待たせる
- こう書きたかった:
  test の handler で、wish-first の単位でないので wish は無い。割り込まれるまで待つ関数を 1 つ呼ぶ形（Kotlin の `awaitCancellation()`、JS の `new Promise(() => {})`、Go の `select {}` のつもり）
  ```emela
  ([], [], None) -> Fiber.never()
  ```
- 診断:
  なし（書けない形ではなく、そういう関数が無い）。repo の外の使い捨ての Pome での試し（v0.28.2、2026-11-28。effect `Source` の `suspend fn next() -> Int` を 2 つの handler で待たせ、`TestClock` の下で呼ぶ）:
  - 最大の Int だけ `sleep` する handler（`FakePty` と同じ形）: `Fiber.timeout(100, || s.next())` は `None`。timeout の無い `s.next()` は、仮想の時間を 2147483647 ms（約 24.8 日）進めて戻り、そのときの `now` の 2147483647 を返した
  - 操作の中で `Fiber.scope(|| Deferred.await(Fiber.deferred()))`（何も入れない Deferred を待つ）handler: `emela check` は通り、`Fiber.timeout(100, ...)` は `None`。timeout の無い呼び出しは、test の結果が `interrupted` になった（待つものが無くなった test は interrupted になる。`spec/tooling/test-runner.md:115`）
- 回避策:
  `const FOREVER: Int = 2147483647` を置き、何も来ない `read` は `clock.sleep(FOREVER)` の後に `next_output()` をもう一度呼ぶ（`test/fake_pty.emel` の `FOREVER` と、`next_output` の `([], [], None)` の腕。`FRICTION(082)` の印 2 か所）。LiveDriver の `read` はどれも `Fiber.timeout` の下にあるので、`TestClock` は先に timeout の子の sleep を起こし、待っている `read` は割り込まれる
- コスト:
  const 1 つと、2 行の腕。「割り込まれるまで」は約束でしかなく、timeout の無い `read` は仮想の時間を 24.8 日進めて、また待つ（失敗も defect もせず、時刻だけが大きく進む）。上の Deferred の形なら timeout の無い `read` は interrupted で終わるが、待つためだけに scope と、誰も満たさない Deferred を作ることになり、これも回り道。test の handler の中だけで、普段のコードに基盤レベルは漏れていない
- spec:
  `[api.std.clock]`（`sleep(ms: Int)`。`TestClock` は、進める fiber が無くなると一番早い sleep の時刻まで進めて起こす）、`[api.std.fiber]`（`scope`、`deferred`。`timeout` は、Clock で ms だけ待つ子が先に終われば None を返す）、`[api.std.deferred]`（`await` は値が入るまで待つ）、`spec/tooling/test-runner.md:115`（待つものが無くなった test は interrupted）。割り込まれるまで待つ関数は std に無い
- 既存: emela の issue と PR に無い（2026-11-28、`gh search issues --repo emela-lang/emela --include-prs` で「never」「await forever」「until interrupted」「Fiber never」「awaitCancellation」「suspend forever」を検索。「never」の当たりは、`Task.Background` が閉じないことの proposal #871 と、それにつながる #861、#872、#873 など、別の話題。ほかは当たりなし）
- 行き先: 前提の範囲内で spec に足りない → proposal の材料（まだ書かない）。今の使い道は test の handler の 1 か所だけなので、使い道が増えなければ捨ててもよい。未提出。出すのは user

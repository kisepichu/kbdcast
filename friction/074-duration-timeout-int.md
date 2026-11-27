# 074 duration-timeout-int

- 状態: open
- Emela: v0.28.2
- 意図: recorder の handler `LiveDriver`（`src/recorder/live.emel`、サブプロジェクト 1 の計画の Task 5）で、`idle(d)` の窓の残りと、`wait_for` の timeout の残り（期限の `Instant` と今の差）だけ PTY を読み、`Fiber.timeout` で打ち切る。窓の長さも timeout も tape から来た `Duration`
- こう書きたかった:
  `wish/live.emel:62`、`:79`。残りの長さを Duration のまま timeout に渡す（Kotlin の `withTimeout(Duration)`、Rust の tokio の `timeout(Duration, f)`、Go の `context.WithTimeout(ctx, time.Duration)` のつもり）
  ```emela
  match Task.timeout(Duration.ms(left), fn() { Pty.read() }) { ...    # left: 窓の残りの ms
  ...
  let left = deadline - Clock.now()                                   # Duration
  match Task.timeout(left, fn() { Pty.read() }) { ...
  ```
- 診断:
  wish check（v0.28.2）は、`Std.Task` が無いこと（``error[E0205]: undefined module `Std.Task` ``。v0.28.2 の timeout は `Std.Fiber` にある）、`Duration.ms` の ``error[E0212]: module `Std.Duration` has no `ms` ``、`let`（004）で止まり、型の違いには届かなかった
  `[api.std.fiber]` の `timeout(ms: Int, f)` と `[api.std.clock]` の `sleep(ms: Int)` は Int のミリ秒を受ける。一方、長さの型の `Duration` の中身は Int64 のミリ秒で、`to_milliseconds` は Int64 を返し、`Instant.since` は Duration を返す
- 回避策:
  `millis(d: Duration) -> Int { Int64.to_int(d.to_milliseconds()) }` を置き、窓の長さ、経過、残りを Int のミリ秒で計算して `Fiber.timeout` に渡した（`src/recorder/live.emel` の `millis`、`FRICTION(074)` の印。呼ぶ所は 4 つ）。test の `FakePty`（`test/fake_pty.emel` の `millis`）も、仮想時間の `Instant` を `Clock.sleep` に渡す Int のミリ秒にする
- コスト:
  変換の関数 1 つ。`Int64.to_int` は下位 32 bit に wrap するので、2147483647 ms（約 24.8 日）を超える長さは黙って別の値になる（kbdcast の tape の Duration は 061 で Int の範囲に限られるので、ここでは起きない）。時間の長さを、型の付いた Duration でなく、単位を名前（`left`、`window`）で覚えておく Int で扱う。普段のコードに基盤レベルは漏れていない
- spec: `[api.std.fiber]`（`timeout[A, E, R](ms: Int, f: ...)`）、`[api.std.clock]`（`sleep(ms: Int)`）、`[api.std.duration]`（中身は Int64 のミリ秒、`to_milliseconds` は Int64）、`[api.std.instant]`（`since` は Duration）、`[api.int64]`（`to_int` は下位 32 bit に wrap）
- 既存:
  checkout の main（596b6038）でも、`Clock` は `sleep(ms: Int)`、`timeout` は `Task.timeout(ms: Int, ...)`（`proposals/task.md` で `Std.Fiber` が `Std.Task` になった）。emela の issue と PR に、timeout や sleep が Duration を受ける話は無い（2026-11-28、`gh search issues --repo emela-lang/emela --include-prs` で「timeout Duration」「sleep Duration」「Fiber.timeout」「Int64.to_int」を検索。当たったのは Fiber.timeout を足した #201、Std.Process の #575 などで、別の話題）
- 行き先:
  前提の範囲内で spec に足りない → proposal の材料（まだ書かない）。`Clock.sleep` と `timeout` が Duration を受ける（`Duration` と `Instant` が std に入った後も、待つ関数だけが Int のミリ秒のまま）。未提出。出すのは user

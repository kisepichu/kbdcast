# 032 monotonic-clock

- 状態: open
- Emela: v0.28.2
- 意図: regex の時間のテスト（`regex/test/linear_test.emel` の `replace_builds_its_result_in_time_proportional_to_the_matches`）で、`"a"` × 4000 に対する `replace` と `find_all` にかかった時間を、`Std.Clock` の `(use Clock).now()` の差（`now().since(start)`）で測って比べる。知りたいのは経過した時間で、時刻ではない。`emela test` は JS に出したコードを Bun 1.4.3 で走らせ、handler は `SystemClock`
  recorder の handler `LiveDriver`（`src/recorder/live.emel` の `read_window` と `wait_screen`、サブプロジェクト 1 の計画の Task 5）でも、`idle` の窓の中で出力を読んだ時刻（窓の始まりからの経過）と、窓と `wait` の残りの長さを、`(use Clock).now()` の差で測る。知りたいのは、ここでも経過した時間
- こう書きたかった: 10 回の時間の和をそのまま比べる形（commit `17a6984` のテスト）。`now` の差がそのまま経過した時間なら、この形で足りた
  ```emela
  took = |f| {
    start = clock.now()
    _ = List.range(0, 10).map(|_| f(input))
    clock.now().since(start).to_milliseconds()
  }
  ```
  recorder の wish（`wish/live.emel:60`、`:65`、`:75`）も、経過と残りを `(Clock.now() - start)` と `deadline - Clock.now()` の差で測り、窓の中の出力の時刻を `tape_ms + min(経過, window)` とする形で、壁時計の飛びを考えていなかった。経過を単調な時計で読めれば（下の下書きの `elapsed`）、`previous` の引数も、後ろへの飛びに備える `Int.max` も要らない
- 診断: なし（実行時の現象）
- 回避策: 1 回ごとに時間を測り、10 回の中央値を比べる形にした（commit `5de6b6f`。今は `regex/test/linear_test.emel:53-66` の `took` で、`:56` に `FRICTION(032)` の印。中央値を読む所は 009）。壁時計の飛びを含んだ 1 回は並べた最後に来るので、中央値は動かない。1 回の `took` は 1 秒に満たず、飛びは約 32 秒おきなので、1 回の `took` に入る飛びは多くて 1 つ
  recorder（`src/recorder/live.emel` の `read_window`、`:109` に `FRICTION(032)` の印）: 窓の中の出力の時刻を `Int.max(previous, Int.min(経過, window))` にし、窓の中の前の出力の時刻 `previous` を引数で次へ渡す。壁時計が後ろへ飛んでも窓の中の時刻が前の出力より前にならず、前へ飛んでも窓の外に出ない（`Int.min` は、期限の少し後に終わる read の分にも要る）。窓と `wait` の残りは `now` の差のままで、前への飛びで短くなるのは避けていない
- コスト:
  - 行数: 時間を測る式が 3 行から 7 行になった（`start` と `since` を `map` の中に入れ、`sort` して中央値を読む）。ほかに、印のコメントが 2 行と、テストのコメントの中央値にする理由が 3 行。中央値を読む `Assert.some` と、そのための `import Brix.Assert` は 009 に数える
  - 性能: `now` を読む回数が 2 回から 20 回になり、10 個を並べ替える。1 回 12〜43 ms の呼び出し（friction-review の後の修正で見た中央値の幅）に比べれば小さい。1 回ずつを整数の ms で測るので、比は和の形より粗い（和の形は 65 回で 1.02〜1.88 倍。中央値の形は、friction-review の後の修正の 40 回で 1.07〜2.27 倍、測る関数を型引数で書いた commit `982fe1d` の後の 25 回で 1.06〜1.67 倍。上限は 4 倍）
  - 普段のコードに基盤レベルは漏れていない（`use Clock` と `with SystemClock` は和の形にもある）
  - recorder: 引数 1 つと clamp 2 つ。前への飛びが入った `idle` の窓は実時間で飛びの分だけ短くなり（app は tape の言う時間より短い時間で次のキーを受ける）、その後に読んだ出力の時刻は窓の終わりに丸まる。`wait` の timeout も同じだけ実時間で短くなる。`TestClock` の下の LiveDriver のテスト（A〜J）は仮想の時間なので、飛びを受けず、clamp の働きも確かめていない。普段のコードに基盤レベルは漏れていない
  - 現象: `SystemClock.now` は JS では `Date.now()` で、壁時計を読む（`[api.std.clock]`、`crates/emela-core/lib/std/clock.mjs:5`）。この機械（WSL2、bun 1.4.3）では、壁時計が約 32 秒おきに、単調な時計（`performance.now()`）に対して 1.7〜3.8 秒前へ飛ぶ。Emela を使わない bun の script で再現する（2026-11-26。`Date.now()` と `performance.now()` を busy loop で読み続け、続けて読んだ 2 回の間で、壁時計の進みが単調な時計の進みと 100 ms を超えて違った所を出す）:
    ```
    bun 1.4.3, 200 s, start 2026-11-25T16:12:12.267Z
    step 1: at 10.6 s (monotonic), wall +1663 ms, monotonic +0.0 ms, step +1663 ms
    step 2: at 42.8 s (monotonic), wall +2559 ms, monotonic +0.0 ms, step +2559 ms
    step 3: at 75.1 s (monotonic), wall +2439 ms, monotonic +0.0 ms, step +2439 ms
    step 4: at 107.6 s (monotonic), wall +2544 ms, monotonic +0.0 ms, step +2544 ms
    step 5: at 139.8 s (monotonic), wall +2578 ms, monotonic +0.0 ms, step +2578 ms
    step 6: at 172.1 s (monotonic), wall +2595 ms, monotonic +0.0 ms, step +2595 ms
    done: 1907876861 reads, 6 steps, wall 214376 ms vs monotonic 200001 ms (wall - monotonic = 14375 ms), largest monotonic gap 9.7 ms at 187.9 s
    ```
    飛びと飛びの間は 2 つの時計が同じ速さで進み、200 秒での差（14375 ms）は 6 回の飛びの和（14378 ms）に等しい。最終レビュー 2 の同じ形の probe（200 秒）では、飛びは 5 回（+3173、+3224、+3154、+3367、+3789 ms）で、29.2、61.4、93.6、125.9、173.5 秒に起きた
  - どちらの時計が実際の時間に近いか: Windows の host の時計（WSL の interop で `powershell.exe` から読む）と 20 秒おきに比べた。120 秒の間に host は 129.5 秒進み、壁時計は host から ±1.7 秒の内にとどまり、単調な時計は 9.5 秒（約 8%）遅れた。外の時計（`https://www.google.com/` の応答の `Date` header。1 秒刻み）とも比べ、単調な時計で 90.1 秒の間に、`Date` は 97 秒、壁時計は 97.6 秒進んだ。この guest では単調な時計がゆっくり進み、壁時計がときどき host の時刻に合わせて前へ動かされる（WSL2 が guest の時刻を host に合わせる仕組みによると推測する。仕組みは確かめていない）。短い区間を壁時計で測ると、その区間に飛びが入ったとき、それまでの約 32 秒にたまった差がまとめて足される。単調な時計の速さのずれは一定の倍率なので、テストの比では消える
  - `setTimeout` は単調な時計に従う: `setTimeout(500)` を 150 秒繰り返す bun の script で、壁時計が飛んだ 4 回の待ちは、単調な時計で 500.5〜500.9 ms、壁時計で 2940〜3096 ms だった。`SystemClock.sleep` は `setTimeout` で待つ（`[api.std.clock]`）ので、`sleep` と、それで待つ `Fiber.timeout`（`[api.std.fiber]`）は飛びを受けない。受けるのは `now` を読む所だけ
  - 前の版の読み違い: 前の版（`032-js-call-stall`）は、これを「Emela から出したコードの純粋な呼び出し 1 回が 2.8〜3.4 秒止まる」と読んだ。その観測は、どれも壁時計の飛びで説明がつく: 大きさ、頻度（約 35 秒に 1 回）、`replace` と `find_all` に同じように当たったこと、JSC の GC の log（`BUN_JSC_logGC=1`）に何も無かったこと、同じ trial の前後の呼び出しがふつうの速さだったこと。前の版が「機械全体が止まったのではない」の根拠にした `performance.now()` の監視（120 秒で最大 11.3 ms）は、単調な時計しか見ないので、壁時計の飛びは見えない（上の probe でも、飛んだ所の単調な時計の進みは 0.0 ms）。前の版の調べる順（まず `EMELA_JS_HOST=node` で走らせる）は、Node も同じ OS の壁時計を読むので切り分けにならず、Emela の runtime への誤った issue の下書きに進むところだった
  - 前の観測（2026-11-26、どれも throwaway で、もう消した）: 和の形のテストを 67 回走らせ、2 回失敗した（`replace` の 10 回の和が 3470 ms と 3099 ms。ふつうは約 260 ms）。1 回ごとに測る probe（1 プロセスで `replace` と `find_all` を 400 回ずつ）を 12 プロセス走らせ、7 回の飛びが `replace` に 3 回、`find_all` に 4 回入った（2832〜3159 ms）。中央値の形では 70 回とも通った（その間の 2 回の飛びは、どちらも warm-up に入った）
  - kbdcast への危うさ: サブプロジェクト 1 の recorder（LiveDriver）は、cast の時刻を tape の時間で持ち、`idle` の窓はどれも壁時計に依らず窓の長さだけ tape の時間を進めるので、飛びが cast に何も起きていない秒を足すことは無い。飛びを受けるのは `now` の差で測る所で、上のコストの recorder の行のとおり、前への飛び（この機械で約 32 秒おきに 1.7〜3.8 秒）が窓に入ると窓が実時間で短くなり、`wait` に入ると timeout が短くなる（既定 10 秒の timeout が、実際には 6〜8 秒で切れうる）。後ろへの飛び（NTP の step や手で時刻を変えたとき）は、`previous` で窓の中の時刻の順を保つ。読み込みを打ち切る `Fiber.timeout` そのものは飛びを受けない（上の `setTimeout` の probe）。実機の録画で飛びを捉えたことはまだ無い（[INFERENCE]: この段落の動きは、コードと上の probe から読んだもので、飛びの入った録画では確かめていない）
- spec: `[api.std.clock]`（`Clock` は `sleep` と `now` だけ。`SystemClock` の `now` は JS で `Date.now()`、native で `timespec_get`（`crates/emela-core/lib/std/clock.c:10` の `TIME_UTC`））、`[target.wasm.external]`（`spec/targets/wasm.md:39`。WASM の `now` は `wasi:clocks/system-clock`）、`[api.std.instant]`（「A point in time. An opaque type whose contents are an Int64 of milliseconds since the Unix epoch」。Rust の `std::time::Instant` と名前は同じでも、Emela の `Instant` は壁時計の時刻）、`[api.std.duration]`、`[api.std.fiber]`（`timeout` は Clock の `sleep` で待つ）。std に単調な時計を読む関数は無い。spec と std で単調な時計が出てくるのは、native の event loop の timer（`[target.native.event-loop]`、`spec/targets/native.md:68`）と、WASM の `sleep` が使う `wasi:clocks/monotonic-clock` の `wait-for`（`crates/emela-core/lib/std/clock.emel:31`）だけで、どちらも待つ側
- 既存: emela の issue と PR に無い（2026-11-26、`gh api search/issues` で `is:issue` と `is:pull-request` のそれぞれを「"monotonic"」「"performance.now"」「"wall clock"」「"elapsed"」「"Instant"」「"Date.now"」「"Clock"」で検索。当たったのは別の話題: "monotonic" は WASM の `sleep` を WASI 0.3 で動かす PR #406 と fiber の PR、"Instant" は `Instant.parse` などの issue と PR（#738、#870、#801 ほか）、"Date.now" は Clock を足した PR #161 と WASM の Clock の PR #294）。`spec/open-questions.md` にも無い（Instant の単位の #46 と、`from_unix_milliseconds` を公開する #47 は別の話）
- 行き先:
  前提の範囲内で spec に足りない → proposal の下書きの材料（emela の `emela-proposal` skill で詰める）。未提出。出すのは user
  下書き: `Std.Clock` has one reading of time, `now() -> Instant`, and `SystemClock.now` reads the wall clock (`Date.now()` on JS, `timespec_get(TIME_UTC)` on native, `wasi:clocks/system-clock` on WASM). So the usual way to measure elapsed time, `clock.now().since(start)`, includes every step of the wall clock. On WSL2 the guest's monotonic clock runs about 8% slow, and its wall clock is moved forward to the host's time by 1.7 to 3.8 s about every 32 s; the monotonic clock does not jump. A timing test in kbdcast's regex failed in about 3% of runs from this alone, and now compares medians instead of sums. A program that computes deadlines or timestamps from `now` gets the same jumps (kbdcast's recorder does: a forward step shortens its idle windows and its `wait` timeouts in real time, and it carries an extra parameter to keep the times of the output inside a window in order across a step back), and an NTP step or a manual change of the system time does the same on any machine. Other languages keep a separate monotonic reading for this: JS `performance.now()`, Rust `std::time::Instant` (as opposed to `SystemTime`), and the monotonic reading inside Go's `time.Time`. Proposal: an operation of Clock that reads a monotonic clock, for example `fn elapsed() -> Duration` (the time since an unspecified start: only differences mean anything, and it never goes back or jumps), backed by `performance.now()` on JS, the monotonic clock that the native event loop already reads (`[target.native.event-loop]`), and `wasi:clocks/monotonic-clock` on WASM, whose `wait-for` `sleep` already uses. `TestClock` answers it from its virtual time, so tests stay deterministic. Open points: the name (`Instant` already names a wall-clock point), and whether `Instant.since` should say in its description that it includes clock steps

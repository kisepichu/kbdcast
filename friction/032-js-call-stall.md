# 032 js-call-stall

- 状態: open
- Emela: v0.28.2
- 意図: regex の時間のテスト（`regex/test/linear_test.emel` の `replace_builds_its_result_in_time_proportional_to_the_matches`）で、`"a"` × 4000 に対する `replace` と `find_all` の時間を `Std.Clock.SystemClock` で測って比べる。`emela test` は JS に出したコードを Bun 1.4.3（`EMELA_JS_HOST=bun`）で走らせる
- こう書きたかった: 10 回の時間の和をそのまま比べる形（commit `17a6984` のテスト）。どの呼び出しもふつうは数十 ms で揃うので、和でも中央値でも結果は同じになるはずだった
  ```emela
  took = |f| {
    start = clock.now()
    _ = List.range(0, 10).map(|_| f(input))
    clock.now().since(start).to_milliseconds()
  }
  ```
- 診断: なし（実行時の現象）
- 回避策: 1 回ごとに時間を測り、10 回の中央値を比べる形にした（commit `5de6b6f`。中央値を読む所は 009）。止まった 1 回は並べた最後に来るので、中央値は動かない。テストはもうこの現象に左右されないので、コードに印は付けない
- コスト:
  - 現象: Emela から出したコードの純粋な呼び出し 1 回（`Lib.replace` か `Lib.find_all`。どちらも suspend する呼び出しを含まないので、`[target.js.event-loop]` の、host の event loop に制御を返す所は中に無い）が、ときどき 2.8〜3.4 秒止まる。ふつうの呼び出しは 6〜67 ms で、同じ trial の前後の呼び出しはふつうの速さ。走らせている時間の数十秒に 1 回起きる（最終修正の probe では約 35 秒に 1 回）
  - 観測（2026-11-26、WSL2、bun 1.4.3。どれも最終修正のときと、この修正のときの throwaway で、もう消した）:
    - 和の形のテストを 67 回走らせ、2 回失敗した（`replace` の 10 回の和が 3470 ms と 3099 ms。ふつうは約 260 ms）
    - 1 つのプロセスで `replace` と `find_all` を 400 回ずつ、1 回ごとに測る probe を 12 プロセス走らせ、7 プロセスで 1 回ずつ止まった: `replace` が 3 回（2832、2871、3159 ms）、`find_all` が 4 回（2833、2847、2982、2932 ms）。`replace` の手間ではない
    - 中央値の形のテストを、時間を出す `dbg` を足した throwaway の写しで 40 回、repo のそのままのテストで 30 回走らせ、70 回とも通った。写しの 40 回の中で 2 回止まった（`replace` の warm-up の 1 回が 3376 ms、`find_all` の warm-up の 1 回が 2995 ms。どちらも比べる値の外）
  - 除いたもの:
    - JSC が記録する GC の停止ではない: `BUN_JSC_logGC=1` の log で、止まった trial とその前の trial に 40 ms を超える記録は無い（3 プロセス）
    - 機械全体が止まったのではない: 別の bun のプロセスで `performance.now()` を回し続けたところ、120 秒の間の読みの間隔は最大 11.3 ms で、その間に probe の 3 回の停止が起きた
    - bun の割り当て一般ではない（推測）: `replace` 1 回とおよそ同じ割り当て（1 文字の String 4000 個、List の cell、つないだ String）を繰り返す素の bun の script は、120 秒で 352,875 歩、最も遅い 1 歩で 22 ms だった。ただし、これは probe と同時には走らせていない
  - 原因は分かっていない。Emela の runtime（`emela_runtime.mjs`）か、出したコードを JSC がどう扱うか（JIT の段の切り替えなど）か、WSL2 か、まだ切り分けていない
  - テストへの影響: 和の形では、`emela test` と、prek の `--test` を付けた commit の約 3% が失敗した。中央値の形にしてからは、止まった 1 回は結果に効かない
  - kbdcast の本体で、時間に頼る所（pty の出力を待つ時間の上限など）があれば、同じ停止が出うる（推測。確かめていない）
- spec: `[target.js.host]`（中断と再開などが Node 22.14 と Bun 1.4.3 で同じ結果になると確かめた、と書く。時間については何も言わない）、`[target.js.event-loop]`（yield は suspend する呼び出しの前だけ）、`[api.std.clock]`、`[dyn.memory]`
- 既存: emela の issue と PR に無い（2026-11-26、`gh api search/issues` で `is:issue` と `is:pull-request` のそれぞれを「"stall"」「"GC pause"」「"pause"」「"latency"」「"bun"」「"slow call"」で検索。当たったのは別の話題: issue #218 は JS と WASM の比較、境界、fiber の一致、PR は WASM の fiber、Bun の最小の版、Windows の path など。open の PR #611 は Bun を 1.4.5 に上げる）
- 行き先: 分類は原因を調べてから決める。調べる順: `EMELA_JS_HOST=node` で同じ probe を走らせる（Node でも止まれば Bun ではない）、Bun の新しい版（#611 の 1.4.5）で走らせる、WSL2 でない Linux で走らせる。Emela の runtime か出したコードが原因なら「spec と実装がずれている、またはバグ」→ issue の下書き。Bun か JSC が原因なら、Emela の外の話として記録だけ残す。WSL2 が原因なら dropped にする

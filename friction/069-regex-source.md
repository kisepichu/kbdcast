# 069 regex-source

- 状態: open
- Emela: v0.28.2
- 意図: recorder の `Driver`（`src/recorder.emel`、サブプロジェクト 1 の計画の Task 4）の `wait_for` が受けた `Regex` から、tape に書いた pattern の文字列を読む。test の handler `TestDriver` は呼ばれた `wait_for` を `WaitFor("ready", 10000)` と pattern の文字列で記録し、本番の `LiveDriver`（Task 5）と cli（Task 6）は、`RecordError` の `TimedOut` の pattern を利用者に見せる
- こう書きたかった:
  `Driver` の操作は design spec（§6）と計画の Interfaces のとおり `Regex` だけを受け、handler が `Regex` から元の文字列を読む（JS の `RegExp.prototype.source`、Rust の regex の `Regex::as_str`、Go の `Regexp.String`）
  ```emela
  suspend fn wait_for(pattern: Regex, timeout: Duration) -> () fails WaitTimeout | ProcessExited
  # TestDriver の中
  record(WaitFor(Regex.source(pattern), timeout.to_milliseconds()))
  ```
  wish（`wish/recorder.emel:14-17`）は、元の文字列が取れないことを controller が先に確かめていたので、初めから下の回避策の形で書き、この形はコメントに残した
- 診断: なし。kbdcast の regex の Pome の公開 API（`regex/src/lib.emel`、regex の design spec の §5）は `compile`、`is_match`、`find`、`find_all`、`replace`、`split` と `Match` の関数だけで、`Regex`（`pub opaque type Regex(program: Vm.Program, names: Map[String, Int])`）は元の pattern を持たない（controller と自分が読んで確かめた、2026-11-28）
- 回避策:
  `wait_for` に pattern の文字列の引数 `source` を足した: `suspend fn wait_for(pattern: Regex, source: String, timeout: Duration) -> () fails WaitTimeout | ProcessExited`（`src/recorder.emel`、`FRICTION(069)` の印）。`run_tape` は `Step.Wait(line, regex, source)` の 2 つをそのまま渡す。tape のパーサ（Task 1）は、同じ理由で `Wait` に `Regex` と元の文字列を並べて持たせている（design spec §4 の `Wait(Int, Regex, String)`）。`TestDriver`（`test/test_driver.emel`）は `source` を記録し、`Reason.TimedOut` の pattern も `source` から作る
- コスト:
  domain の port の操作の引数が 1 つ増え、どの handler も、同じ pattern を表す 2 つの値を受ける。2 つが食い違っても（違う文字列を渡しても）compiler も実行時も気づかない。`Step.Wait` も同じ 2 つを持ち回る。Task 5 の `LiveDriver` はこの形の `Driver` を実装する。普段のコードに基盤レベルは漏れていない（引数は effect の宣言の中）
- spec: regex の design spec（`docs/superpowers/specs/2026-11-25-kbdcast-R-regex-design.md` の §2 の「API: 一致と capture まで、最小限」と §5）、recorder の design spec の §4 と §6
- 既存: なし（kbdcast の regex の Pome の API の話で、Emela の言語の話ではない）
- 行き先: kbdcast の regex の Pome に足りない → kbdcast の側で、regex の公開 API に `pub fn source(re: Regex) -> String`（`compile` に渡した pattern をそのまま返す）を足す案。regex の spec の §5 を変えるので、manager が決める。足したら `wait_for` の `source` と `Step.Wait` の String を消せる。regex を x に入れるときも、JS の `source` に当たる関数として足す材料になる

# 088 float-to-int-checked

- 状態: open
- Emela: v0.28.2
- 意図: cast の reader（`src/cast.emel` の `read_events`、サブプロジェクト 4 の最終レビューの T1-2 の fix）で、録画の始まりからの時刻（interval の和で、Float の秒）をミリ秒の Int に丸める。Int に入らない時刻（2147483647 ms を超えるもの、`1e400` の Infinity）は、defect でなく、その行の CastError（`the time is too large (more than 2147483647 ms)`）にする
- こう書きたかった:
  wish は無い（既存の関数への fix）。Int に入らないときに Option を返す丸め（`Int.checked_add` と同じ形）があれば、境界を考えずに書ける。文の上限にも、数でなく Int の最大の定数を使いたい（`[lex.literal]` は「core provides a constant such as `Int.MIN`」と書く）
  ```emela
  at_ms = Float.checked_round(time * 1000.0) match {
    Some(ms) -> ms
    None     -> fail CastError(line:, message: "the time is too large (more than #{Int.MAX} ms)")
  }
  ```
- 診断:
  直す前の defect（v0.28.2、2026-11-28）: `[3000000, "o", "a"]` は `defect: cannot convert 3000000000.0 to Int`、`[1e400, "o", "a"]` は `defect: cannot convert Infinity to Int`（Std.Json は `1e400` を Number として読み、`to_float` が Infinity にする）。cli の `overlay` は exit 101
  repo の外の使い捨てのファイル（v0.28.2、2026-11-28、`emela check` の single-file mode）: `Float.checked_round(1.5)` に ``error[E0212]: module `Float` has no `checked_round` ``、`Int.MAX` に ``error[E0110]: expected lower name`` と E0122、``error[E0217]: expected constructor, found type `Int` ``。どれも help は付かない
- 回避策:
  `Float.round` に渡す前に、Float のミリ秒を手で書いた境界と比べる（`src/cast.emel` の `read_events`、`FRICTION(088)` の印）
  ```emela
  ms = time * 1000.0
  if ms >= 2147483647.5 {
    fail CastError(line:, message: "the time is too large (more than 2147483647 ms)")
  }
  at_ms = Float.round(ms)
  ```
  境界が 2147483647.5 なのは、時刻が負にならず（負の interval は先に弾く）、`Float.round` が 0.5 を 0 から遠い方へ丸めるため。丸めた値が 2147483647 を超える（Infinity なら defect になる）のは、ちょうど 2147483647.5 以上のとき。2147483647.5 は Float で正確に表せる。`> 2147483647.0` だと 2147483647.3 のように 2147483647 に丸まる時刻まで弾き、`> 2147483647.5` だと 2147483647.5 そのもの（interval `2147483.6475` の時刻）で defect になる
- コスト:
  比較 1 つと、境界の理由のコメント 4 行。境界は、Int の幅（32 bit）、`Float.round` の丸め方、時刻が負にならないことの 3 つに頼り、どれかが変わると黙ってずれる（NaN は比較が False になり、`Float.round` の defect まで通る。ここでは負の interval を先に弾くので NaN は来ない）。2147483647 は境界と文の 2 か所に手で書いた。普段のコードに基盤レベルは漏れていない
- spec:
  `[api.float]`（`floor`、`ceil`、`round`、`truncate` は、丸めた値が Int の範囲外のとき、NaN と ±Infinity のときに defect。「They neither wrap around nor saturate」。範囲を確かめる関数も `is_finite` も無い）、`[api.int]`（`checked_add` は Option を返すが、最大と最小の定数は無い）、`[lex.literal]`（`Int.MIN` のような定数を core が持つとする）、`[api.std.dynamic.number]`（`Number.to_int` は範囲外で `OutOfRange` に失敗するが、整数でない数も失敗にするので丸めには使えない）、`spec/targets/16-targets.md`（「To detect overflow, use functions such as `Int.checked_add`」）、`spec/history.md` の 16.1（Float から Int への変換の defect を決めた行）
- 既存:
  emela の issue #683（open）「仕様が core にあるとする Int.MIN（と Int.MAX）が無い」。`Int.MAX` があれば数を書かずに済むが、丸め方から境界を出す理屈は残る。#217（open）は、Float から Int への変換の defect の文面を JS と WASM で揃える話で、失敗を返す変換ではない。2026-11-28 に `gh search issues --repo emela-lang/emela --include-prs` で「Float.round」「Float to Int」「checked conversion」「round Option」「Int.MAX」「float int defect」「Float.truncate」を検索し、当たったのはこの 2 つと、#215（#217 の親）、#122（組み込み関数の表）、#400（WASM の Float の表示、parse、Int 変換のランタイム）。checkout の main（5ad03e79）の `proposals/` と `spec/open-questions.md` にも無く、その `[api.float]` と `crates/emela-core/lib/core/int.emel` も v0.28.2 と同じ（失敗を返す変換も、`MIN` と `MAX` も無い）
  kbdcast の中で Int の最大を手で書いた所は、ほかに `src/tape.emel` の `LONGEST_MS`（印なし）と `test/fake_pty.emel` の `FOREVER`（082）
- 行き先:
  前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。`Float.checked_round(x: Float) -> Option[Int]`（`floor`、`ceil`、`truncate` にも同じ形。名前は `Int.checked_add` に揃える）を core に足せば、入力から来る Float（JSON の数、秒をミリ秒にする所）が Int に入らないとき、defect でなく入力の誤りとして報告できる。`Int.MAX` は #683 に使い道として足せる（この所、tape の `LONGEST_MS`、fake_pty の `FOREVER`）。未提出。出すのは user
  #683 へのコメントの下書き: A use case for `Int.MAX`: a reader of asciicast files keeps the time of each event as a sum of Float seconds and turns it into Int milliseconds with `Float.round`, which is a defect outside Int (`[api.float]`). To report a too-large time as an error of the input, it compares with a bound written by hand, `2147483647.5`, derived from the width of Int and from `round` taking 0.5 away from 0, and writes `2147483647` again in the message. `Int.MAX` would remove the number; a conversion that returns `None` outside Int, like `Int.checked_add` (`Float.checked_round(x) -> Option[Int]`), would remove the bound altogether.

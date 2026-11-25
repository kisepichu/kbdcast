# 024 thread-dedup-set

- 状態: open
- Emela: v0.28.2
- 意図:
  regex の vm（`regex/src/vm.emel` の `step`、計画の Task 6）で、1 つの位置で既に通った状態（命令の位置と `left` の組。論文の Algorithm 1 の `processed`）を覚え、優先順位の低いスレッドが同じ状態に来たら捨てる。spec（`docs/superpowers/specs/2026-11-25-kbdcast-R-regex-design.md` §10）が「JS で `Array.set` が常にコピーする（スレッドの重複を除く集合）」として予想していた friction。状態の数は命令の数 m の 2 倍で、位置ごとに最大 2m 回、引いて足す
- こう書きたかった:
  `wish/vm.emel:94`、`:102`、`:105`。wish は spec を読む前に `Set[(Int, Bool)]` で書いた（`seen.contains((t.pc, t.left))`、`seen.insert(...)`）。考えていた本来の形は、論文や RE2、Rust regex と同じ、位置ごとに作り直す O(1) の印の配列
  ```emela
  seen = Array.repeat(False, prog.insts.size() * 2)  # 位置ごとに 1 つ
  [t, ..rest] if seen.get(key(t)) == Some(True) -> ...
  seen = seen.set(key(t), True)
  ```
- 診断: なし（どちらの形も型は通る。違うのは時間だけ）
- 回避策:
  `Std.Set[(Int, Bool)]`（重みで釣り合わせた木、1 回 O(log m)）にした（`regex/src/vm.emel` の `step` の引数 `seen`、`FRICTION(024)` の印）。位置ごとの手間は O(m log m)、照合全体は O(m log m · n)
  測った値（v0.28.2、JS、bun、`emela test --reporter pretty` の時間。`a{1000}` を `"a"` の 1000 個に当てる。位置 i で i + 1 個のスレッドが別々の状態にいて、処理するスレッドは全部で約 50 万）
  - `Set[(Int, Bool)]`（採った形）: 594 ms
  - `Set[Int]`（鍵を `pc * 2 + left` にした形）: 781 ms。組の比較は遅くない
  - `Array[Bool]` と `Array.set`（上の本来の形）: 4926 ms。JS は `set` のたびに 2m の配列を写すので、位置ごとに O(m²)
  - 重複を除かない形（この入力ではスレッドが同じ状態に来ないので結果は同じ。比較のためだけ）: 219 ms。採った形の時間の 3 分の 2 近くが `Set` に使われている
  `(a*)*b`、`(a|a)*b` を 2000 と 4000 の `a` に当てたときの比は、どの形でも 2 倍（`regex/test/linear_test.emel`）
- コスト: 照合が O(m·n) でなく O(m log m · n) になる。JS では本来の形の 8 分の 1 の時間で済むが、重複を除かない形の約 3 倍かかる（`a{1000}` で 0.6 秒）。WASM と native の本来の形（O(1) の `set`）より遅いと見積もる（測っていない）。行数のコストは無い。普段のコードに基盤レベルは漏れていない（`Std.State` は effect で、`uses` が普段のコードに出る。それに、State に入れた Array も JS では `set` で写る）
- spec:
  `[api.std.array]`（「The JS target always copies.」。WASM と native は、引数が後で使われない変数で、他から参照されていなければ O(1) でなければならない）、`[api.std.set]`（中身は `Map[A, ()]`）、`[api.std.map]`（重みで釣り合わせた木）、`[target.js]`、`spec/open-questions.md` の 21（Ref は無い。可変の状態は State）と 36（Map と Set は Emela で書いた木）
- 既存:
  `proposals/array.md:17`、`:102`、`:161`、`:195`、`:218`（JS は `set` で写すと決めた。`:225` は「どの target でも写す」案を「配列を更新するループが 1 歩 O(n) になる」として退けた。`:241` は参照が 1 つなら書き換える Lean 4、Koka、Roc を挙げる）。emela の issue と PR（2026-11-25、`gh api search/issues` で `is:issue` と `is:pull-request` のそれぞれを「Array.set」「in place」「mutable array」で検索）に、JS の `set` を扱ったものは無い（当たったのは WASM と native の参照の解析や性能の PR: #764、#761、#781、#771、#780）
- 行き先:
  既に知られている制限（`proposals/array.md` が JS は写すと決めた） → 実際の使い道を添えて issue にする材料。下書き（未提出。出すのは user）: `Array.set` always copies on the JS target (`[api.std.array]`). A Pike VM keeps, for each position of the input, a set of the states that a thread has visited (2 per instruction), and tests and adds to it once per thread: the usual flag array is O(1) per step on WASM and native, but O(m) on JS, so a position costs O(m²). kbdcast's regex (`regex/src/vm.emel`) uses `Std.Set` instead, which is O(log m) on every target: on JS, `a{1000}` against 1000 characters takes 594 ms with `Set`, 4926 ms with `Array.set`, and 219 ms with no set at all. The case of `set` on JS that the vm needs is the one WASM and native already make O(1): the argument is a local binding, rebound to the result, and never used again. Could the JS target update in place there too, or could std offer a set of small Ints (a bitset) with O(1) `contains` and `insert` on every target?

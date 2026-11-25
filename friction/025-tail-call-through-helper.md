# 025 tail-call-through-helper

- 状態: open
- Emela: v0.28.2
- 意図:
  regex の vm（`regex/src/vm.emel` の `step`、計画の Task 6）で、命令ごとの腕から「新しいスレッドの stack で続ける」を短く書く。`step` は 7 つの引数を持つ自分への末尾呼び出しで、1 つの位置で処理するスレッドの数（命令の数の 2 倍まで、100_000 命令なら 20 万）だけ続くので、stack を使わない保証が要る
- こう書きたかった:
  `wish/vm.emel:107` の `go` と、それを呼ぶ 8 つの腕の 10 か所（`:114`、`:116-122`）。変わる引数だけを渡す closure
  ```emela
  go = fn(stack) { step(prog, input, pos, stack, seen, next, best, steps) }
  ...
  Fork(first, second) => go([Thread(..t, pc: first), Thread(..t, pc: second), ..rest])
  Jump(to) => go([Thread(..t, pc: to), ..rest])
  ```
- 診断:
  なし。wish check（v0.28.2）は `let` の 004 と前置の match の E0142 で止まり、この腕には届かなかった。正しい構文で書いた closure の形（`go = |stack| step(prog, input, pos, stack, seen, next, steps)`）と局所関数の形（`fn go(stack: List[Thread]) -> Step { step(...) }`）は、どちらも `emela check` を診断なしで通る（相互の末尾呼び出しの警告も出ない）
- 回避策:
  腕ごとに `step(prog, input, pos, <新しい stack>, seen, next, steps)` を書いた（`regex/src/vm.emel` の `step`、wish で `go` だった 10 か所。`FRICTION(025)` の印）。wish でも `step` を直に呼んでいた 2 か所（同じ状態のスレッドを捨てる腕と、文字を消費した腕）と合わせて 12 か所
  確かめたこと（v0.28.2、JS、bun、2026-11-25。repo の中で `vm.emel` を一時的に書き換え、元に戻した）: closure の形も局所関数の形も、`(?:(?:a?){100}){400}b`（約 8 万命令。位置 0 で Fork の連なりを 4 万回ほど続ける）を `"aaa"` に当てて stack を溢れさせなかった。compiler が let で束ねた closure を直接の呼び出しにしているためと推測する（PR #763「perf(lir): call a known closure directly」、#754）。ただし spec はこれを保証しない。保証の無い形に 100_000 命令の深さを任せないため、保証のある形にした
- コスト: `go` の 1 行と 1 つの引数の呼び出し 10 回の代わりに、7 つの引数の呼び出しを 10 回書いた（`emela fmt` が 7 行に折った腕が 2 つ）。腕の違いは stack の引数だけなのに、並べると同じ引数の列が目立つ。性能のコストは無い。普段のコードに基盤レベルは漏れていない
- spec:
  `[fn.loop]`（「A tail call to the function itself is guaranteed not to consume stack. For a local fn, a call to its own name inside its body ... is a call to itself.」「The body of an anonymous function and the body of a local fn, as positions of the enclosing function (a call there to the enclosing function is not a call to the function itself)」「Tail calls between mutually recursive functions are not guaranteed. The compiler detects them and warns.」）、`[target.tail-call]`、`[fn.local]`、`proposals/local-fn.md:62`（「A call inside the body of an anonymous function is never a tail call to the function itself」）
- 既存:
  `proposals/local-fn.md:311` は局所関数どうしの相互再帰を退けた（「tail calls between mutually recursive functions are not guaranteed」）。emela の issue と PR（2026-11-25、`gh api search/issues` で `is:issue` と `is:pull-request` のそれぞれを「tail call closure」「local fn tail」で検索）に、この形を扱ったものは無い（当たったのは性能の PR #763、#754、#758 と、局所関数の proposal #502、実装 #574）。021（tail recursion modulo cons）とは別の論点: 021 は自分への呼び出しの結果に cons する形、これは自分を呼ぶだけの helper を末尾で呼ぶ形
- 行き先:
  前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。`[fn.loop]` の保証を、関数の中で宣言した局所関数（または let で束ね、外へ出ない closure）を末尾の位置で呼び、その本体が末尾の位置で外の関数を呼ぶ形にも広げる（呼ばれる側の本体を、呼んだ所に開いたものと同じに扱う）。v0.28.2 の JS では既にそう動いているので、保証にするのは実装を後追いする形になる。相互の末尾呼び出しの警告（`[fn.loop]` の「The compiler detects them and warns」）が局所関数や closure を通る形に出ないことも、併せて書く。未提出。出すのは user

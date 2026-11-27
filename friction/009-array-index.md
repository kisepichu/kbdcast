# 009 array-index

- 状態: open
- Emela: v0.28.2
- 意図: `Fold.canonicalize`（`regex/src/fold.emel`）で、`SOURCES` を 2 分探索して見つけた位置の `TARGETS` の値を読む。`TARGETS` は生成器（`tools/gen-case-folding.ts`）が同じ対の列から作るので `SOURCES` と同じ長さで、その位置は範囲外にならない
- こう書きたかった: `wish/fold.emel:14` の `TARGETS[i]`（同じ行の `=>` と、13 行目の前置の match は別の誤りで、診断のとおりに直した）
  ```emela
  match Array.binary_search(SOURCES, c) {
    Some(i) => TARGETS[i]
    None => c
  }
  ```
  regex の class（`wish/class.emel`、計画の Task 5）でも、`:70` の `hits[i]` と `TARGETS[i]`（`canonicalize` で、set に入る source の印と target を、target の順に並べた表の位置で読む）、`:105` の `spans[mid]`（`contains` の手書きの二分探索）に添字を書いた
  regex の vm（`wish/vm.emel`、計画の Task 6）でも、`:109` の `prog.insts[t.pc]`（スレッドの命令を読む）、`:111`、`:137`、`:138`、`:145` の `input[pos]`、`input[pos - 1]`、`input[i]`（入力の code point を読む）、`:164` の `prog.enclosing[g]` に添字を書いた
  regex の時間のテスト（`regex/test/linear_test.emel` の `replace_builds_its_result_in_time_proportional_to_the_matches` と、それが使う `took`、friction-review の後の修正）でも、10 回の時間を並べ替えた List の中央値を `(sorted[4] + sorted[5]) / 2` と読みたかった。テストの中の 1 行で新しい単位ではないので、wish は書いていない
  key codec の encode の wish（`wish/encode.emel:174`、`:177`、サブプロジェクト 2 の計画の Task 6）でも、F キーの列の終わりの文字と番号を、List の literal の位置で読んだ: `["P", "Q", "R", "S"][n - 1]`（F1〜F4 の SS3 の文字）と `[15, 17, 18, 19, 20, 21, 23, 24][n - 5]`（F5〜F12 の `CSI n~` の n）。`n` は `FKey` の番号で 1〜12 なので、範囲外にならない
  幅の wish（`wish/width.emel:12`、サブプロジェクト 3 の計画の Task 2）でも、`partition_point` で数えた範囲の数 `n` の 1 つ前の範囲の終わりを、生成した List の表の位置で `WIDE_LAST[n - 1]` と読んだ。`n > 0` のときだけ読むので、範囲外にならない
  VT の画面の wish（`wish/screen.emel`、サブプロジェクト 3 の計画の Task 4）でも、行の Array とセルの Array を添字で読んだ: `:77` と `:81` の `s.grid[row]`（画面の行）、`:88` の `l[col + 1]`、`:90`、`:126`、`:143` の `line[col]`、`:113` の `line[from]`、`:132`、`:145` の `l2[col]`（書き込みや消去の位置のセルの占め方）。行は `rows` 未満、列は `cols` 未満と呼ぶ側が保証する（avt も添字で読み、範囲外は panic）ので、範囲外にならない
  VT の解釈の wish（`wish/terminal.emel:242`、サブプロジェクト 3 の計画の Task 5）でも、DEC の罫線の表（avt の `SPECIAL_GFX_CHARS` の 31 文字の String）を、0x60 から 0x7E の文字の位置で `DRAWING[c - 0x60]` と読んだ。直前の `0x60 <= c && c <= 0x7E` で範囲を確かめているので、範囲外にならない
- 診断:
  wish check（emela 0.28.2）の 14 行目の診断は `=>` のもの（``error[E0110]: expected `->` `` ほか 2 つ）だけで、`TARGETS[i]` には何も出なかった。`[grammar.expr]` の `postfix` に添字の形は無く、位置で読むのは `Array.get(a, index) -> Option[A]` だけ
  class の wish check（v0.28.2）では、`:75` の `sort_by(fn(i) { TARGETS[i] })` に E0148 と ``error[E0301]: type mismatch: expected `fn(Int, Int) -> Ordering`, found `fn(?5) -> List[Int]` `` が出た（本体の値が `[i]` の List と読まれている）。添字が無いとは言わない。`:70` と `:105` には届かなかった（`let` の 004 と、`=` で書いた関数の本体の 020）
  vm の wish check（v0.28.2）では、どの添字にも診断が届かなかった（`let` の 004、`=>` の E0110、`or` の 016 の後ろにあった）
  テストの中央値は wish を書かずに std の `List.get` で書いたので、診断は無い
  encode の wish check（v0.28.2）: `:177` の `[15, ...][n - 5]` に ``error[E0110]: expected `)` `` と E0122、続けて List を引数と読んだ ``error[E0301]: type mismatch: expected `Int`, found `List[Int]` `` と ``error[E0305]: wrong number of arguments: `tilde` takes 2, found 1``。添字が無いとは言わない。`:174` は範囲パターン（038）で崩れた腕の中にあり、届かなかった
  幅の wish check（v0.28.2、サブプロジェクト 3 の Task 2）: `:12` の `[` に ``error[E0122]: expected newline or `}` after statement`` の 1 つ。添字が無いとは言わない
  VT の画面の wish check（v0.28.2、サブプロジェクト 3 の Task 4）: 届いたのは `:132` の `if l2[col].occupancy == WideTail {` だけで、`[` に ``error[E0110]: expected `{` `` と E0122、`[col].occupancy` を List の literal の欄と読んだ ``error[E0313]: type `List[Int]` has no field or function `occupancy` `` と ``error[E0301]: type mismatch: expected `()`, found `Bool` ``。添字が無いとは言わない。残りの 8 か所は、`let`（004）の行か `=` で書いた関数の本体（020）の中にあり、届かなかった
  VT の解釈の wish check（v0.28.2、サブプロジェクト 3 の Task 5）: `:242` の `DRAWING[c - 0x60]` は `=` で書いた関数の本体（020）の中にあり、届かなかった
- 回避策:
  `TARGET_ARRAY.get(i) match { Some(folded) -> folded; None -> panic(...) }`（`regex/src/fold.emel`、`FRICTION(009)` の印）。`None` は表が壊れたときだけ起きるので、`Option.or(c)` で探索の失敗と混ぜずに defect にした
  class（`regex/src/class.emel`）:
  - `canonicalize`: `hit.get(index) match { Some(in_set) -> in_set; None -> panic(...) }`（`FRICTION(009)` の印）。`hit` は source ごとの印を `Array.from_list` にしたもので、`index` はその source の位置なので `None` は起きない
  - `contains`: wish の手書きの二分探索をやめ、範囲を始まりと終わりの 2 つの Array（`starts`、`ends`）で持ち、`ends.lower_bound(c)` の位置の `starts.get(i)` を見る形にした。ここの `None` は「`c` 以降で終わる範囲が無い」という本当の結果なので、起きない分岐は残らず、009 の印は付けない。ただし、表し方を wish の 1 本の `Array[Span]` から 2 本の Array に変えたのは、std の `lower_bound` と `binary_search` が要素と同じ型の値しか受けず、`Span` の `to` を key にして引けないからで、その回り道は 031 に書いた（`class.emel` の `CharSet` の宣言に `FRICTION(031)` の印）
  vm（`regex/src/vm.emel`）:
  - `instruction`: `prog.insts.get(pc) match { Some(inst) -> inst; None -> panic(...) }`（`FRICTION(009)` の印）。`Program` の最後の命令は Accept で、どの jump も中に収まるので `None` は起きない。vm はスレッドを 1 つ処理するたびにこれを呼ぶ
  - 入力の code point: `input.get(pos)` と `input.get(pos - 1)` の `None` は「入力の前か後ろ」という本当の結果（`^ $ \b \B` の判定と、最後の位置で何も消費しないこと）なので、起きない分岐は残らない。印は付けない
  - `prog.enclosing[g]`: 設計を変え（量指定子に番号を振らず、消す group の範囲で名指す）、その表が無くなった
  テスト（`regex/test/linear_test.emel`）:
  - 中央値: `(Assert.some(sorted.get(4)) + Assert.some(sorted.get(5))) / 2`（`FRICTION(009)` の印）。`sorted` は 10 回の時間を `List.sort` したもので、4 と 5 は範囲内なので `None` は起きない。brix の `Assert.some` が `None` で panic する match を持つので、起きない分岐は自分では書いていない。読むのは Array ではなく List なので `Array.at` の提案の直接の例にはならないが、範囲内と分かっている位置を読むのに Option が返る形は同じ
  encode（`src/key/encode.emel` の `function`、`FRICTION(009)` の印）: List を位置で読まず、F キーの番号ごとの match の腕にした（F1〜F4 の 4 つの腕が `f1_to_f4("P", m)` などを呼び、F5 と F11 は番号の腕、F6〜F10 は guard の腕（038）、F12 は `_` の腕）。`List.get` と起きない `None` の panic（040）を書くより、腕の方が短い。decode の `tilde` と `letter`（015、038）が逆向きの対応を同じ形で書いている
  幅（`src/vt/width.emel` の `is_wide`、サブプロジェクト 3 の Task 2）: class の `contains` と同じ形にした。範囲の終わりの Array を `lower_bound(c)` で引き、その位置の始まりを `get` で読む。ここの `None` は「`c` 以降で終わる範囲が無い」という本当の結果なので、起きない分岐は残らない。印は付けない。始まりでなく終わりの表を引く形に変えたのは、std の二分探索が述語を受けないからで、それは 031 に書いた
  VT の画面（`src/vt/screen.emel` の `at`、サブプロジェクト 3 の Task 4、`FRICTION(009)` と `FRICTION(040)` の印）: 読む所が 9 か所あるので、その場の match を 9 つ書かず、範囲外を defect にする private な `at[A](a: Array[A], index: Int) -> A`（`get` の `None` で panic）を 1 つ置いた。上の下書きの `Array.at` そのもの。`print`（画面の行、書く位置のセル、右隣のセル）、`shift_right`、`delete`（2 つずつ）、`clear`、`with_line` から呼ぶ。`clear` の右端の隣のセルの `get(to)` の `None` は「行の終わり」という本当の結果（avt も `get_mut(end_col)`）なので、`at` でなく `get` の match のままにした
  VT の解釈（`src/vt/terminal.emel` の `at` と `translate`、サブプロジェクト 3 の Task 5、`FRICTION(009)` と `FRICTION(040)` の印）: 表を String から `Array[Int]` の const（`Array.from_list("♦▒␉...".code_points())`）にし、画面と同じ形の private な `at` を置いて `at(DRAWING, c - 0x60)` と読んだ。String には位置で読む関数が無い（002）ので、表は Array にした。画面の `at` は private で呼べないので、同じ 6 行の関数を 2 つ目として書いた
- コスト:
  起きない分岐 1 つ（3 行）。普段のコードに基盤レベルは漏れていない。std も同じ形を書いている: `Std.Array` の `bisect` と `binary_search`（`crates/emela-core/lib/std/array.emel:154-174`）は、範囲内と分かっている `get(a, mid)` の `None` を `_` の腕に混ぜる。`proposals/array.md:76` の例は `Array.get(counts, b) |> Option.or(0)` で既定値にする
  class でも vm でも、起きない分岐 1 つ（印のコメントを含めて 3 行）
  テストでは、`Assert.some(...)` で包むだけで式の行は増えない（印のコメント 1 行と、`Assert` のための `import Brix.Assert` 1 行）
  encode では、2 つの List の literal と 2 つの添字の代わりに、8 つの腕と 3 行の `f1_to_f4`
  VT の画面では、補助関数 1 つ（印のコメントを含めて 10 行）と、呼ぶ所ごとの `at(a, i)`。添字の `a[i]` より長いが、行は増えない。VT の画面の行とセルは、avt が 1 文字ごとに添字で読む所なので、`Array.at` の下書きに足せる 4 つ目の使い道（行を書き換えるたびに、画面の行と位置のセルを読む）
  VT の解釈では、画面と同じ補助関数をもう 1 つ（印のコメントを含めて 9 行）。DEC の罫線の文字を書くたびに読む所で、`Array.at` の下書きに足せる 5 つ目の使い道。画面の `at` と中身が同じなので、std に `Array.at` があれば 2 つとも消える
- spec:
  `[api.std.array]`（`get` は範囲外で `None`、`set` は範囲外で defect）、`[api.list]`（テストの List の所。`List.get` も範囲外と負の位置で `None`）、`[lib.api-rules]`（「Not found, or out of range: return an Option」と「A precondition of the caller is broken: it is a defect」）、`proposals/array.md:100`（読み出しの範囲外は not found、書き込みの範囲外は defect）と `:226`（`set` を Option にしなかった理由）、`[grammar.expr]`
- 既存:
  emela の issue に無い（「Array get index」「unchecked」で検索、2026-11-25。#855 は compiler が範囲を誤って証明する bug で、API の話ではない）。`proposals/` と `spec/open-questions.md` にも無い。003（scalar value と分かっている code point の String）と同じく、呼ぶ側が前提を知っているのに Option が返る形
- 行き先: 前提の範囲内で spec に足りない → proposal の下書きの材料。`set` と同じく範囲外を defect にする読み出し（仮に `Array.at(a, index) -> A`）があれば、wish の形に近く書ける。regex の class（Task 5）で 2 か所目、vm（Task 6）で 3 か所目（命令の Array を位置で読む所）が出たので、下書きにする。未提出。出すのは user
  下書き: `Array.get` returns an Option (`[api.std.array]`), which is right when the position may be out of range. When the caller already knows it is in range, the `None` arm can only be a broken invariant, and every such caller writes `get(a, i) match { Some(x) -> x; None -> panic(...) }`. kbdcast's regex has three: reading a case folding table at a position found by `binary_search` in a parallel table of the same length (`regex/src/fold.emel`), reading per-entry flags built from the same table (`regex/src/class.emel`), and the Pike VM reading its instruction at the program counter, whose jumps the compiler keeps inside the program (`regex/src/vm.emel`, once per thread step). std does the same in `Std.Array.bisect`. Proposal: add `at[A](a: Array[A], index: Int) -> A` with the same contract as `set`: an index out of range or negative is a defect (``Array.at was given position <index> in an array of size <size>``). `proposals/array.md:100` already makes an out-of-range write a defect; this is the read with the same rule, for callers that hold the invariant

# 057 array-range-update

- 状態: open
- Emela: v0.28.2
- 意図: VT の画面（`src/vt/screen.emel`、サブプロジェクト 3 の計画の Task 4）で、avt 0.18.0 の `Line` と `Buffer` の操作を写す。avt は、行のセルの範囲を 1 つの値で埋め（`self.cells[range].fill(Cell::blank(*pen))`。`Line::clear` と `Line::delete`）、列から先のセルを回し（`self.cells[col..].rotate_right(n)` と `rotate_left(n)`。`Line::shift_right` と `Line::delete`）、画面の行の範囲も回す（`self[range].rotate_left(n)` と `rotate_right(n)`。`Buffer::scroll_up` と `Buffer::scroll_down`）。どれも Rust の slice の、範囲に対する 1 つの操作
- こう書きたかった:
  `wish/screen.emel:114`、`:131`、`:144`、`:146`、`:151`。範囲を埋める `fill_range` と、範囲を回す `rotate_right`、`rotate_left`（範囲を切り出す `l1[col..]` と、つなぐ `++` は 016）
  ```emela
  let l2 = l1.fill_range(from, to, space(pen))
  let l2 = l1[..col] ++ l1[col..].rotate_right(n)
  let l2 = l1[..col] ++ l1[col..].rotate_left(n)
  l3.fill_range(s.cols - n, s.cols, space(pen))
  { s with grid: s.grid.fill_range(from, to, blank_line(s.cols, pen)) }
  ```
  スクロール（`:170`、`:177`）は、回してから埋める形でなく、切り出した部分と新しい行を `++` で直に並べた（`g[..top] ++ g[top + n..bottom] ++ Array.fill(n, ...) ++ g[bottom..]`）
- 診断:
  wish check（v0.28.2）では、5 か所とも `let`（004）の行か、`=` で書いた関数の本体（020）の中にあり、届かなかった
  repo の外の使い捨ての Pome での最小の形（`a: Array[Int]`、2026-11-27）: `a.rotate_left(1)` に ``error[E0313]: type `Array[Int]` has no field or function `rotate_left` ``、`a.fill_range(0, 1, 9)` に同じ形の `fill_range` のもの、`Array.fill(3, 0)` に ``error[E0212]: module `Std.Array` has no `fill` ``。どれも help は付かない（`Array.fill(n, v)` の代わりの `Array.repeat(v, n)` は 016）
- 回避策:
  private な `fill`、`rotate_left`、`rotate_right` を書いた。どれも範囲（`from` 以上 `to` 未満）を受け、`Array.slice` で切った部分を `Array.concat` でつなぐ（`src/vt/screen.emel`、3 つの前のコメントに `FRICTION(057)` の印）。`fill` は `clear`（行の範囲）、`delete`（行の末尾）、`clear_rows`、`scroll_up`、`scroll_down`（画面の行の範囲）から、`rotate_right` は `shift_right` と `scroll_down` から、`rotate_left` は `delete` と `scroll_up` から呼ぶ。スクロールも、wish の直に並べる形でなく、avt と同じ「回してから埋める」形にして、同じ補助関数を使った
- コスト:
  補助関数 3 つ（本体は 1〜3 行ずつ）。普段のコードに基盤レベルは漏れていない
  速さはたぶん変わらない。std の Array は不変なので、std に範囲の操作があっても新しい配列を作る。JS では `Array.set` も常に写す（024）ので、範囲を 1 回書き換えるたびに行（または画面の行の Array）を 1 回写すのは、どちらの形でも同じ。ただし WASM と native では、`set` と同じく「引数が他から参照されていなければその場で書き換える」範囲の操作があれば範囲の長さの手間で済むのに対し、slice と concat は配列全体を作り直す（測っていない）
- spec: `[api.std.array]`（範囲を扱うのは `slice`、`concat`、`repeat` だけ。`set` は 1 つの位置で、O(1) の書き換えの約束も `set` だけ）、`proposals/array.md:251`（「Std.Array has only the functions where the position matters」）
- 既存: emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「rotate」「fill」を検索。当たったのは Map の木の回転を書き直す #369、#371 と、別の話題の proposal の #515、#412）。`proposals/array.md` にも範囲の操作は無く、採らなかった案にも挙がっていない
- 行き先: 前提の範囲内で spec に足りない → 今は出さない（補助関数 3 つで済み、JS では速さも変わらない見込み）。サブプロジェクト 3 の Task 6 の計測（80 列 × 24 行に 1 MB）で、範囲の書き換えが時間の多くを占めると分かったら、WASM と native での手間（範囲の長さか、配列全体か）を添えて見直す

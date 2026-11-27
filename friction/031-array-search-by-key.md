# 031 array-search-by-key

- 状態: open
- Emela: v0.28.2
- 意図: regex の class（`regex/src/class.emel`、計画の Task 5）で、code point の集合を、重ならず接しない範囲（`Span(from, to)`）の小さい順の 1 本の Array で持ち、`contains` で `c` を含みうる範囲を二分探索で引く。引く key は範囲の終わり `to` で、`c` 以上で終わる最初の範囲が `c` 以下から始まっていれば、`c` はその集合に入る
  幅（`src/vt/width.emel` の `is_wide`、サブプロジェクト 3 の計画の Task 2）でも、avt が 2 列で描く code point の範囲の表（生成した `Vt.WidthTable` の `WIDE_FIRST` と `WIDE_LAST`。範囲の始まりと終わりの 2 本の小さい順の `List[Int]`）を二分探索で引く。`c` 以下から始まる範囲の数を数え、その最後の範囲が `c` 以上で終わっていれば、`c` は幅 2
- こう書きたかった:
  `wish/class.emel:15` の `CharSet(spans: Array[Span])` のまま、std の二分探索に key か述語を渡して位置を出し、その位置の `Span` を読む（Rust の `slice::partition_point` と `binary_search_by_key`、Go の `sort.Search`、C++ の `std::lower_bound` に比較を渡す形）
  ```emela
  pub opaque type CharSet(spans: Array[Span]) derive Eq, Show

  pub fn contains(set: CharSet, c: Int) -> Bool {
    set.spans.get(set.spans.partition_point(|s| s.to < c)) match {
      Some(span) -> span.from <= c
      None       -> False
    }
  }
  ```
  wish（`wish/class.emel:33`、`:100-107`）は、std を読む前に書いたので、`Array[Span]` の上の二分探索を `search` として手で書いていた。表し方は 1 本の `Array[Span]` だった
  `regex/src/fold.emel:8-9` の `SOURCE_ARRAY` と `TARGET_ARRAY` も、key で引ければ `(source, target)` の組の 1 本の表にできる。ただし、こちらは生成器（`tools/gen-case-folding.ts`）が 2 本の List を出し、wish（`wish/fold.emel`）も 2 本だったので、wish から表し方を変えたわけではない。印は付けない
  幅の wish（`wish/width.emel:11-12`）は、始まりの表に述語を渡して数え、その 1 つ前の範囲の終わりを読んだ（`let` は 004、添字は 009）
  ```emela
  let n = WIDE_FIRST.partition_point(fn(first) { first <= c })
  n > 0 && c <= WIDE_LAST[n - 1]
  ```
- 診断:
  class: なし（wish は手書きの二分探索で、std の二分探索を呼んでいない。実装で std を読み、key や述語を受ける形が無いと分かった）
  幅の wish check（v0.28.2）: `:11` の行は `let`（004）の E0118 と E0122 で崩れ、`partition_point` には届かなかった。repo の外の使い捨ての Pome での最小の形（2026-11-27）: `Array.from_list([1, 5, 9]).partition_point(|first| first <= c)` に ``error[E0313]: type `Array[?1]` has no field or function `partition_point` ``、List の literal の上の同じ呼び出しに ``error[E0313]: type `List[?1]` has no field or function `partition_point` ``。help は付かず、`lower_bound` を示さない
- 回避策:
  `CharSet` を、範囲の始まりと終わりの 2 本の Array（`CharSet(starts: Array[Int], ends: Array[Int])`、`regex/src/class.emel:26`、`FRICTION(031)` の印は直前のコメントの行）にした。`ends` は小さい順の `Array[Int]` なので、std の `lower_bound` でそのまま引ける
  - `contains`（`:52-58`）は `set.starts.get(set.ends.lower_bound(c))` で、`ends` を引いた位置の `starts` を読む
  - 範囲の List から集合を作る `of_sorted`（`:144-150`）は、List を 2 回 map して 2 本の Array を作る
  - `spans`（`:152-154`）は `List.zip(set.starts.to_list(), set.ends.to_list()).map(...)` で `Span` の List に戻す。`union`（`:43`）、`complement`（`:48`）、`canonicalize`（`:125`）は、そのたびに `spans()` を呼ぶ
  幅（`src/vt/width.emel` の `is_wide`、`FRICTION(031)` の印は式の直前のコメントの行）: 表は計画どおり 2 本の List（生成器 `tools/gen-vt-golden.ts` が出す）で、それを `Array.from_list` にした 2 本の Array を持つ。表し方は wish と同じで、引く表と向きだけを変えた。終わりの Array を `lower_bound(c)` で引き（`c` より前で終わらない最初の範囲）、その位置の始まりを `get` で読んで `c` 以下かを見る。class の `contains` と同じ形
- コスト:
  - 性能: 集合 1 つに Array が 2 本要る。`spans()` は List を 4 本作る（`to_list` の 2 本、`zip` の組の List、`map` の `Span` の List）。1 本の `Array[Span]` なら `to_list` の 1 本で済む。`of_sorted` は List を 2 回なめる。どれも範囲の数に比例し、集合を作る時（`Program` が class を組み立てる時と、`ASCII_WORD` などの const の初期化）だけにかかる。照合の 1 歩で呼ぶ `contains`（vm の `\b` の判定の `Class.word(...)` も const を返す）は、どちらの形でも O(log 範囲の数)
  - 行数: `spans` の 3 行と、`of_sorted` の 2 本目の map の 1 行
  - 基盤レベルは漏れていない。2 本の Array（structure of arrays）はそれ自体まともな設計で、wish の形との違いは小さい
  - 幅: 行も性能も変わらない（どちらの向きでも O(log 範囲の数)、Array は 2 本）。違いは読み方だけで、wish の「`c` 以下から始まる最後の範囲」を、「`c` より前で終わらない最初の範囲」と裏返して読む
- spec:
  `[api.std.array]`（`lower_bound[A: Ord](a: Array[A], value: A) -> Int` と `binary_search[A: Ord](a: Array[A], value: A) -> Option[Int]` は、要素と同じ型の値しか受けない。v0.28.2 の `crates/emela-core/lib/std/array.emel:146-174`）。`proposals/array.md:235`（`binary_search` だけでなく `lower_bound` も入れた理由: 「without it, callers would write the bisection again」）と `:245`（prior art に Rust の `partition_point` を挙げるが、採った形は値を受ける）。`[api.std.array]` の `sort_by(a, f: fn(A, A) -> Ordering)` は、比較の関数を受ける `_by` の形が std にあることを示す
- 既存:
  emela の issue と PR に無い（2026-11-26、`gh api search/issues` で `is:issue` と `is:pull-request` のそれぞれを「"partition_point"」「"lower_bound"」「"binary_search_by"」「"binary search"」「"bisect"」で検索。当たったのは Array の proposal の PR #508 と、その実装の PR #513 だけ）。`spec/open-questions.md` にも無い（v0.28.2）
- 行き先:
  前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。`[api.std.array]` に、述語か比較の関数で引く二分探索を足す案。たとえば `partition_point[A](a: Array[A], f: fn(A) -> Bool) -> Int`（`f` が True の間を飛ばした最初の位置。Rust）か、`sort_by` に揃えた `lower_bound_by[A](a: Array[A], f: fn(A) -> Ordering) -> Int`。`proposals/array.md:235` が `lower_bound` を入れた理由（呼ぶ側が bisection を書き直さないため）は、要素が record で key がその 1 つの欄のときにもそのまま当てはまる。kbdcast の regex での使い道は `contains` の 1 か所で、コストは小さい（範囲の数に比例し、照合の 1 歩には効かない）ので、2 か所目の使い道が出るまで下書きにしない。出さないと決めてもよい
  幅の `is_wide` は、範囲の終わりの表が値で引ける形なので、`lower_bound` に書き換えられた。述語を渡したかった所としては 2 か所目だが、要素の欄を key にして引く使い道（class の `Array[Span]`）の 2 か所目ではない

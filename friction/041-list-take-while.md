# 041 list-take-while

- 状態: open
- Emela: v0.28.2
- 意図: key codec の表記（`src/key/notation.emel` の `angle`、サブプロジェクト 2 の計画の Task 3）で、`<` の後ろの code point の List から、ASCII の英数字が続く所（名前）と、英数字と `-` が続く所（error に出す `<...>` の中身）を切り出し、その後ろが `>` かを見る
- こう書きたかった:
  `wish/notation.emel:47`、`:59`。Rust の `Iterator::take_while`、Haskell の `takeWhile`
  ```emela
  let name = rest.take_while(is_name_char)
  match rest.drop(name.length()) { ... }
  ```
- 診断:
  wish check（v0.28.2）では、2 か所とも `let`（004）と前置の match（E0142）の行にあり、届かなかった
  repo の外の使い捨ての Pome での最小の形（`xs.take_while(|c| c >= 0x30 && c <= 0x39)`、2026-11-27）で ``error[E0313]: type `List[Int]` has no field or function `take_while` ``。help は付かない
- 回避策:
  private な `span(cs, f)` を書いた。`cs.find_index(|c| !f(c)).or(cs.length())` の位置で `take` と `drop` に分ける（`src/key/notation.emel` の `span`、`FRICTION(041)` の印）
  std も同じものを private に書いている: v0.28.2 の `std/json.emel:244` の `span` と `std/dynamic/number.emel:150` の `span_digits`（どちらも自分への呼び出しの結果に cons する形）
- コスト: 補助関数 1 つ（4 行）。List を `find_index`、`take`、`drop` で 3 回なめる（切り出す長さの分だけ）。std の 2 つは自分への呼び出しの結果に cons するので、長さの分だけ stack を使う（021）。普段のコードに基盤レベルは漏れていない
- spec: `[api.list]`（`take`、`drop`、`find_index`、`partition` はあるが、条件が続く間の先頭を取る関数は無い）
- 既存: emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「take_while」「takeWhile」「span List」を検索。当たりなし）。checkout の main（596b6038）の core にも無い。他の言語: Rust の `take_while` と `skip_while`、Haskell の `takeWhile`、`dropWhile`、`span`、Gleam の `list.take_while` と `list.split_while`
- 行き先: 前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。std の 2 か所と kbdcast の 1 か所が同じ関数を private に書いている。`List.take_while`、`List.drop_while` と、両方を 1 回で返す `List.span`（Gleam の `split_while`）。未提出。出すのは user

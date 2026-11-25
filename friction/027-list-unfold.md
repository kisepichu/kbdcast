# 027 list-unfold

- 状態: open
- Emela: v0.28.2
- 意図: regex の公開 API の `find_all`（`regex/src/lib.emel`、計画の Task 7）で、JavaScript の `matchAll` と同じく、位置 0 から「その位置以降の最初の一致を探し、次に探す位置を決める」を、一致が無くなるか位置が入力の終わりを越えるまで繰り返し、一致の List を作る。次の位置は一致の終わりで、空の一致なら 1 code point 先
- こう書きたかった:
  `wish/find_all.emel:81-95`。状態（次に探す位置）から「要素と次の状態」か「終わり」を返す関数で List を作る（Haskell の `Data.List.unfoldr`、Scala、F#、Elixir の `unfold`、Rust の `iter::from_fn` のつもり）
  ```emela
  List.unfold(0, |from| {
    if from > input.length() {
      None
    } else {
      Vm.search(re.program, input, from).found.map(|found| {
        next = if found.end == found.start { found.end + 1 } else { found.end }
        (Match(input: s, found:, names: re.names), next)
      })
    }
  })
  ```
- 診断:
  wish check（v0.28.2）: ``error[E0212]: module `List` has no `unfold` `` に ``= help: did you mean `fold`?`` が付く。`fold` は List を畳む関数で、List を作る `unfold` とは向きが逆なので、この help に従っても書けない（同じ closure の中の Array の `.length()` は 016）
- 回避策:
  private の再帰の関数 `matches_from(re, input, from, done)` を足し、closure の本体をその本体にした（`regex/src/lib.emel`。印は関数の直前のコメントの行）。closure が捕まえていた `re` と `input` を引数で渡す（Task 7 では `s` も渡していた。最終レビューのあとで `Match` が String でなく code point の Array を持つようにしたので要らなくなった。002）。自分への末尾呼び出しにするため、作りかけの結果を逆順で `done` に持ち、終わりの 2 か所で `reverse()` する（021）
  ```emela
  fn matches_from(re: Regex, input: Array[Int], from: Int, done: List[Match]) -> List[Match] {
    if from > input.size() {
      done.reverse()
    } else {
      Vm.search(re.program, input, from).found match {
        None        -> done.reverse()
        Some(found) -> {
          next = if found.end == found.start { found.end + 1 } else { found.end }
          matches_from(re, input, next, [Match(input:, found:, names: re.names), ..done])
        }
      }
    }
  }
  ```
  `replace` も、同じ code point の Array を使い回すため、`find_all` でなく `matches_from` を呼ぶ
- コスト:
  - 行数: wish の 12 行（`find_all` の本体）が、`find_all` の 1 行と、関数 1 つの 13 行とその説明のコメント 2 行になった（Task 7 では引数が 5 つで、fmt が 1 行に 1 つずつ折って 19 行だった）。終わりの 2 つの腕は同じ `done.reverse()`
  - 性能: 一致の List をもう 1 回 `reverse` で作る。どちらも一致の数に比例するのは変わらない
  - 基盤レベルは漏れていない
- spec:
  `[api.list]`（List を作る関数は `range` だけで、状態から作る関数は無い。std の `range` も private の `range_onto` に accumulator を渡して書く）、`[fn.loop]`（「Repetition is written with recursion or with functions such as `List.map` and `List.fold`」。保証は自分への末尾呼び出しだけ）、`[intro.premises]`（ループ構文は無い）、`[lib.api-rules]`（関数の引数は `f`、初期値は `from`）、`spec/diagnostics.md` の E0212
- 既存:
  emela の issue と PR に無い（2026-11-25、`gh api search/issues` で `is:issue` と `is:pull-request` のそれぞれを「unfold」「iterate」「generator」「anamorphism」で検索。当たったのは別の話題: issue #855 は入れ子ループの bounds の証明、PR は最適化のループ、proposal の Bytes、リリースの準備など）。v0.28.2 の emela の `crates/emela-core/lib`、`spec`、`proposals` に `unfold` は無い（`git grep`）。021 の「既存」に書いた `proposals/local-fn.md:327` の、accumulator で回す再帰を公開の fn と private の helper の組で書く数え方は、この helper にも当てはまる
- 行き先:
  前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。`[api.list]` に `unfold[A, S](from: S, f: fn(S) -> Option[(A, S)]) -> List[A]` を足す。Emela で書け（core の `range` と同じく accumulator と `reverse`）、長さに上限の無い繰り返しでも stack を使わない。ループ構文を足さず、変数も不変のままなので、前提とは衝突しないと考える（確かめていない）。使い道は、正規表現の一致の列（この `find_all`）、文字列の字句への分割、木を辿る列など、「次の状態を決めながら値を出す」繰り返し。あわせて診断の改善: E0212 の `did you mean fold` は綴りの近さで選んだ help で、作る関数を探す人に畳む関数を示す

# 021 tail-recursion-modulo-cons

- 状態: open
- Emela: v0.28.2
- 意図: regex の class（`regex/src/class.emel`、計画の Task 5）で、範囲の List を前から作る 4 つの関数（`merge`、`coalesce`、`gaps`、`remove_sources`）を、再帰で作った残りの前に要素を足す形で書く。範囲の数に上限は無いので、長い List でも stack を使わないようにしたい
- こう書きたかった:
  `wish/class.emel` の 4 つの関数。Haskell、OCaml、Koka の、再帰の結果に cons する形
  - `merge`: `[x, ..merge(xs, b)]` と `[y, ..merge(a, ys)]`（`:84`）
  - `coalesce`: `[a, ..coalesce(rest)]`（`:90`）
  - `gaps`: `[Span(next, s.from - 1), ..gaps(s.to + 1, rest)]`（`:97`）
  - `remove_sources`: 再帰の結果の組を `let` で分け、前に足して組み直す（`:113-125`。`(kept, [False, ..hit])`、`([s, ..kept], hit)`、`(before ++ kept, [True, ..hit])`）
  ```emela
  fn gaps(next: Int, spans: List[Span]) -> List[Span] = match spans {
    [] => if next <= MAX { [Span(next, MAX)] } else { [] }
    [s, ..rest] => if next < s.from { [Span(next, s.from - 1), ..gaps(s.to + 1, rest)] } else { gaps(s.to + 1, rest) }
  }
  ```
  regex の公開 API の `split`（`wish/find_all.emel:116-122`、計画の Task 7）でも、切った piece の List を同じ形で書いた: `[Text.slice(s, last, found.start), ..split_from(re, s, input, found.end, found.end)]`（`:120`）。同じ wish の `find_all` は `List.unfold` で書いた（027）。自分で再帰を書くなら、この形の `[m, ..matches_from(...)]` になる
  key codec の表記の `parse`（`wish/notation.emel:24-33` の `parse_at`、サブプロジェクト 2 の計画の Task 3）でも、読んだキーの List を同じ形で書いた: `[k, ..parse_at(rest.drop(length), offset + 1 + length)]` と `[char_key(c), ..parse_at(rest, offset + 1)]`。`>` の行の長さには、tape の 1 行という以外に上限が無い
  key codec の decode（`wish/decode.emel:22-35` の `read`、サブプロジェクト 2 の計画の Task 4）でも、読んだ item の List を同じ形で書いた: `[d, ..read(more)]`、`[Key(k), ..read(more)]`、`[Key(key(Esc, NO_MODS)), d, ..read(more)]`。1 つの `i` イベントの bytes の長さには上限が無い（手で録った cast の 1 つのイベントに、長い入力がまとまることがある）
  key codec の表記の `modifiers`（`wish/notation.emel:70-81`、サブプロジェクト 2 の計画の Task 3）でも、`<` の後ろの修飾の List を、再帰の結果の組を `let` で分けて前に足す形で書いた: `let (mods, after) = modifiers(rest)` の次に `([mod, ..mods], after)`（`:74-75`）。`<C-C-C-...` のように、修飾の並びの長さには、tape の 1 行という以外に上限が無い
- 診断:
  なし。wish check（v0.28.2）では、4 つとも `=` で書いた本体（020）の中にあり、診断が届かなかった。repo の外の使い捨ての Pome で、同じ形を正しい構文で書いた `[x, ..copy(rest)]`（2026-11-25）は、`emela check .` を診断なしで通る。`emela run .`（JS、bun）では、長さ 10000 の List は通り、長さ 100000 で ``RangeError: Maximum call stack size exceeded.`` で止まる。止まる前に警告は出ない
  表記の wish check（v0.28.2）では、`parse_at` の腕は `=>`（E0110）と char literal（013）の行にあり、cons の形には何も言わない（言うべき誤りでもない）
  decode の wish check（v0.28.2）では、`read` の腕は前置の match（E0142）と `let`（004）の行にあり、cons の形には何も言わない
  表記の `modifiers` の wish check（v0.28.2）でも、腕は前置の match（E0142）、char literal（013）と `=>`（E0110）の行にあり、`let` で組を分けて組み直す形には何も言わない（言うべき誤りでもない）
- 回避策:
  4 つの関数に、作りかけの結果を逆順で持つ引数（`merge`、`coalesce`、`gaps` は `done`、`remove_sources` は `kept` と `hits`）を足し、どの再帰も自分への末尾呼び出しにした。終わりで `reverse()` し、残りがあれば `append` する（`regex/src/class.emel`。印は 4 つの関数の直前のコメントの行）
  ```emela
  fn gaps(next: Int, spans: List[Span], done: List[Span]) -> List[Span] {
    spans match {
      [] if next <= MAX_CODE_POINT -> [Span(next, MAX_CODE_POINT), ..done].reverse()
      []                           -> done.reverse()
      [s, ..rest] if next < s.from -> gaps(s.to + 1, rest, [Span(next, s.from - 1), ..done])
      [s, ..rest]                  -> gaps(s.to + 1, rest, done)
    }
  }
  ```
  Task 7 の `split_from` と `matches_from`（`regex/src/lib.emel`、印は 2 つの関数の直前のコメントの行）も、作りかけの結果を逆順で `done` に持ち、終わりで `reverse()` する
  表記（Task 3、`src/key/notation.emel` の `keys`）も、読んだキーを逆順で `done` に持ち、終わりで `reverse()` する（印は関数の直前のコメントの行）
  decode（Task 4、`src/key/decode.emel` の `items`）も、読んだ item を逆順で `done` に持ち、終わりで `reverse()` する（印は関数の直前のコメントの行）。1 回の呼び出しで 1 つの item を足す形にそろえたので、wish の `[Key(key(Esc, NO_MODS)), d, ..read(more)]`（ESC の後ろがキーでないとき、`<Esc>` と次の item の 2 つを足す腕）は、`<Esc>` だけを返し、次の item は次の呼び出しで読み直す形にした（`item`）
  表記（Task 3、`src/key/notation.emel` の `modifiers`）も、読んだ修飾を `done` に持ち、自分への末尾呼び出しにした（印は関数の直前のコメントの行。friction-review で記録し、印を足した）。修飾の順は意味を持たない（`Set` にして重なりを調べる）ので、終わりの `reverse()` は無く、書いた順の逆のまま返す
- コスト:
  - 行数: 4 つの関数に引数が足され（`remove_sources` は 2 つ）、呼ぶ所（`union`、`complement`、`canonicalize`、`of_sorted`）は空の `[]` を渡す。`reverse()` が 7 行に 9 つ増えた。doc には「after the reverse of `done`」と書く必要が出た。`coalesce` は、入力の先頭の 2 つを比べる形から、入力の先頭と `done` の先頭を比べる形に変わった
  - 性能: どれも結果の List を `reverse` でもう 1 回作る。`merge` の終わりの 2 つの腕（`done.reverse().append(b)` など）と `remove_sources` の終わりの 2 つの腕（`kept.reverse().append(spans)` と `hits.reverse().append(...)`）の 4 つの `xs.reverse().append(ys)` は、`xs` を 3 回歩く。`List.append` は `reverse_onto(reverse(xs), ys)`（`emela-core/lib/core/list.emel:91-93`）で、1 回で済む `reverse_onto`（`:84`）は private。公開の関数で 1 回にするには `done.fold(from: b, f: |acc, s| [s, ..acc])` と closure で書くことになり、何をしているかが読みにくい。どれも範囲の数と表の大きさに比例するのは変わらない
  - 基盤レベルは漏れていない
  - この repo の使い方では、wish の形でも深さは範囲の数（`remove_sources` では、それに表の 1512 件を足した数）までで、上の 10000 より小さいと見積もる（普通の regex の class を想定。bun 以外の target の stack の深さは測っていない）。それでも spec が保証しないので、深さに上限の無い形を選んだ
  - Task 7 の `split` の piece の数と `find_all` の一致の数には、入力の長さのほかに上限が無い。class の範囲の数と違い、長いログを行に切るだけで上の 10000 を超える。使い捨ての Pome で、`a1` を 100000 回並べた入力の `\d` の `find_all`（100000 個の一致）が bun で stack を使い切らずに通ることを確かめた（2026-11-25）
  - 表記（Task 3）: `keys` に `done` の引数が足され、`parse` は空の `[]` を渡す。終わりの腕が `done.reverse()` になった。キーの数（`>` の行の code point の数まで）に比例するのは変わらない
  - decode（Task 4）: `items` に `done` の引数が足され、`decode` は空の `[]` を渡す。終わりの腕が `done.reverse()` になった。ESC の後ろのキーでない item（貼り付けか読めない bytes）は 2 回読む
  - 表記の `modifiers`（Task 3）: `done` の引数が足され、`angle` は空の `[]` を渡す。順を気にしないので `reverse()` は増えていないが、doc に「kept in the reverse of the written order」と書く必要が出た。行数は増えていない（関数は wish の 12 行に対して 9 行。組を分けて組み直す所が無くなった）
  - std も同じ形で書いている: `core/list.emel` の先頭のコメント（「Functions that build a result from the front accumulate it in reverse and then `reverse` it.」）と、`range_onto`、`zip_onto`、`take_onto`、`filter_map_onto`、`merge_onto`、`map` と `filter`（`fold` の後に `reverse`）
- spec:
  `[fn.loop]`（「A tail call to the function itself is guaranteed not to consume stack.」。保証は自分への末尾呼び出しだけで、cons の中の呼び出しは末尾の位置に入らない）、`[intro.premises]`（ループ構文は無い）、`[api.list]`（`reverse`、`append`。`reverse_onto` は載っていない）
- 既存:
  emela の issue と PR に無い（2026-11-25、`gh api search/issues` で `is:issue` と `is:pull-request` のそれぞれを「"modulo cons"」「TRMC」「"tail recursion"」「"stack overflow"」「"Maximum call stack"」「"tail call"」「accumulator」で検索。当たったのは別の話題: issue #216 は Show の深さ、PR #502 は局所関数、PR #110 は自己末尾呼び出しの実装、他は Bytes、ARC、Monoid、性能の PR）。v0.28.2 の emela の repo 全体（`git grep`）に「modulo cons」「TRMC」は無い。`proposals/local-fn.md:327` は、accumulator や添字で回す再帰を公開の fn と private の helper の組で書いていて、core と std に 16 組あると数えている。局所関数は helper を隠すが、accumulator と `reverse` は残る。他の言語: OCaml 4.14 の `[@tail_mod_cons]`（https://ocaml.org/manual/4.14/tail_mod_cons.html）、Koka の tail recursion modulo context（Leijen と Lorenzen、POPL 2023、https://popl23.sigplan.org/details/POPL-2023-popl-research-papers/40/Tail-Recursion-Modulo-Context-An-Equational-Approach）
- 行き先:
  前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。`[fn.loop]` の保証を、末尾の位置の cons の残り（`[e, ..f(args)]`）にある自分への呼び出しにも広げる（tail recursion modulo cons）。前提とは衝突しないと考える（確かめていない）: ループ構文を足さず、変数は不変のまま（作りかけの cons の尾を埋めるのは、値が外から見える前）。Koka の論文は、継続を何度も再開する制御では以前の TRMC のやり方が壊れると書くが、Emela は継続を 1 回しか再開しない（`[intro.premises]`）。使い道は、この 4 つのうち `merge`、`coalesce`、`gaps` と、std の `_onto` の helper と `map`、`filter`。`remove_sources` の wish の形は、再帰の結果の組を分けてから組み直すので、modulo cons でも末尾にならない。それには accumulator が要る。小さい代わりとして、`reverse_onto` を公開すれば（`List.append_reversed` などの名前で）、`done.reverse().append(b)` が 1 回で済む。未提出。出すのは user
  使い道に Task 7 の `split_from`（`regex/src/lib.emel`）も足す。wish の `[piece, ..split_from(...)]` は modulo cons で末尾になる。`matches_from` は、027 の `List.unfold` があれば再帰そのものが要らない
  使い道に表記の `keys`（`src/key/notation.emel`、Task 3）も足す。wish の `[k, ..parse_at(...)]` は modulo cons で末尾になる
  使い道に decode の `items`（`src/key/decode.emel`、Task 4）も足す。wish の `[d, ..read(more)]` は modulo cons で末尾になる
  使い道に表記の `modifiers`（`src/key/notation.emel`、Task 3）も記録する。ただし wish の形は `remove_sources` と同じく、再帰の結果の組を分けてから組み直すので、modulo cons でも末尾にならない。accumulator が要る

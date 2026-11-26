# 050 list-spread-position

- 状態: open
- Emela: v0.28.2
- 意図: key codec の decode（`src/key/decode.emel`、サブプロジェクト 2 の計画の Task 4）の spec §7 の 1 で、bytes の List が貼り付けの始まりの `CSI 200~`（const の `PASTE_START`、6 byte）で始まるかを match の腕で分け、残りを束ねる。読めない CSI の列も、`ESC [`、引数の byte、中間の byte の List をつないで作る
- こう書きたかった:
  `wish/decode.emel:48`（`PASTE_START: List[Int]` の const を、パターンの先頭に展開する。Erlang と Elixir の binary の `<<"\e[200~", rest::binary>>` のつもり）と `:85`（List の literal の途中に 2 つの List を展開する。JS の `[a, ...xs, ...ys]` のつもり）
  ```emela
  [..PASTE_START, ..rest] -> paste(rest)
  ...
  let seen = [0x1b, '[', ..params, ..inter]
  ```
- 診断:
  wish check（v0.28.2）の `:48` に 5 つ: ``error[E0115]: `..` needs at least one element before it``、``error[E0110]: expected `]` ``、``error[E0110]: expected `->` ``、``error[E0122]: expected newline or `}` after match arm``、``error[E0301]: type mismatch: expected `(Decoded, List[Int])`, found `List[Int]` ``。help は付かない。E0115 は `..` の前に要素を足すよう読めるが、足しても `..PASTE_START` は名前を束ねる形にしかならない。パターンの `..` が残りを束ねるだけだとは、どれも言わない。`:85` の展開には届かなかった（同じ行の `let`（004）と char literal（013）で崩れた）
  repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-27）:
  - パターンの `[..PREFIX, ..rest] -> rest`（`PREFIX: List[Int]` の const）: E0115、`PREFIX` を指す ``E0110: expected `]` `` と ``E0110: expected `->` ``、E0122 の 4 つと、次の腕の ``warning[W0301]: unreachable match arm``
  - literal の `[0x1B, ..xs, ..ys]`: 2 つ目の `..` を指す ``error[E0114]: `..` must come last`` の 1 つ
  - literal の `[..xs, 0x7E]`: ``error[E0115]: `..` needs at least one element before it`` と ``error[E0114]: `..` must come last`` の 2 つ
  literal の 2 つは、何が書けないかを正しく言う。パターンの方は、`..` の後ろの名前が const であることにも、束ねる名前しか書けないことにも触れない
- 回避策:
  パターンは先頭の 2 byte だけを `[ESC, LEFT_BRACKET, ..]` で分け、`PASTE_START` を Bytes の const（`Bytes.hex("1b5b3230307e")`）にして、guard で bytes の切り出しと比べる: `[ESC, LEFT_BRACKET, ..] if b.slice(at, at + PASTE_START.size()) == PASTE_START -> paste(b, at)`（`src/key/decode.emel` の `unprefixed`、`FRICTION(050)` の印）。残りは束ねず、`paste` が offset から読む
  literal の展開は、decode が元の Bytes を持って `slice` で切る設計にしたので（052）、要らなくなった（`csi` の `Unknown(b.slice(at, at + length))`）。展開が書けなかったことでコードは変わっていないが、wish と実装の差として記録する
  Task 4 の報告は、パターンの所を「slice を const と比べるのは素直な形で、回り道の補助関数も足していない」として回り道に数えなかった。friction-review で、wish の形が書けず腕の分け方が変わった所として、ここに記録した
- コスト:
  `ESC [` を 2 回書く（パターンの 2 つの const と、`PASTE_START` の 6 byte の中）。guard のある腕は網羅性と冗長な腕の検査に数えられない（`[fn.match]`）ので、腕の順（貼り付けの腕が CSI の腕より前）が意味を持ち、検査はそれを見ない。行数は 1 行で同じ。普段のコードに基盤レベルは漏れていない
- spec: `[grammar.pattern]`（`"[" pattern { "," pattern } [ "," ".." [ lower_name ] ] "]"`。`..` の後ろは名前だけ）、`[fn.match]`（`spec/language/06-functions.md:136`: 「In a list pattern, the forms with only the rest (`[..]`, `[..rest]`) cannot be written.」。guard のある腕は網羅性に数えない）、`[grammar.expr]`（`spec/grammar.md:196`: 「A `..expr` in a list literal can appear only once, at the end. ... `[..rest]` with no elements, and `..` in the middle or more than once (`[..a, ..b]`), cannot be written.」）、`[data.const]`、`spec/diagnostics.md` の E0114、E0115、E0110
- 既存: 決まった設計（grammar）。emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「list pattern prefix」「spread list」「E0115」「E0114」を検索。当たったのは、構成子の呼び出しの末尾の `..式` を読む #129 で、別の話題）
- 行き先:
  自分の誤解だった（grammar で決まっている） → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: in a list pattern, `..` followed by an uppercase name (`[..PREFIX, ..rest]`) gets ``E0115: `..` needs at least one element before it`` and three parse errors, none of which says that a pattern's `..` only binds the rest to a name (`[x, ..rest]`), so a const cannot be spread there. E0115 in a pattern could add ``= help: in a pattern, `..` binds the rest to a name; match the elements one by one or test the prefix in a guard``. The literal side (E0114, E0115) is already clear
  前提の範囲内で spec に足りない → proposal の下書きの材料（弱い。まだ書かない）: 定数の接頭辞のパターン（`[..PREFIX, ..rest]`。const が literal だけでできていれば、`[data.const]` の const のパターンと同じく網羅性の検査に入れられる）と、literal の途中の展開（`[a, ..xs, ..ys]`）。使い道は今のところ貼り付けの始まりの 1 つだけ。未提出。出すのは user

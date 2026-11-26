# 046 bytes-split-parse

- 状態: open
- Emela: v0.28.2
- 意図: key codec の decode（`src/key/decode.emel` の `numbers`、サブプロジェクト 2 の計画の Task 4）で、CSI の列の引数の byte（0x30〜0x3F）を `;` で分け、それぞれを 10 進の数にする（`1;5` を `[1, 5]` に）。引数は `i` イベントの Bytes の一部で、String ではない
- こう書きたかった:
  `wish/decode.emel:113-115`。byte の List を区切りの byte で分け、数字の byte の List をそのまま数にする
  ```emela
  fn fields(params: List[Int]) -> Option[List[Int]] {
    params.split(';').map(fn(ds) { Int.parse_digits(ds) }).all()
  }
  ```
- 診断:
  wish check（v0.28.2）: `:114` に ``error[E0313]: type `List[Int]` has no field or function `split` ``。その前に、同じ行の char literal `';'` の E0105 が 3 つ（013）と、崩れた式の後追いの E0118、E0110、E0122。`Int.parse_digits` には届かなかった
  repo の外の使い捨ての Pome での最小の形（2026-11-27）で 3 つ: Bytes の `b.split(Bytes.hex("3b"))` に ``error[E0313]: type `Bytes` has no field or function `split` ``、List の `xs.split(0x3B)` に ``error[E0313]: type `List[Int]` has no field or function `split` ``、`Int.parse_digits(xs)`（`xs: List[Int]`）に ``error[E0212]: module `Int` has no `parse_digits` ``。どれにも help は付かない
- 回避策:
  引数の byte を `Bytes.decode_utf8` で String にし、`String.split(";")` で分け、それぞれを `Int.parse` で数にした（`src/key/decode.emel` の `numbers` と `number`、`FRICTION(046)` の印）。引数の byte は ASCII なので、`decode_utf8` の `None` は起きない。それを `expect`（040）で defect にした
  数にならない欄（空、`:`、`<`、`=`、`>`、`?` を含むもの、Int に収まらないもの）は `Int.parse` の ParseError を `escape` で `None` にして受け、1 つでもあれば列ごと読めない（006）
  std も、数字を読む所は String を組み立ててから `Int.parse` を呼ぶ: v0.28.2 の `std/dynamic/number.emel:56` の `Int.parse("#{sign}#{String.concat(digits)}")`
- コスト:
  起きない `None` を持つ `decode_utf8` の呼び出しと `expect` が 1 行。CSI の列ごとに引数の String を 1 つと、欄ごとの String を作る（読める列では欄は 3 つまでなので小さい）。String を経由する理由をコメントに書く必要がある。普段のコードに基盤レベルは漏れていない
- spec: `[api.std.bytes]`（区切る関数も、数として読む関数も無い）、`[api.list]`（`partition` と `find_index` はあるが、区切りで分ける関数は無い）、`[api.string]`（`split` は String だけ）、`[api.int]`（`parse(s: String) -> Int fails ParseError` だけ）
- 既存: emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「List split」「Bytes split」「parse_digits」「Int parse Bytes」を検索。当たりなし）。`proposals/bytes.md`（#457）は区切る関数にも数として読む関数にも触れていない。`spec/open-questions.md` にも無い。044（Bytes の中の bytes を探す関数が無い）と同じく、Bytes を String に変えずに扱う関数が足りない所
- 行き先: 前提の範囲内で std に足りない → proposal の下書きの材料（まだ書かない。使う所は decode の 1 か所）。`Bytes.split(b, sep: Bytes) -> List[Bytes]`（044 の `Bytes.index_of` があれば書ける）と、ASCII の数字の Bytes を読む関数（`Int.parse_ascii(b: Bytes) -> Option[Int]` など）。端末の制御列の引数、HTTP の header の数など、Bytes のまま数を読む所で使える。未提出。出すのは user

# 043 utf8-first-code-point

- 状態: open
- Emela: v0.28.2
- 意図: key codec の decode（`src/key/decode.emel`、サブプロジェクト 2 の計画の Task 4）の spec §7 の 6（「それ以外は UTF-8 として読み、1 つの code point を 1 つの `Char` にする。読めない bytes は、続く分をまとめて 1 つの `Unknown` にする」）で、bytes の途中の offset から 1 つの code point とその byte 数を読む。読めなければ、その byte を読めない列に入れる
- こう書きたかった:
  `wish/decode.emel:52-59`。先頭の 1 つの code point と残りを返す関数（Go の `utf8.DecodeRune`、Rust の `std::str::from_utf8` の `Utf8Error::valid_up_to` と `error_len` のつもり）
  ```emela
  _ -> match bs.decode_utf8_char() {
    # 制御文字は Key.key が §6 の代表にする
    Some((c, rest)) -> (built(Char(c), NO_MODS, alt), rest)
    None -> {
      let (bad, rest) = bs.span(fn(_, tail) { tail.decode_utf8_char() == None })
      (Unknown(Bytes.from_list(bad)), rest)
    }
  }
  ```
- 診断:
  wish check（v0.28.2）では、前置の match（E0142）の行にあり、届かなかった
  repo の外の使い捨ての Pome での最小の形（`b.decode_utf8_char(0)`、`b` は Bytes、2026-11-27）: ``error[E0313]: type `Bytes` has no field or function `decode_utf8_char` ``。help は付かない
- 回避策:
  private な `code_point(b, at, length)` を書いた。offset `at` からの 1、2、3、4 byte を `Bytes.slice` で切って順に `Bytes.decode_utf8` にかけ、最初に `Some` になった長さを 1 つの code point の長さとする。code point は、できた 1 文字の String の `code_points().head()` で取り出す（`src/key/decode.emel` の `code_point`、`FRICTION(043)` の印。`head()` の起きない `None` は 040 の `expect` で defect にする）。短い列から試すので、最初に `Some` になった長さが 1 つの code point の長さになる（lead byte が ASCII でなければ、それより短い列は正しい UTF-8 にならない）
  UTF-8 の lead byte と continuation byte の規則は自分で書いていない（AGENTS.md 規則 2 の「UTF-8 を自前で読んだ」にはしていない）。使う UTF-8 の知識は、1 つの code point が 1〜4 byte であることだけ
- コスト:
  17 行（コメントを含む。最終レビューの後の fix で、`head()` の起きない `None` を 040 の `expect` にし、その印のコメント 2 行と、fmt が折り返した 2 行が増えた。その前は 13 行）。1 文字を読むのに `slice` と `decode_utf8` を最大 4 回呼び、成功すると 1 文字の String を作ってから code point の List に戻す。読めない byte では 4 回とも失敗する。読めない列の終わりを探す `not_utf8_end` は、offset ごとにこれを呼ぶ
  std の `decode_utf8` の中には、知りたいことそのもの（offset から始まる正しい列の byte 数、無ければ 0）を返す private な `sequence_size(b, i, lead)` がある（v0.28.2 の `crates/emela-core/lib/std/bytes.emel:84-108`）
  普段のコードに基盤レベルは漏れていない
- spec: `[api.std.bytes]`（`decode_utf8` は全体を読むか `None` を返すだけで、位置や長さを返す関数は無い）、`[api.string]`（`code_points`）
- 既存:
  `proposals/bytes.md`（#457、実装は #466）は、置き換え文字で読む `decode_utf8` を「Lossy decoding hides corrupted input; it can be written on top of the strict version later if needed.」として外した。その「上に書く」にも、どこまでが正しいかを返す関数か、1 つの code point を読む関数が要る。emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「decode_utf8」「utf8 code point Bytes」を検索。当たったのは #457 と #466）
- 行き先:
  前提の範囲内で std に足りない → proposal の下書きの材料（まだ書かない）。`Bytes.decode_utf8_at(b, index) -> Option[(Int, Int)]`（code point と byte 数。Go の `DecodeRune`）、または `Bytes.utf8_valid_up_to(b) -> Int`（Rust の `valid_up_to`）。前者は std の `sequence_size` を使えば数行で書ける。端末の入力のように壊れた bytes が混ざる所と、置き換え文字で読む decode が、これで書ける。未提出。出すのは user

# 040 option-expect

- 状態: open
- Emela: v0.28.2
- 意図: key codec の表記（`src/key/notation.emel`、サブプロジェクト 2 の計画の Task 3）で、起きないと分かっている `None` を defect にして中身を取り出す。`Key.key` が `None` を返すのは scalar value でない `Char` だけだが、`parse` が渡す code point は入力の String から取ったものか、名前の表の空白と `<` なので起きない。`String.from_code_point` も、String や `Key` から取った code point（scalar value）には `None` を返さない。テストの生成器（`test/key_gen.emel`）でも、生成した code point と F1〜F12 から `Key.key` と `Key.f_key` を呼び、範囲の中の位置を `List.get` で読む
  key codec の decode（`src/key/decode.emel`、Task 4）でも、SS3、CR LF、UTF-8 として読んだ文字、単独の ESC と、`27;m;c~` と `c;m u` のほかの CSI のキーで `Key.key` を呼ぶ所（code は `Char` でないか、UTF-8 から読んだ code point の `Char`）と、0x30〜0x3F だけの CSI の引数の byte を `Bytes.decode_utf8` で String にする所（ASCII なので起きない。String にするのは 046）と、1〜4 byte を `Bytes.decode_utf8` で読んだ String の最初の code point を `code_points().head()` で取り出す所（`code_point`。読めた String は空でないので起きない。1 つの code point を String を経由して読むのは 043）で、起きない `None` を defect にする
  key codec の golden の補助（`test/golden.emel` の `row_key`、Task 5）でも、表のキーの名前と修飾のビットから `Key.f_key` と `Key.key` を呼ぶ。名前は harness が書いた表のもので、F キーは F1〜F12、文字は ASCII の印字できる文字と `é`、`あ`、`😀` なので、どちらの `None` も起きない（起きたら表の誤りで、defect にする）
  key codec の encode（`src/key/encode.emel` の `text_of`、Task 6）でも、`Char` の code point と制御文字の code point を `String.from_code_point` で String にする所の起きない `None`（003）を defect にする。golden の補助（`test/golden.emel`、Task 6）でも、`representative` が代表のキーに Alt を付け直す `Key.key` の起きない `None` を defect にする
  ストリーム用の UTF-8 デコーダ（`src/utf8.emel` の `character`、サブプロジェクト 3 の計画の Task 1）でも、WHATWG の decoder が作った code point を `String.from_code_point` で String にする所の起きない `None`（003。境界の検査が surrogate、U+10FFFF より上、過長を除く）を defect にする。そのテスト（`test/utf8_test.emel`）の生成器でも、0〜255 の Int だけで作った bytes の List を `Bytes.from_list` で Bytes にする所と、生成した scalar value を `String.from_code_point` で String にする所（003）の、起きない `None` を defect にする
  VT の parser（`src/vt/parser.emel` の `character`、サブプロジェクト 3 の計画の Task 3）でも、`advance` が受けた String の code point を `String.from_code_point` で String にする所の起きない `None`（003）を defect にする。そのテスト（`test/cut.emel` の `character`。Task 3 では `test/parser_test.emel` にあった）でも、入力から取った code point と、生成器が作った U+00A0 までの code point を String にする所の起きない `None` を defect にする
  VT の画面（`src/vt/screen.emel` の `at`、サブプロジェクト 3 の計画の Task 4）でも、呼ぶ側が範囲の中と知っている位置（行は `rows` 未満、列は `cols` 未満）の行やセルを `Array.get` で読む所（009）の、起きない `None` を defect にする
  VT の解釈（`src/vt/terminal.emel`、サブプロジェクト 3 の計画の Task 5）でも、DEC の罫線の表を位置で読む所（`at`、009）と、REP がカーソルの前の文字を読む所（`repeat`）で、起きない `None` を defect にする。`repeat` の `None` は、カーソルの行を `Screen.lines` の List から `get` で読む所（カーソルの行は画面の中にある）と、カーソルより前のセルから全角の右でないものを `find` で探す所（1 列目のセルは全角の右にならない）の 2 つ。test の補助（`test/vt_snapshot.emel`）でも、色の 0〜255 の 3 つの値を 16 進にするために `Bytes.from_list` で Bytes にする所（`hex`）と、セルの code point を `String.from_code_point` で String にする所（`character`、003）の、起きない `None` を defect にする
- こう書きたかった:
  `wish/notation.emel:38`、`:127`。Rust の `Option::expect`
  ```emela
  Key.key(Char(c), NO_MODS).expect("a String holds only scalar values")
  ```
  decode では `wish/decode.emel:63-66` の `built`。起きない所は `.expect` にし、起きうる `27;m;c~` と `c;m u` だけを `csi_key` の Option で `Unknown` にしていた（`:87-90`）
  ```emela
  Key(key(code, mods with { alt: mods.alt || alt }).expect("scalar value"))
  ```
  golden の補助では `wish/golden.emel:24`、`:27`。F キーの数と、キーそのものに
  ```emela
  "F" ++ n if n.length() > 0 -> Function(f_key(n.to_int().expect("F key number")).expect("F key in 1 to 12"))
  ...
  key(code, mods).expect("a key that termwiz encoded")
  ```
  VT の画面の wish（`wish/screen.emel`）は、読む所を添字の `s.grid[row]`、`line[col]` で書いた（009）ので、`.expect` は書いていない
  VT の解釈の wish（`wish/terminal.emel`）は、表を添字で読み（009）、REP の本体と test の補助は wish に書かなかったので、`.expect` は書いていない
- 診断:
  wish check（v0.28.2）で、2 か所とも ``error[E0313]: type `Option[Key]` has no field or function `expect` ``。help は付かない
  repo の外の使い捨ての Pome での最小の形（`xs.head().expect("not empty")`、2026-11-27）でも ``error[E0313]: type `Option[Int]` has no field or function `expect` `` の 1 つ
  decode の wish check（v0.28.2）では、`:65` の `with`（037）で呼び出しが崩れ（``E0110: expected `)` `` が 2 つと E0122）、`.expect(...)` には届かなかった。崩れる前までの `key(code, mods` に ``error[E0301]: type mismatch: expected `Key`, found `Option[Key]` `` が出た
  golden の補助の wish check（v0.28.2）: `:27` に ``error[E0313]: type `Option[Key]` has no field or function `expect` ``。help は付かない。`:24` の 2 つは、`let`（004）で崩れた行の右辺の match の腕にあり、届かなかった
- 回避策:
  private な `expect(opt, why)` を書いた（`opt match { Some(a) -> a; None -> panic("None, but #{why}") }`）。呼ぶ所は pipe で `Key.key(code, mods) |> expect("...")` と書く（`src/key/notation.emel` の `expect`、`FRICTION(040)` の印。`build`、`character`、`text_of` の 3 か所から呼ぶ）。テストの生成器（`test/key_gen.emel` の `expect`、`FRICTION(040)` の印。`keys_with`（Task 6 の fix の前は `keys`）、`codes`、`element` の 3 か所から呼ぶ）にも同じものを置いた。private な関数は module の外から呼べないので、2 つ書いた
  decode（`src/key/decode.emel` の `expect`、`FRICTION(040)` の印）にも同じものを置き、3 つ目になった。`pressed`（SS3、CR LF、UTF-8 として読んだ文字、単独の ESC と、`27;m;c~` と `c;m u` のほかの CSI のキー）と `numbers`（`parameters.decode_utf8() |> expect("the parameter bytes are ASCII")`）と `code_point`（`s.code_points().head() |> expect("a String decoded from bytes is not empty")`、腕の直前のコメントの行に `FRICTION(040)` の印）の 3 か所から呼ぶ。`None` が本当に起きる `27;m;c~` と `c;m u`（`c` は入力から読んだ数で、scalar value とは限らない）だけは、`typed` が `Key.key` の Option を返し、`csi` が `Unknown` にする。最初の実装（`955d78c`）は、起きない `None` もすべて `keyed` で `Unknown(bytes)` にし、`decode_utf8` の `None` も `and_then` で読めない列に流していて、記録が無かった。Task 4 の review で、wish の分け方に戻した。`decode_utf8` の `None` は、003（scalar value の code point から String を作る）でなく、String を経由すること（046）から出た起きない `None` なので、ここに数える
  `code_point` の `head()` の `None` は、最終レビューまで `map` でそのまま `None` に流れ、読めない byte として扱われていた（043 のコストに書いていた）。最終レビューの後の fix で、ESCALATION 2 の答え 1（起きない `None` は 040 の `expect` にする）に合わせ、`expect` に直した。`head()` の `None` も `decode_utf8` の `None` と同じく、1 つの code point を String を経由して読むこと（043）から出た起きない `None` なので、ここに数える
  golden の補助（`test/golden.emel` の `row_key`、`FRICTION(040)` の印）では、4 つ目の `expect` を置かず、その場で `Some(k) -> k` と `None -> panic(...)` の match にした（`None` を defect にする所は 1 つなので、6 行の補助関数を置くより、その場の 4 行の match の方が短い）。F キーの `Key.f_key` の Option は、名前を引く `code` が `Option[KeyCode]` として返し、`and_then` で `Key.key` の Option とつないで、1 つの match で受ける。wish の 2 つの `.expect` を 1 つにまとめるために、`code` が Option を返す形になった
  encode（`src/key/encode.emel` の `text_of`、`FRICTION(040)` の印）: `None` を defect にする所は `text_of` の中の 1 つだけなので、golden の補助の Task 5 と同じく、その場の match にした。wish（`wish/encode.emel:71` の `c.to_utf8()`）は失敗しない形を想定していたので、`.expect` は書いていない（003）
  golden の補助（Task 6）: `representative` で 2 つ目の `None` を defect にする所ができたので、`test/golden.emel` に 4 つ目の private な `expect` を置き（`FRICTION(040)` の印）、Task 5 の `row_key` のその場の match も `|> expect(...)` に直した。印は `expect` の定義に移した
  UTF-8 デコーダ（`src/utf8.emel` の `character`、`FRICTION(040)` の印）: `None` を defect にする所は 1 つなので、encode と同じくその場の match にした。wish（`wish/utf8.emel:32`、`:56` の `Char.from_int`）は失敗しない形を想定していたので、`.expect` は書いていない（003）。テスト（`test/utf8_test.emel` の `expect`、`FRICTION(040)` の印）には 5 つ目の private な `expect` を置き、`inputs`（`Bytes.from_list`）と `encoded`（`String.from_code_point`）の 2 か所から呼ぶ
  VT の parser（`src/vt/parser.emel` の `character`、`FRICTION(040)` の印）: `None` を defect にする所は 1 つなので、UTF-8 デコーダと同じくその場の match にした。wish（`wish/parser.emel:55` など）は `String.from_code_point` が String を返すと思っていたので、`.expect` は書いていない（003）。テスト（`test/cut.emel` の `character`、`FRICTION(040)` の印。Task 3 では `test/parser_test.emel` にあった）も、`None` を defect にする所は `character` の中の 1 つなので、その場の match にした
  VT の画面（`src/vt/screen.emel` の `at`、`FRICTION(009)` と `FRICTION(040)` の印）: Array を位置で読む所が 9 つあるので、その場の match を 9 つ書かず、private な `at[A](a: Array[A], index: Int) -> A`（`get` の match と panic）を 1 つ置いた。どの Option にも使える `expect` でなく、009 の下書きの `Array.at` の形にした（panic の文は `Array.set` の defect に倣って位置と大きさを言う）
  VT の解釈（`src/vt/terminal.emel`、`FRICTION(040)` の印 2 か所）: `at` は画面と同じものを 2 つ目として置いた（009）。`repeat` は、`get(t.row)` の Option と `find` の Option を `and_then` でつなぎ、1 つのその場の match で `None` を panic にした。test の補助（`test/vt_snapshot.emel` の `hex` と `character`、`FRICTION(040)` の印 2 か所）も、`None` を defect にする所はそれぞれ 1 つなので、その場の match にした
  VT の公開 API（`src/vt.emel` の `character`、`FRICTION(040)` の印）: `None` を defect にする所は 1 つなので、parser と同じくその場の match にした。wish（`wish/vt.emel:68`）は `String.from_code_point` が String を返すと思っていたので、`.expect` は書いていない（003）。テスト（`test/vt_test.emel`）は、parser のテストと `test/cut.emel` の `character` を共有する（Task 6 では写しを `test/vt_test.emel` に置いたが、review の後でまとめた）
- コスト:
  補助関数 3 つ（6 行ずつ。表記、テストの生成器、decode）。method の形（`.expect(...)`）では書けず、pipe で書く（`[type.rules]`: method の形で呼べるのは、型を定義した module の関数だけ）。普段のコードに基盤レベルは漏れていない
  repo の中で同じ match を所ごとに書いている所が、これまでに 11 ある: `regex/src/fold.emel`、`regex/src/class.emel`、`regex/src/vm.emel`（どれも 009）、`regex/src/syntax.emel`、`regex/src/lib.emel`、`text/src/lib.emel`、`text/test/text_test.emel`（どれも 003）、`regex/test/differential_test.emel`、`regex/test/linear_test.emel`、`regex/test/find_test.emel`、`test/golden.emel`。std の `Std.Bytes.hex` も `from_hex(s)` の `None` を同じ形で `panic` にする（v0.28.2 の `std/bytes.emel:157-160`）
  encode と golden の補助（Task 6）: 補助関数がもう 1 つ（golden の補助の `expect`、6 行）と、その場の match が 1 つ（encode の `text_of`）。repo の中でその場の match を書いている所は、golden の補助の 1 つが `expect` に変わり、encode の 1 つが増えたので、11 のまま
  UTF-8 デコーダ（Task 1）: 補助関数がもう 1 つ（テストの `expect`、6 行）と、その場の match が 1 つ（`src/utf8.emel` の `character`）。repo の中でその場の match を書いている所は 12 になった
  VT の parser（Task 3）: その場の match が 2 つ（`src/vt/parser.emel` と、テストの `character`。テストの方は今は `test/cut.emel`）。repo の中でその場の match を書いている所は 14 になった
  VT の画面（Task 4）: 補助関数がもう 1 つ（`at`、6 行）。その場の match は増えない（14 のまま）
  VT の解釈（Task 5）: 補助関数がもう 1 つ（`at`、6 行）と、その場の match が 3 つ（`src/vt/terminal.emel` の `repeat`、`test/vt_snapshot.emel` の `hex` と `character`）。repo の中でその場の match を書いている所は 17 になった
  VT の公開 API（Task 6）: その場の match が 1 つ（`src/vt.emel` の `character`）。テストは parser のテストと `test/cut.emel` の `character` を共有する（Task 6 では写しを置いて 2 つと数えたが、review の後でまとめた）。repo の中でその場の match を書いている所は 18 になった
- spec: `[api.option]`（`map`、`and_then`、`or`、`is_some`、`is_none`、`or_fail`）、`[lib.api-rules]`（「A precondition of the caller is broken: it is a defect.」）、`[type.rules]`、`spec/history.md:459`（`Option.unwrap_or` を `Option.or` にした。`unwrap` と `expect` には触れていない）
- 既存: emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「Option expect」「unwrap」を検索。「unwrap」で当たったのは `unwrap_or` を `or` にした #191 などで、別の話題）。checkout の main（596b6038）の core にも無い。009（範囲外を defect にする `Array.at`）と 003（失敗しない `String.from_scalars`）は、それぞれの所で起きない `None` を無くす案で、このメモはどの Option にも使える形
- 行き先: 前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。`Option.expect(opt, message) -> A`（`None` は `message` の defect）。`[lib.api-rules]` の「呼ぶ側の前提が壊れたら defect」を、呼ぶ側が 1 行で書ける形。009 と 003 と合わせ、repo と std の `None -> panic` の数を使い道に添える。未提出。出すのは user

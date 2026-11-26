# 040 option-expect

- 状態: open
- Emela: v0.28.2
- 意図: key codec の表記（`src/key/notation.emel`、サブプロジェクト 2 の計画の Task 3）で、起きないと分かっている `None` を defect にして中身を取り出す。`Key.key` が `None` を返すのは scalar value でない `Char` だけだが、`parse` が渡す code point は入力の String から取ったものか、名前の表の空白と `<` なので起きない。`String.from_code_point` も、String や `Key` から取った code point（scalar value）には `None` を返さない。テストの生成器（`test/key_gen.emel`）でも、生成した code point と F1〜F12 から `Key.key` と `Key.f_key` を呼び、範囲の中の位置を `List.get` で読む
- こう書きたかった:
  `wish/notation.emel:38`、`:127`。Rust の `Option::expect`
  ```emela
  Key.key(Char(c), NO_MODS).expect("a String holds only scalar values")
  ```
- 診断:
  wish check（v0.28.2）で、2 か所とも ``error[E0313]: type `Option[Key]` has no field or function `expect` ``。help は付かない
  repo の外の使い捨ての Pome での最小の形（`xs.head().expect("not empty")`、2026-11-27）でも ``error[E0313]: type `Option[Int]` has no field or function `expect` `` の 1 つ
- 回避策:
  private な `expect(opt, why)` を書いた（`opt match { Some(a) -> a; None -> panic("None, but #{why}") }`）。呼ぶ所は pipe で `Key.key(code, mods) |> expect("...")` と書く（`src/key/notation.emel` の `expect`、`FRICTION(040)` の印。`build`、`character`、`text_of` の 3 か所から呼ぶ）。テストの生成器（`test/key_gen.emel` の `expect`、`FRICTION(040)` の印。`keys`、`codes`、`element` の 3 か所から呼ぶ）にも同じものを置いた。private な関数は module の外から呼べないので、2 つ書いた
- コスト:
  補助関数 2 つ（6 行ずつ）。method の形（`.expect(...)`）では書けず、pipe で書く（`[type.rules]`: method の形で呼べるのは、型を定義した module の関数だけ）。普段のコードに基盤レベルは漏れていない
  repo の中で同じ match を所ごとに書いている所が、これまでに 10 ある: `regex/src/fold.emel`、`regex/src/class.emel`、`regex/src/vm.emel`（どれも 009）、`regex/src/syntax.emel`、`regex/src/lib.emel`、`text/src/lib.emel`、`text/test/text_test.emel`（どれも 003）、`regex/test/differential_test.emel`、`regex/test/linear_test.emel`、`regex/test/find_test.emel`。std の `Std.Bytes.hex` も `from_hex(s)` の `None` を同じ形で `panic` にする（v0.28.2 の `std/bytes.emel:157-160`）
- spec: `[api.option]`（`map`、`and_then`、`or`、`is_some`、`is_none`、`or_fail`）、`[lib.api-rules]`（「A precondition of the caller is broken: it is a defect.」）、`[type.rules]`、`spec/history.md:459`（`Option.unwrap_or` を `Option.or` にした。`unwrap` と `expect` には触れていない）
- 既存: emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「Option expect」「unwrap」を検索。「unwrap」で当たったのは `unwrap_or` を `or` にした #191 などで、別の話題）。checkout の main（596b6038）の core にも無い。009（範囲外を defect にする `Array.at`）と 003（失敗しない `String.from_scalars`）は、それぞれの所で起きない `None` を無くす案で、このメモはどの Option にも使える形
- 行き先: 前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。`Option.expect(opt, message) -> A`（`None` は `message` の defect）。`[lib.api-rules]` の「呼ぶ側の前提が壊れたら defect」を、呼ぶ側が 1 行で書ける形。009 と 003 と合わせ、repo と std の `None -> panic` の数を使い道に添える。未提出。出すのは user

# text

std の `String` に足りない関数を，std に入れるならこうなる名前と型で置いたもの．位置はコードポイントで数える（`String.contains` と `String.split` の照合，`Std.Json` の `SyntaxError` の `offset` と同じ．`String.length` と `String.chars` は書記素クラスタで数える）．std に入ったら，この Pome は消す．

```emela
import Text

Text.from_code_points([0x61, 0x1F600]) # Some("a😀")
Text.from_code_points([0xD800])        # None
Text.slice("a😀b", 1, 2)               # "😀"
Text.slice("abc", -1, 2)               # "ab"
```

| 関数 | 型 | 振る舞い |
|---|---|---|
| `from_code_points` | `from_code_points(cps: List[Int]) -> Option[String]` | `cps` のコードポイントを順に並べた文字列．Unicode のスカラー値（0 から 10FFFF，サロゲートの D800 から DFFF を除く）でないものが 1 つでもあれば `None`．`String.code_points` の逆 |
| `slice` | `slice(s: String, from: Int, to: Int) -> String` | `s` のコードポイントの `from` 番目（含む）から `to` 番目（含まない）まで．`from` と `to` は 0 から `s` のコードポイントの数までに丸め，`from` が `to` より小さくなければ `""`．`Bytes.slice` と `Array.slice` と同じ扱い |

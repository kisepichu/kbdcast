# 039 code-point-predicates

- 状態: open
- Emela: v0.28.2
- 意図: key codec の型（`src/key.emel` の `key`、サブプロジェクト 2 の計画の Task 2）で正規形（spec の §4）にするとき、`Char` の code point（Int）が Unicode の scalar value か、制御文字（0x00〜0x1F、0x7F）か、ASCII の記号（Rust の `is_ascii_punctuation`。termwiz が Shift を外すかを決めるのに使う）かを調べる
  key codec の表記（`src/key/notation.emel`、サブプロジェクト 2 の計画の Task 3）でも、`<` の中の名前の code point が ASCII の英数字か、Ctrl の付いた文字が ASCII の英大文字かを調べ、名前と修飾の文字を ASCII の小文字にする
- こう書きたかった:
  `wish/key.emel:32`、`:33`、`:40`。Rust の `char::from_u32`、`char::is_control`、`char::is_ascii_punctuation` のつもりで、Int の code point を見る std の module を想定した
  ```emela
  Char(c) if !CodePoint.is_scalar_value(c) -> None
  Char(c) if CodePoint.is_control(c) -> { ... }
  Char(c) if mods.shift && (c >= 'A' && c <= 'Z' || CodePoint.is_ascii_punctuation(c)) -> ...
  ```
  表記（`wish/notation.emel:84`、`:94`、`:124`、`:135`）: Int の method として `c.to_ascii_lowercase()`、`c.is_ascii_alphanumeric()`、`c.is_ascii_uppercase()`（Rust の `u8` と `char` の同じ名前の method のつもり。String には `String.to_ascii_lowercase` がある）
- 診断:
  wish check（v0.28.2）では、`=` で書いた関数の本体（020）の中にあり、読まれなかった
  repo の外の使い捨ての Pome での最小の形（3 つを `&&` でつないだ式、2026-11-27）で、`CodePoint` の 3 か所に ``error[E0211]: cannot find module or trait `CodePoint` in this scope``。std にそういう module は無い。`[api.string]` が code point を扱うのは `code_points` と `from_code_point` だけ
  表記の wish check（v0.28.2）では、`:84`、`:94`、`:135` に ``error[E0313]: type `Int` has no field or function `to_ascii_lowercase` `` と、同じ形の `is_ascii_alphanumeric`、`is_ascii_uppercase` のもの。続く `:85` には ``error[E0301]: type mismatch: expected `Option[Modifier]`, found `Int` ``（match の腕が char literal（013）で崩れた後追い）。`:124` は `let`（004）の右辺の match の中にあり、届かなかった
- 回避策:
  private な関数 3 つを書いた（`src/key.emel` の `is_scalar_value`、`is_control`、`is_ascii_punctuation`、`FRICTION(039)` の印）
  - scalar value は `String.from_code_point(c)` の `None` でも分かるが、確かめるためだけに String を 1 つ作る変換になるので、範囲を直に書いた（`[api.string]` の定義と同じ、0〜0x10FFFF で 0xD800〜0xDFFF を除く）
  - ASCII の記号は Rust の定義の 4 つの範囲を 16 進で書いた（013）
  表記（Task 3）: private な関数 3 つを書いた（`src/key/notation.emel` の `is_ascii_uppercase`、`is_ascii_alphanumeric`、`to_ascii_lowercase`、`FRICTION(039)` の印）。key の 3 つは private で別の module から呼べず、同じ判定は無いので、新しく書いた。小文字にするのは String の `String.to_ascii_lowercase` と同じく A〜Z だけ。名前は String にしたあと `String.to_ascii_lowercase` でも小文字にできるが、修飾の 1 文字と Ctrl の付いた文字は code point のまま扱うので、code point の関数にそろえた
- コスト:
  補助関数 3 つ（15 行ほど）。std の定義と範囲を写すので、std とずれても気づけない。普段のコードに基盤レベルは漏れていない
  表記: 補助関数 3 つ（コメントを含めて 15 行ほど）。`is_ascii_uppercase` は key の `key` の中の範囲の判定（`c >= 0x41 && c <= 0x5A`）と同じものを、別の module にもう 1 つ書いた
  std も同じ所で、同じ形の private な関数を書いている: v0.28.2 の `std/json.emel` の `is_digit`、`std/http.emel` の `is_token`（checkout の main では `std/duration.emel` と `std/instant.emel` にも `is_digit`）。kbdcast でも regex の parser が `is_ascii_letter` と `is_decimal_digit` を（`regex/src/syntax.emel`）、text のテストが scalar value の範囲を（`text/test/text_test.emel` の `scalar_value`）手で書いた
- spec: `[api.string]`、`[lex.literal]`（「There is no character type (Char)」）、`[target.string]`
- 既存: emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「is_ascii」「scalar value」「code point」を検索。当たったのは code point の組み込み関数を足した #134、`Duration.parse` の #846、`Instant.parse` の #801 で、述語を足すものではない）。013（code point の literal）、003（scalar value から String を作る）と同じく、Char の型を持たないと決めた（`spec/open-questions.md` の 11）後に残った隙間
- 行き先: 前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。Int の code point を見る述語（`is_scalar_value`、ASCII の分類、制御文字）を std に置く。使い道は kbdcast の key と regex の parser、std の json と http と duration。未提出。出すのは user

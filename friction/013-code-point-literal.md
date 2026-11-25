# 013 code-point-literal

- 状態: open
- Emela: v0.28.2
- 意図: regex の parser（`regex/src/syntax.emel`）で、pattern の code point（`String.code_points` の `List[Int]`）を `(`、`\`、`d` などの文字と比べる。list のパターンで、続く何文字かを一度に見る（`\` の次が `d`、など）
- こう書きたかった:
  `wish/syntax.emel` の全体（`:59-60`、`:109-121`、`:191-192`、`:269-297`、`:343-346` など）。文字の literal を、その code point の Int として書く（Go の rune literal、Rust の `b'('` や `'(' as u32` のつもり）
  ```emela
  (Some('\\'), Some('b')) -> (Assert(WordBoundary), advance(s, 2))
  Some(c) if c >= '0' && c <= '9' -> ...
  ```
  regex の class（`wish/class.emel:36`、`:40`、`:59`、計画の Task 5）でも、`\d` と `\w` と行末の文字の範囲を `Span('0', '9')`、`Span('a', 'z')`、`Span('\n', '\n')` などと書いた
  regex の vm（`wish/vm.emel:149`、計画の Task 6）でも、行末の文字を `c == '\n' or c == '\r' or c == '\u{2028}' or c == '\u{2029}'` と書いた
- 診断:
  wish check（v0.28.2）の 780 の診断のうち、`'` の ``error[E0105]: unrecognized character `\'` `` が 212、literal の中身の `\\`、`^`、`$`、`?` の E0105 が 31。続けて、崩れた式とパターンの後追いの E0110（``expected `)` ``、``expected `->` ``）、E0112、E0113、E0118、E0122、E0309（``pattern `Some` has 1 fields, found 0``）、W0301 が出る。repo の外の使い捨ての Pome での最小の形（`c == '('`）は、E0105 が 2 つ、E0118、E0122 の 4 つ（2026-11-25）。help は付かない。表示の `` `\'` `` は `'` を escape した形で、受け付けなかった文字そのものではない
  class の wish check（v0.28.2）では、86 の診断のうち 32 が E0105（`'` が 28、`'\n'` と `'\r'` の中身の `\` が 4）。続けて E0118、E0110、E0122 と、引数が読めなかった後追いの ``error[E0305]: wrong number of arguments: `range` takes 2, found 0`` と同じ形の `Span` のものが出た
  vm の wish check（v0.28.2）では、`:149` の 1 行に `'` の E0105 が 8、`\` の E0105 が 4、続けて E0118 と E0122
- 回避策:
  parser が見る文字ごとに `const` で名前を付けた（`regex/src/syntax.emel` の `EXCLAMATION` から `CLOSE_BRACE` までの 51 個、`FRICTION(013)` の印）。パターンには const を書ける（`[BACKSLASH, SMALL_D, ..]`。右辺が literal だけなので、網羅性の判定でも値として扱われる、`[data.const]`）。`\f` の 0x0C のように値そのものが意味の所は、16 進の literal のまま書いた
  std と x も同じ所で回り道をしている:
  - x の `base64/src/lib.emel`: `const PAD: Int = 0x3D`
  - std の `Std.Bytes.hex_value` と `Std.Http.is_token`: `0x30`、`0x61`、`0x41` などを素の 16 進で書く
  - std の `Std.Json`: code point を 1 文字の String にしてから（`s.code_points().filter_map(String.from_code_point)`）string の literal のパターンで比べ、数に戻すのに `c.code_points().fold(0, |_, p| p)` を書く
  class（`regex/src/class.emel` の `DIGIT`、`ASCII_WORD`、`LINE_TERMINATOR`、`FRICTION(013)` の印）: 範囲の表なので const の名前は付けず、16 進の literal に文字を書いた行末のコメントを添えた（`Span(0x41, 0x5A), # A-Z`）。`regex/test/class_test.emel` も同じ書き方（`regex/test/fold_test.emel` と同じく印は付けない）
  vm（`regex/src/vm.emel` の `is_line_terminator`、`FRICTION(013)` の印）: `c == 0x0A || c == 0x0D || c == 0x2028 || c == 0x2029 # \n \r LS PS`。`Class` の `LINE_TERMINATOR` は private なので、同じ 4 つを書き直した。`regex/test/linear_test.emel` も同じ書き方（`Array.repeat(0x61, n) # a`。`class_test` と `fold_test` と同じく印は付けない）
- コスト:
  const の宣言が 51 行（ファイルの 570 行のうち）。読むときに名前と文字を対応させる必要がある。const の名前は大文字、数字、`_` だけ（`[lex.name]`）なので、`d` と `D` は `SMALL_D` と `CAPITAL_D` に書き分けた。性能のコストは無い。普段のコードに基盤レベルは漏れていない
  class では、9 つの文字を 16 進で書き、行末のコメントで文字を示した（7 行）
  vm では 4 つの文字を 16 進で書き、行末のコメントで文字を示した（1 行）
- spec:
  `[lex.literal]`（「There is no character type (Char). A single character is represented as a String of length 1 (16.2).」）、`[target.string]`、`[data.const]`、`[lex.name]`、`spec/diagnostics.md` の E0105
- 既存:
  `spec/open-questions.md` の 11（「A character type, bitwise operations, hexadecimal literals, and the list of string escapes」、2026-10-10 に「no Char」と決まった）と `spec/history.md:585`。決まったのは Char の型を持たないことで、Int の code point を書く literal には触れていない。emela の issue と PR に無い（2026-11-25 に取得した issue と PR の 864 件を、「char literal」「character literal」「code point literal」「文字リテラル」で検索）
- 行き先:
  前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。型を増やさずに、code point の Int を書く literal を足す形（Go の rune literal、Zig の `'a'` が comptime_int になる形）なら、Char を持たない決定と両立する。使い道は、regex の parser、x の base64、std の json、bytes、http。未提出。出すのは user

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
  key codec の型（`wish/key.emel:38-41`、`:48`、サブプロジェクト 2 の計画の Task 2）でも、Shift で英小文字を大文字にする所を `c >= 'a' && c <= 'z'`、`c - 'a' + 'A'`、`c >= 'A' && c <= 'Z'` と、制御文字 0x00 の代表の空白を `Char(' ')` と書いた
  key codec の表記（`wish/notation.emel` の 16 行、`:26`、`:30`、`:45`、`:49`、`:59`、`:61`、`:72`、`:85-88`、`:113-114`、`:134`、`:151-152`、サブプロジェクト 2 の計画の Task 3）でも、`<`、`>`、`-`、空白と修飾の文字（`'c'`、`'m'`、`'a'`、`'s'`、`'d'`）を、list のパターン（`['<', ..rest]`、`[m, '-', ..rest]`）と比べる式と `Char(' ')` に書いた
  key codec の decode（`wish/decode.emel` の 25 行、`:19-20`、`:40-41`、`:49-50`、`:85`、`:98-106`、`:114`、`:129-134`、`:139`、`:144`、サブプロジェクト 2 の計画の Task 4）でも、CSI と SS3 の列の文字（`[`、`O`、`~`、`u`、`;`、`A`〜`D`、`H`、`F`、`P`〜`S`、`Z`）と貼り付けの印（`[0x1b, '[', '2', '0', '0', '~']`）を、list のパターン（`[0x1b, '[', ..rest]`、`['O', c, ..]`）、match の腕（`'A' -> Up`）と引き算（`f - 'P' + 1`）に書いた
  key codec の encode（`wish/encode.emel:87`、`:99-107`、`:196`、サブプロジェクト 2 の計画の Task 6）でも、Ctrl の付いた英大文字の判定（`'A' <= c && c <= 'Z'`）、termwiz の `ctrl_mapping` の表（`'@' | '`' | ' ' | '2' -> Some(0x00)`、`'a'..='z' -> Some(c - 'a' + 1)` など 9 つの腕）、ASCII の印字できる記号と英数字の範囲（`'!' <= c && c <= '~'`）を文字の literal で書いた
  ストリーム用の UTF-8 デコーダ（`wish/utf8.emel:15`、サブプロジェクト 3 の計画の Task 1）でも、置き換え文字を `let replacement: Char = '\u{FFFD}'` と文字の literal で書いた。ここは code point の Int ではなく、`Char` の型の値のつもり（Rust の `char::REPLACEMENT_CHARACTER`。`Char` の型が無いことは 003）
  VT の解釈（`wish/terminal.emel:82-139`、`:160-171`、サブプロジェクト 3 の計画の Task 5）でも、avt 0.18.0 の `csi_dispatch` と `esc_dispatch` を写し、CSI の終わりの文字（`'@'`、`'A'`〜`'Z'` の 19、`` '`' ``、`'a'`〜`'u'` の 14）、private の印と中間の文字（`'!'`、`'?'`、`'>'`）、ESC の中間の文字と終わりの文字（`'#'`、`'('`、`')'`、`'D'`、`'E'`、`'H'`、`'M'`、`'7'`、`'8'`、`'c'`、`'0'`）を、組のパターンの文字の literal で書いた（`(None, 'A') => ...`、`(Some('?'), 'h') => ...`、`(Some('('), '0') => ...`）。引数の型も `Option[Char]` と `Char` にした（003）
- 診断:
  wish check（v0.28.2）の 780 の診断のうち、`'` の ``error[E0105]: unrecognized character `\'` `` が 212、literal の中身の `\\`、`^`、`$`、`?` の E0105 が 31。続けて、崩れた式とパターンの後追いの E0110（``expected `)` ``、``expected `->` ``）、E0112、E0113、E0118、E0122、E0309（``pattern `Some` has 1 fields, found 0``）、W0301 が出る。repo の外の使い捨ての Pome での最小の形（`c == '('`）は、E0105 が 2 つ、E0118、E0122 の 4 つ（2026-11-25）。help は付かない。表示の `` `\'` `` は `'` を escape した形で、受け付けなかった文字そのものではない
  class の wish check（v0.28.2）では、86 の診断のうち 32 が E0105（`'` が 28、`'\n'` と `'\r'` の中身の `\` が 4）。続けて E0118、E0110、E0122 と、引数が読めなかった後追いの ``error[E0305]: wrong number of arguments: `range` takes 2, found 0`` と同じ形の `Span` のものが出た
  vm の wish check（v0.28.2）では、`:149` の 1 行に `'` の E0105 が 8、`\` の E0105 が 4、続けて E0118 と E0122
  key の wish check（v0.28.2）では、42 の診断のうち 14 が `'` の E0105（`:38`、`:39`、`:40` に 4 つずつ、`:48` に 2 つ）
  表記の wish check（v0.28.2）では、260 の診断のうち 36 が `'` の E0105（16 行のすべて）。続けて、崩れたパターンの後追いの E0113、E0110、E0118、E0122、``error[E0309]: pattern `Char` has 1 fields, found 0``（`:151-152`）、W0301、`'m'` などの中身を名前と読んだ ``error[E0211]: cannot find value `m` in this scope``（`:86-88` の `m`、`s`、`d`）
  decode の wish check（v0.28.2）では、318 の診断（brix の W0203 を除く）のうち 126 が E0105（`'` が 120、literal の中身の `~` が 5、`;` が 1）。続けて、崩れたパターンの後追いの E0113、E0110、E0118、E0122、W0301（`:130-134` と `:145`）と、`'A'` などの中身を名前と読んだ ``error[E0211]: cannot find value `A` in this scope``（`A`、`B`、`C`、`D`、`H`、`F`、`P`）
  encode の wish check（v0.28.2）では、295 の error（ほかに W0301 などの warning が 28）のうち 69 が E0105（`'` が 62、literal の中身の `~` と `\\` が 2 つずつ、`` ` ``、`^`、`?` が 1 つずつ）。続けて、崩れたパターンの後追いの E0113、E0110（``expected `->` ``、``expected `]` ``）、E0118、E0122、``error[E0123]: `_` can only be used in patterns``（`'_'` の中身）、``error[E0211]: cannot find value `A` in this scope``（`'A'` の中身）、``E0301: type mismatch: expected `Option[Int]`, found `List[?0]` ``（`'['` の中身を List と読んだ）と、本体が読めなかった `is_ascii_graphic` の ``E0301: type mismatch: expected `Bool`, found `()` ``
  UTF-8 デコーダの wish check（v0.28.2）では、`:15` の 1 行に `'` の E0105 が 2 と、literal の中身の `\` の E0105 が 1。同じ行の `let`（004）と `Char`（003）には届かなかった
  VT の解釈の wish check（v0.28.2）では、632 の診断（brix の W0203 を除く）のうち 116 が E0105（`'` が 113、`'?'` の中身の `?` が 2、`` '`' `` の中身の `` ` `` が 1。`:82-139` と `:160-171` の 51 行）。続けて、崩れた組のパターンの後追いの ``E0110: expected `)` ``、``E0110: expected `->` ``、E0113、E0118、E0122、``E0112: a tuple pattern needs at least two elements``（`(Some('!'), 'p')` などの 5 つ）、``E0309: pattern `Some` has 1 fields, found 0``（5）、``E0305: wrong number of arguments: `Some` takes 1, found 0``（1）、腕ごとの ``E0301: type mismatch: expected `(Option[{unknown}], {unknown})`, found `(?0)` ``、`'A'` などの中身を名前と読んだ ``E0211: cannot find value `A` in this scope``（35）が出た。``W0301: unreachable match arm`` も 42（CSI の 2 つ目から後の腕のすべてと、ESC の `(None, 'E')` から `(Some('#'), '8')` まで）。help は付かない
- 回避策:
  parser が見る文字ごとに `const` で名前を付けた（`regex/src/syntax.emel` の `EXCLAMATION` から `CLOSE_BRACE` までの 51 個、`FRICTION(013)` の印）。パターンには const を書ける（`[BACKSLASH, SMALL_D, ..]`。右辺が literal だけなので、網羅性の判定でも値として扱われる、`[data.const]`）。`\f` の 0x0C のように値そのものが意味の所は、16 進の literal のまま書いた
  std と x も同じ所で回り道をしている:
  - x の `base64/src/lib.emel`: `const PAD: Int = 0x3D`
  - std の `Std.Bytes.hex_value` と `Std.Http.is_token`: `0x30`、`0x61`、`0x41` などを素の 16 進で書く
  - std の `Std.Json`: code point を 1 文字の String にしてから（`s.code_points().filter_map(String.from_code_point)`）string の literal のパターンで比べ、数に戻すのに `c.code_points().fold(0, |_, p| p)` を書く
  class（`regex/src/class.emel` の `DIGIT`、`ASCII_WORD`、`LINE_TERMINATOR`、`FRICTION(013)` の印）: 範囲の表なので const の名前は付けず、16 進の literal に文字を書いた行末のコメントを添えた（`Span(0x41, 0x5A), # A-Z`）。`regex/test/class_test.emel` も同じ書き方（`regex/test/fold_test.emel` と同じく印は付けない）
  vm（`regex/src/vm.emel` の `is_line_terminator`、`FRICTION(013)` の印）: `c == 0x0A || c == 0x0D || c == 0x2028 || c == 0x2029 # \n \r LS PS`。`Class` の `LINE_TERMINATOR` は private なので、同じ 4 つを書き直した。`regex/test/linear_test.emel` も同じ書き方（`Array.repeat(0x61, n) # a`。`class_test` と `fold_test` と同じく印は付けない）
  key（`src/key.emel` の `key`、`representative`、`is_ascii_punctuation`、`FRICTION(013)` の印）: 16 進の literal にし、直前か行末のコメントで文字を示した（`c >= 0x61 && c <= 0x7A`、`Char(c - 0x20)`、`(c >= 0x21 && c <= 0x2F) # ! to /`）。`'a' - 'A'` の差は `0x20` と書いた。`test/key_test.emel` の表も同じ書き方（`class_test` と同じく印は付けない）
  表記（`src/key/notation.emel`、`FRICTION(013)` の印）: パターンに書く文字は regex と同じく const にした（`LESS_THAN`、`GREATER_THAN`、`HYPHEN`、`SPACE`、`SMALL_C` などの 13 個。`[LESS_THAN, ..rest]`、`[c, HYPHEN, ..rest]`、`[SMALL_F, DIGIT_ONE, d]`、`Char(SPACE)`）。範囲の判定（`is_ascii_uppercase`、`is_ascii_alphanumeric`）と小文字への変換（`to_ascii_lowercase` で `0x20` を足す）は、key と同じく 16 進の literal にし、直前か行末のコメントで文字を示した。テストの生成器（`test/key_gen.emel` の `codes`、`FRICTION(013)` の印）は、生成する文字を `List.range(0x20, 0x7F)`、`[0xE9, 0x3042, 0x1F600]` などと 16 進で書いた
  decode（`src/key/decode.emel`、`FRICTION(013)` の印）: 表記と同じく、パターンと match の腕に書く byte を const にした（`ESC`、`LEFT_BRACKET`、`CAPITAL_O`、`TILDE`、`SMALL_U`、`CAPITAL_A` などの 18 個。`[ESC, LEFT_BRACKET, ..rest]`、`[CR, LF, ..]`、`CAPITAL_A -> Some(Up)`）。貼り付けの印は `Bytes.hex("1b5b3230307e")` の const にし、直前のコメントで `CSI 200~` と示した。ECMA-48 の byte の範囲（0x30〜0x3F など）は、規格が 16 進で決めているので 16 進のまま書いた
  encode（`src/key/encode.emel`、`FRICTION(013)` の印）: `ctrl_mapping` の腕は 16 進の literal にし、行末のコメントで文字を示した（`0x32 -> Some(0x00) # 2`）。英字と記号の範囲（`@` から `~`）は 1 つの guard にまとめた（038）。範囲の判定の `is_ascii_graphic` と `is_ascii_uppercase`（039）も、16 進の literal と行末のコメントにした（`c >= 0x21 && c <= 0x7E # ! to ~`）。列の始まりの ESC、CSI、SS3 は、文字の literal の問題ではないので印を付けず、String の const（`"\u{1b}["`）にした
  UTF-8 デコーダ（`src/utf8.emel`）: 出すのは String なので、1 文字の String の const にした（`const REPLACEMENT: String = "\u{FFFD}"`）。`[lex.literal]` のとおりの書き方で、回り道ではないので印は付けない
  VT の解釈（`src/vt/terminal.emel` の `csi` と `esc`、`FRICTION(013)` の印 2 か所）: encode と同じく、腕の文字を 16 進の literal にし、行末のコメントで文字と avt の関数の名前を示した（`(None, 0x41) -> (cursor_up(t, n), []) # A CUU`、`(Some(0x3F), 0x68) -> ... # ? h DECSET`）。CSI の終わりの文字の 35 と、private の印と中間の文字の 6 つは const にしなかった（腕ごとに 1 回しか出ず、行末のコメントで足りる）。avt が ESC の後の `@`〜`_` を C1 にする所は、wish の 4 つの腕でなく avt と同じ 1 つの guard（`(None, _) if f >= 0x40 && f <= 0x5F -> execute(t, f + 0x40)`）にした。DEC の罫線の表は、avt の `SPECIAL_GFX_CHARS` の 31 文字を string の literal に書いて `code_points()` で Array にした（`const DRAWING`）
- コスト:
  const の宣言が 51 行（ファイルの 570 行のうち）。読むときに名前と文字を対応させる必要がある。const の名前は大文字、数字、`_` だけ（`[lex.name]`）なので、`d` と `D` は `SMALL_D` と `CAPITAL_D` に書き分けた。性能のコストは無い。普段のコードに基盤レベルは漏れていない
  class では、9 つの文字を 16 進で書き、行末のコメントで文字を示した（7 行）
  vm では 4 つの文字を 16 進で書き、行末のコメントで文字を示した（1 行）
  key では、5 つの文字（`a`、`z`、`A`、`Z`、空白）と、記号の 4 つの範囲の端の 8 つを 16 進で書き、コメントで文字を示した（コメントだけの行が 5 行、行末のコメントが 5 つ）
  表記では、const の宣言が 13 行（ファイルの約 320 行のうち）。const の名前は大文字だけなので、`c` は `SMALL_C`、`<` は `LESS_THAN` と書く
  decode では、const の宣言が 18 行（ファイルの約 350 行のうち）。`P` から `S` を F1〜F4 にする所は、`f - 'P' + 1` の引き算でなく、4 つの腕に分けた（015）
  encode では、10 の腕と 2 つの範囲の判定の文字を 16 進で書き、行末のコメントで文字を示した（行末のコメントが 12）
  VT の解釈では、CSI の 39 の腕と ESC の 9 つの腕の文字を 16 進で書き、文字はコメントで示した（CSI の腕の行末か直前の行のコメントが 39、ESC の行末のコメントが 8）。読むときは、`0x48` が `H` であることをコメントで見る
- spec:
  `[lex.literal]`（「There is no character type (Char). A single character is represented as a String of length 1 (16.2).」）、`[target.string]`、`[data.const]`、`[lex.name]`、`spec/diagnostics.md` の E0105
- 既存:
  `spec/open-questions.md` の 11（「A character type, bitwise operations, hexadecimal literals, and the list of string escapes」、2026-10-10 に「no Char」と決まった）と `spec/history.md:585`。決まったのは Char の型を持たないことで、Int の code point を書く literal には触れていない。emela の issue と PR に無い（2026-11-25 に取得した issue と PR の 864 件を、「char literal」「character literal」「code point literal」「文字リテラル」で検索）
- 行き先:
  前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。型を増やさずに、code point の Int を書く literal を足す形（Go の rune literal、Zig の `'a'` が comptime_int になる形）なら、Char を持たない決定と両立する。使い道は、regex の parser、x の base64、std の json、bytes、http。未提出。出すのは user

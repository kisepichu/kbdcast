# 004 let-binding

- 状態: open
- Emela: v0.28.2
- 意図: `text` の wish（`wish/text.emel` の `slice`）で、関数の中の途中の値に名前を付ける
- こう書きたかった:
  `wish/text.emel:39-42` の 4 行。他の言語（Rust、Swift、OCaml、JavaScript など）の癖で `let` を書いた
  ```emela
  let cps = String.code_points(s)
  let len = List.length(cps)
  let start = Int.clamp(from, 0, len)
  let stop = Int.clamp(to, start, len)
  ```
  key codec の型の wish（`wish/key.emel:35`、サブプロジェクト 2 の計画の Task 2）でも、組を束ねる `let (rep, rep_mods) = control_representative(c)` を書いた
  key codec の表記の wish（`wish/notation.emel`、サブプロジェクト 2 の計画の Task 3）でも、12 行に `let` を書いた（`:43-44`、`:47`、`:59`、`:74`、`:122-123`、`:132`、`:142-145`）
  key codec の decode の wish（`wish/decode.emel`、サブプロジェクト 2 の計画の Task 4）でも、8 行に `let` を書いた（`:31`、`:56`、`:83-85`、`:96-97`、`:119`）
  key codec の golden の補助の wish（`wish/golden.emel`、サブプロジェクト 2 の計画の Task 5）でも、2 行に `let` を書いた（`:8`、`:9`）
  key codec の encode の wish（`wish/encode.emel`、サブプロジェクト 2 の計画の Task 6）でも、4 行に `let` を書いた（`:32`、`:45`、`:113`、`:174`）
  ストリーム用の UTF-8 デコーダの wish（`wish/utf8.emel`、サブプロジェクト 3 の計画の Task 1）でも、関数の中の 4 行に `let` を書いた（`:53-54`、`:64`、`:75`。`:64` と `:75` は `let (d, out) = acc` のように組を分ける形）。module の直下の定数にも `let replacement: Char = '\u{FFFD}'`（`:15`。Rust の `const`、OCaml と F# の top-level の `let` のつもり）と書いた
  幅の wish（`wish/width.emel`、サブプロジェクト 3 の計画の Task 2）でも、`is_wide` の中の 1 行に `let n = WIDE_FIRST.partition_point(...)` と書いた（`:11`）
  VT の parser の wish（`wish/parser.emel`、サブプロジェクト 3 の計画の Task 3）でも、3 行に `let` を書いた（`:52`、`:53`、`:68`。`:52` と `:53` は `let (last, text, acts) = ...` のように組を分ける形）
  VT の画面の wish（`wish/screen.emel`、サブプロジェクト 3 の計画の Task 4）でも、21 行に `let` を書いた（`:81-85`、`:87`、`:90`、`:113-114`、`:123-124`、`:126`、`:131`、`:141`、`:143-145`、`:168-169`、`:175-176`。`:123-124`、`:141`、`:168`、`:175` は引数と同じ名前で束ね直す `let n = min(n, ...)`）
  VT の解釈の wish（`wish/terminal.emel`、サブプロジェクト 3 の計画の Task 5）でも、7 行に `let` を書いた（`:80`、`:146`、`:192`、`:227-229`、`:232`。`:146` は右辺が前置の match の `let level = match n.and_then(List.first) { ... }`）
  tape のパーサの wish（`wish/tape.emel`、サブプロジェクト 1 の計画の Task 1）でも、21 行に `let` を書いた（`:27-29`、`:38`、`:47-49`、`:58`、`:64-65`、`:80`、`:83`、`:98-99`、`:111-112`、`:128-129`、`:140`、`:148`、`:159`。`:64`、`:80`、`:83` は `let (name, arg) = ...` のように組を分ける形、`:65`、`:99`、`:112`、`:159` は右辺が closure の `let here = fn(message) { ... }`）
  cast の writer の wish（`wish/cast.emel`、サブプロジェクト 1 の計画の Task 2）でも、3 行に `let` を書いた（`:8`、`:17`、`:23`）
  BunPty の wish（`wish/pty_bun.emel`、サブプロジェクト 1 の計画の Task 3）でも、3 行に `let` を書いた（`:38`、`:39`、`:51`）
- 診断:
  wish check（emela 0.28.2、`wish/text.emel:52-155`）。`let` の行ごとに 2 つ出る:
  - `let` に ``error[E0118]: expected expression``
  - 名前（`cps` など）に ``error[E0122]: expected newline or `}` after statement``

  4 行で 8 つ。そのあと、束縛されなかった名前を使う `wish/text.emel:43` に ``error[E0211]: cannot find value `cps` in this scope`` と同じ形のものが 4 つ（`cps`、`start`、`stop`、`start`）続く。wish check の 14 の診断のうち 12 がこの 1 つの誤りから出ている。どれにも help も note も付かず、「Emela に `let` は無い、`x = value` と書く」とは言わない

  regex の wish（`wish/syntax.emel`、計画の Task 4）でも、31 行に `let` を書いた。`let` を指す E0118 が 20（残りは同じ行の他の構文エラーに埋もれた）、束縛されなかった名前の E0211 が 20 以上（`s1` が 9、`open` が 4 など）。char literal の診断（013）と混ざり、780 の診断の中で `let` が原因のものを見分けにくかった

  regex の class の wish（`wish/class.emel`、計画の Task 5）でも、11 行に `let` を書いた（`:40`、`:68-70`、`:104-105`、`:115`、`:118`、`:121-123`）。診断が届いたのは `:40` と `:68-70` の 4 行で、1 行ごとに E0118 と E0122 が 1 つずつ（8 つ）と、束縛されなかった名前の E0211 が 4（`ascii` が 2、`kept`、`folded`）。残りの 7 行は、`=` で書いた関数の本体（020）の中にあり、本体ごと読まれなかった

  regex の vm と公開 API の wish（`wish/vm.emel`、`wish/lib.emel`、計画の Task 6）でも `let` を書いた。vm は 9 行（`:75`、`:79`、`:105-108`、`:131`、`:155`、`:161`）で、診断が届いた 5 行に E0118 と E0122 が 1 つずつ（10）。残りの 4 行（`:105-108`）は `=>` の腕（E0110）の中で読まれなかった。lib は 2 行（`:24`、`:38`）に 4 つ。束縛されなかった名前の E0211 が 4 続いた（`next`、`groups`、`ast`、`input`）

  regex の差分テストの生成器の wish（`wish/pattern_gen.emel`、計画の Task 8）でも、10 行に `let` を書いた（`:69`、`:104`、`:108-109`、`:113-114`、`:118`、`:122`、`:126` と、`wish/differential.emel:29`）。届いた行ごとに E0118 と E0122 が 1 つずつ。束縛されなかった名前の E0211 が続いた（`sub` が 6、`atom`、`a`）。`:114` の行では、or-pattern（015）の診断が `let` の 2 つに埋もれた（字句の誤りの `;` の E0105 だけは出た、016）

  key の wish（Task 2）では、`let` の行は `=` で書いた関数の本体（020）の中にあり、本体ごと読まれなかった（診断は 0）

  表記の wish（Task 3）では、届いた 9 行（`:43-44`、`:122-123`、`:132`、`:142-145`）に E0118 と E0122 が 1 つずつ（18）。束縛されなかった名前の E0211 が 6 続いた（`shape`、`mods` が 2、`m` が 3）。残りの 3 行（`:47`、`:59`、`:74`）は前置の match（E0142）の腕の中にあり、届かなかった

  decode の wish（Task 4）では、届いた 7 行に E0118 と E0122 が 1 つずつ（14）。束縛されなかった名前の E0211 が 7 続いた（`bits` が 3、`d`、`more`、`code`、`mods`）。残りの 1 行（`:56`）は前置の match（E0142）の腕の中にあり、届かなかった

  golden の補助の wish（Task 5）では、2 行に E0118 と E0122 が 1 つずつ（4）。束縛されなかった名前の E0211 が 2 続いた（`code`、`mods`）。`:9` の `let` の右辺の前置の match の腕（`:10-25`）は読まれず、E0142 も、腕の中の 016、040、047 の誤りの診断も出なかった。11 の診断のうち 6 がこの 1 つの誤りから出ている

  encode の wish（Task 6）では、届いた 3 行（`:32`、`:45`、`:113`）に E0118 と E0122 が 1 つずつ（6）。束縛されなかった名前の E0211 が 19 続いた（`m` が 17、`higher`、`cr`）。`m` は修飾で、キーの種類ごとの規則のどの腕でも使うので、1 行の `let m = key.mods` が 19 の診断になった。残りの 1 行（`:174`）は、範囲パターン（038）で崩れた腕の中にあり、届かなかった

  UTF-8 デコーダの wish（Task 1）では、関数の中の 4 行に E0118 と E0122 が 1 つずつ（8）。束縛されなかった名前の E0211 が 5 続いた（`seen`、`code_point`、`d`、`next`、`out`）。module の直下の `:15` には、同じ行の char literal（013）の E0105 しか出なかった。repo の外の使い捨ての Pome での最小の形（`let replacement: String = "x"` と、それを返す関数、2026-11-27）では、`let` を指す ``error[E0126]: expected declaration`` と、使う所の ``error[E0211]: cannot find value `replacement` in this scope`` の 2 つ。help は付かず、`const` を示さない

  幅の wish（Task 2）では、`:11` の 1 行に E0118 と E0122 が 1 つずつ（2）。束縛されなかった名前の E0211 が 1 続いた（`n`）。同じ行の右辺の式の `fn(first) { ... }`（E0148）には届かず、次の行の添字（009）は E0122 の 1 つになった。6 の診断のうち 3 がこの 1 つの誤りから出ている

  VT の parser の wish（Task 3）では、届いた 2 行（`:52`、`:68`）に E0118 と E0122 が 1 つずつ（4）。束縛されなかった名前の E0211 が 4 続いた（`last`、`text`、`acts`、`k`）。`:52` の右辺の `fold` の closure（`:52-59`）は読まれず、その中の `:53` の `let`、前置の match（E0142）、`=>` の腕、String の `+`、`String.from_code_point` を String として使う所（003）には、どれも届かなかった

  VT の画面の wish（Task 4）では、21 行すべてに E0118 と E0122 が 1 つずつ（42）。束縛されなかった名前の E0211 が 4 続いた（`written`、`l2` が 2、`l3`）と、束縛されなかった `l2.get(to)` の腕の guard の ``error[E0314]: the type of this value must be known to access field `occupancy` ``。112 の診断のうち 47 がこの 1 つの誤りから出ている。右辺の `fill_range` と `rotate_right`、`rotate_left`（057）、`l1[..col]` と `++`（016）、`min`（016）には届かなかった

  VT の解釈の wish（Task 5）では、届いた 6 行に E0118 と E0122 が 1 つずつ（12）。束縛されなかった名前の E0211 が 2 続いた（`level`、`printed`）。632 の診断のうち 14 がこの 1 つの誤りから出ている。`:232` は前置の match の `=>` の腕の中にあり、届かなかった。`:146` の右辺の前置の match の腕（`:147-150`）も読まれず、その中の or-pattern（015）と `List.first`（016）には届かなかった

  VT の公開 API の wish（Task 6）では、5 行に `let` を書いた。届いた 4 行（`:27`、`:28`、`:46`、`:57`）に E0118 と E0122 が 1 つずつ（8）。束縛されなかった名前の E0211 が 8 続いた（`parser`、`term`、`replies`、`s` が 2（どちらにも ``help: did you mean `t`?``）、`visible`、`col`、`row`）。49 の診断のうち 16 がこの 1 つの誤りから出ている。`:28` の右辺の `fold` の closure（`:28-31`）は読まれず、その中の `:30` の `let`、`fn((term, replies), a)`（E0148）、List の `++`（016）には届かなかった

  tape のパーサの wish（サブプロジェクト 1 の Task 1）では、21 行すべてに E0118 と E0122 が 1 つずつ（42）。束縛されなかった名前の E0211 が 28 続いた（`here` が 9、`text` が 4、`name` が 3、`arg` と `value` が 2 つずつ、`phase`、`line`、`body`、`cols`、`rows`、`setting`、`column`、`regex`）。253 の診断のうち 70 がこの 1 つの誤りから出ている。`:29` の右辺の `try_fold`（016）と closure、`:47-49` の `strip_suffix`、`??`、`trim_start`、`char_count`（002、059）、`:58` の `take_while`（041）、`:98`、`:111`、`:148` の `trim_end`（059）には届かなかった（`:47` の `??` は字句の E0105 だけが出た）

  cast の writer の wish（サブプロジェクト 1 の Task 2）では、3 行すべてに E0118 と E0122 が 1 つずつ（6）。束縛されなかった名前の E0211 が 1 続いた（`line`）。`cmd` と `frac` は、使う所が `${...}`（033）で補間でなかったので、E0211 も出なかった。8 の診断のうち 7 がこの 1 つの誤りから出ている。右辺の `Json.String`（062）と `pad_start`（060）には届かなかった

  BunPty の wish（サブプロジェクト 1 の Task 3）では、wish check が compiler の panic（063）で何も出さなかった。panic の原因の `fails` だけを消した写しの `emela check`（2026-11-28）では、3 行すべてに E0118 と E0122 が 1 つずつ（6）。束縛されなかった名前の E0211 が 4 続いた（`message` と `bytes` が 2 つずつ）。28 の診断のうち 10 がこの 1 つの誤りから出ている。`:38` の右辺の `argv.to_array()`（016）には届かなかった
- 回避策: `let` を消して `start = Int.max(from, 0)` と書いた（`text/src/lib.emel` の `slice`）。regex の `regex/src/syntax.emel`、`regex/src/class.emel`、`regex/src/vm.emel`、`regex/src/lib.emel`、テストの `regex/test/pattern_gen.emel`、key の `src/key.emel`（`(rep_code, rep_mods) = representative(c)`）、表記の `src/key/notation.emel`、decode の `src/key/decode.emel`、golden の補助の `test/golden.emel` も同じく `let` を消した。正しい構文に直しただけなので、コードに印は付けない
  encode（Task 6、`src/key/encode.emel`）も同じく `let` を消した（`higher = ...`、`m = key.mods()`、`cr = ...`。`:174` の `final` は、F1〜F4 を腕に分けたので（009）束縛が要らなくなった）
  UTF-8 デコーダ（Task 1、`src/utf8.emel`）も同じく `let` を消した（`code_point = ...`、`bytes_seen = ...`、`(next, strings) = read(...)`。`push` の `(d, out) = acc` は、fold を位置で歩く再帰にした（055）ので要らなくなった）。module の直下の定数は `const REPLACEMENT: String = "\u{FFFD}"`（`[data.const]`。名前は大文字）にした
  幅（Task 2、`src/vt/width.emel`）では、`n` の束縛そのものが要らなくなった（std の `lower_bound` を範囲の終わりの表で引き、その位置の始まりを読む 1 つの式にした。031）
  VT の parser（Task 3、`src/vt/parser.emel`）も同じく `let` を消した（`(last, written, done) = ...`、`(next, step) = feed(at, c)`、`k = ...`）
  VT の画面（Task 4、`src/vt/screen.emel`）も同じく `let` を消した（`line = at(s.grid, row)`、`n = Int.min(n, s.col_count - col)` など。引数と同じ名前で束ね直すのは `[fn.block]` のとおり書ける）。wish の `let cut_next = fn(l: Array[Cell]) { ... }` は、局所関数 `fn cut_next(l: Array[Cell]) -> Array[Cell] { ... }`（`[fn.local]`）にした
  VT の解釈（Task 5、`src/vt/terminal.emel`）も同じく `let` を消した（`n = count(ps, 0, 1)`、`level = n match { ... }`、`ch = translate(...)`、`col = t.col + width`）。`:192` の `p = t.pen` は、`sgr` が Terminal でなく Pen を受ける形にしたので要らなくなり、`:228-229` は、`print` を `if t.col >= t.col_count` で先に分ける形にしたので、束縛そのものが変わった
  VT の公開 API（Task 6、`src/vt.emel`）も同じく `let` を消した（`(parser, actions) = ...`、`(term, replies) = ...`、`s = ...`、`(col, row, visible) = ...`）
  tape のパーサ（サブプロジェクト 1 の Task 1、`src/tape.emel`）も同じく `let` を消した（`lines = ...`、`(name, arg) = ...`、`(setting, value) = ...`、`(cols, rows) = size(value)` など）。`here = fn(message) { ... }` の closure は、どの関数も行の一部（`Span`）から error を作るので、top-level の `at(span, message)` にした（回り道ではない）
  cast の writer（サブプロジェクト 1 の Task 2、`src/cast.emel`）では、`header` と `event` の束縛は、literal の中に呼び出しをそのまま書いたので要らなくなり、`interval` は `let` を消した（`millis = ms % 1000`。0 で埋める所は 060）
  BunPty（サブプロジェクト 1 の Task 3、`pty-bun/src/lib.emel`）も同じく `let` を消した（`host = open(...)`、`message = open_error(host)`、`b = read_output(self.host)`）
- コスト:
  コードのコストは無い。直すには spec を引く必要があった。診断から分かるのは `let` が式として読めないことだけで、wish-first（AGENTS.md 規則 1）では spec を読む前に wish を書くので、そのときの手がかりは診断しかない。後に続く 4 つの E0211 は束縛の失敗の後追いで、wish の本当の診断（`String.from_scalars` の E0212、003）を埋もれさせる
- spec:
  `[fn.block]`（「A binding is written `pattern = expr`. There is no declaration keyword.」）、`[kw.future]`（`let` と `var` は将来のための予約語。`spec/language/03-keywords.md:34`）、`spec/diagnostics.md` の E0118、E0122、E0211
- 既存:
  `let` と `var` の専用の診断 E0146（``Emela has no `let`: write `x = value` ``）は、一度 spec に入って取り下げられた。v0.28.2 の `spec/history.md:303`:

  > - 3.3, Appendix A: Withdrew the dedicated diagnostic for `let` and `var` bindings (E0146).

  理由は取り下げた PR #353 の本文にある: 「3.3: `let` と `var` の専用の診断 E0146 を外した．AI 向けの案内は文書と skill で書く（#341）」。実装の PR #347 は「`let x = 1` はこれまでどおり予約語の一般の構文エラーになり，それを確かめるテストを足した」。E0146 の番号は今は `@export` の引数の誤りに使われている。他の言語の書き方に書き換えを示す診断は残っている: E0142（前置の match）、E0144（`impl Trait for Type`）、E0145（`implements`）、E0147（signature の `use`）、E0148（式の `fn(...)`）。emela の issue は E0144〜E0146 を求めた #324（closed）だけ（「let」「E0146」で検索、2026-11-25）
- 行き先:
  自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: E0146 は「AI 向けの案内は文書と skill で書く」として取り下げられたが、spec を読む前に書いたコード（kbdcast は wish-first で、spec を読む前に書く）には文書も skill も届かず、届くのは診断だけだった。4 行の `let` が 12 の診断になり、どれも `x = value` を示さない。E0142 や E0148 と同じように、`let` と `var` に書き換えを示す help を E0118 に付けるか、少なくとも束縛に失敗した名前の E0211 を後に続けないでほしい

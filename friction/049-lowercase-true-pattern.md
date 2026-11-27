# 049 lowercase-true-pattern

- 状態: open
- Emela: v0.28.2
- 意図: key codec の encode（`src/key/encode.emel`、サブプロジェクト 2 の計画の Task 6）で、キーの種類ごとの規則を、修飾（`Mods` の 4 つの Bool の欄）のパターンで分ける。Ctrl が押されていれば、Shift が押されていれば、の腕を書く
- こう書きたかった:
  `wish/encode.emel:72-79`、`:142-144`、`:151-154`。多くの言語の `true` で、構成子のパターンの欄の値を書いた
  ```emela
  (Mods(ctrl: true, ..), On(Two))            -> Some(other_key(8, m))
  (Mods(shift: true, ..), On(Two))           -> Some(other_key(127, m))
  (Off, Mods(ctrl: true, shift: true, ..))   -> Some(alt_prefix(m, b"\e[1;5Z"))
  ```
  VT の画面の wish（`wish/screen.emel:91-100`、サブプロジェクト 3 の計画の Task 4）でも、avt の `Line::print` の 10 の腕を、書く所のセルの占め方、全角か、右に残る列の数の組のパターンで分けるのに、組の欄に `false`（3 つ）と `true`（7 つ）を書いた
  ```emela
  (Single, false, _) => Some(line.set(col, Cell(c, Single, pen)))
  (Single, true, 0) => None
  (Single, true, 1) => Some(line.set(col, head).set(col + 1, tail))
  ```
- 診断:
  式の中の `true` は ``error[E0211]: cannot find value `true` in this scope`` になる（016）が、パターンの中の `true` は変数の名前（`lower_name`）として読まれ、欄をその名前に束ねる。`Mods(ctrl: true, ..)` は、Ctrl が押されていない `Mods` にも当たる
  wish check（v0.28.2）で出たのは、2 つの欄に `true` を書いた `:142` の ``error[E0220]: `true` is bound more than once in the same pattern`` と、全部に当たる腕の下の腕の ``warning[W0301]: unreachable match arm``（backspace の `:152-155` など）だけ。どちらも `True` を示さず、E0220 は 1 つの束縛の名前を 2 回書いたと読める
  repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-27）: `type Mods(ctrl: Bool, alt: Bool)` と、`Mods(ctrl:, alt:) match { Mods(ctrl: true, ..) -> 1 }` だけを腕に持つ関数は、`emela check` が何も出さずに通る。`ctrl_only(False, False) == 1` を確かめるテストも通った。束縛した `true` を使わなくても、未使用の束縛の警告は無い（`spec/diagnostics.md` に、使わない束縛の警告は無い）。腕が 1 つで網羅しているので W0301 も出ない
  VT の画面の wish check（v0.28.2）: `:91-100` には 1 つも届かなかった（112 の error と 1 つの warning のどれも、この 10 行を指さない）。腕は `:90` の `let written = match (line[col].occupancy, wide, right) {` の中にあり、`:90` に出たのは `let`（004）の ``error[E0118]: expected expression``（`let` を指す）と ``error[E0122]: expected newline or `}` after statement``（`written` を指す）だけで、その後ろの前置の `match`（`:90-101`）には何も出なかった。前置の `match` の E0142 も `:90` には出ず、出たのは次の文の `:102`（`match written {`）
  repo の外の使い捨ての Pome での形（v0.28.2、2026-11-27）: wish の 10 の腕の構文だけを直し（後置の `match`、`->`）、`true` と `false` を残すと、`emela check` が出すのは ``warning[W0301]: unreachable match arm`` の 7 つ（`true` の腕すべて）だけ。占め方ごとに `false` の腕が先に来て、その占め方の値を全部取る。エラーは無く、`True` も示さない
- 回避策:
  `True` に直した（`src/key/encode.emel` の `character`、`tab`、`backspace` の `Mods(ctrl: True, ..)` など。wish の `ctrl_char` にあたる `ctrl_character` には、wish でも実装でも `Mods` のパターンは無く、`m.shift` と `m.alt` を読む）。正しい書き方に直しただけなので、コードに印は付けない。golden の表のテスト（`test/golden_test.emel`）が、修飾ごとの腕のずれを 11,904 の組で確かめる
  VT の画面（`src/vt/screen.emel` の `print`）も `True` と `False` に直した。正しい書き方に直しただけなので、コードに印は付けない。画面のテスト（`test/screen_test.emel`）が `print` の 10 の腕を全部通す
- コスト:
  コードのコストは無い。危ういのは、誤りがコンパイルも実行も通ること（033 の `${...}` と同じ形）。encode では、同じ match の下の腕が W0301 になったので気づけたが、腕の順で全部に当たる腕が最後に来れば何も出ない。修飾のような Bool の欄を持つ型の規則は、このパターンで書くのが普通なので、誤りの起きやすさは高い。普段のコードに基盤レベルは漏れていない
  VT の画面でも、Bool を含む組のパターンで同じ誤りが出た（2 つ目の wish）。画面では占め方ごとに `false` の腕が先に来るので、構文だけ直していれば W0301 が 7 つ出て気づけた。wish check の段階では、`let`（004）の構文エラーの後ろにあって何も出なかった
- spec: `[grammar.pattern]`（`pattern = ... | lower_name | ...`、`pat_arg = pattern | lower_name ":" [ pattern ]`）、`[fn.match]`（変数のパターンは何にでも当たる）、`[lex.literal]`（「Boolean values are not literals. They are `True` and `False`」）、`[kw.non-keyword]`（`True` と `False` は Prelude の enum の構成子）、`spec/diagnostics.md` の E0220 と W0301
- 既存: emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「lowercase true」「pattern binding true」「unused binding」「unused variable」を検索。当たったのは「unused binding」の、let で束ねた写しを置き換える最適化の PR #749 だけで、別の話題）。016（式の中の `true` と `false` に E0211 は出るが help が無い）と 033（`${...}` が診断なしに文字のまま残る）が近い
- 行き先: 自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: in a pattern, `true` and `false` are variable names wherever they appear. `Mods(ctrl: true, ..)` binds the field `ctrl` to a variable named `true` and matches every `Mods`, and `(Single, false, _)` binds the second element of the tuple to a variable named `false` and matches every tuple that starts with `Single`, whatever the Bool is. Nothing is reported when such an arm is the last one, and a binding that is never used gets no warning. Two of them in one pattern get E0220 (`` `true` is bound more than once ``), which reads as a duplicated name, not as a wrong literal. A variable pattern named `true` or `false` anywhere in a pattern (a field of a constructor pattern, an element of a tuple or a list, or the whole pattern of an arm) should get a warning with ``= help: the Bool values are `True` and `False` ``. Lowercase `true` and `false` are what most languages write, and a match on a type with Bool fields (modifiers, flags) or on a tuple with a Bool in it (kbdcast's port of avt's `Line::print`) is where they appear

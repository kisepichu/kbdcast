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
- 診断:
  式の中の `true` は ``error[E0211]: cannot find value `true` in this scope`` になる（016）が、パターンの中の `true` は変数の名前（`lower_name`）として読まれ、欄をその名前に束ねる。`Mods(ctrl: true, ..)` は、Ctrl が押されていない `Mods` にも当たる
  wish check（v0.28.2）で出たのは、2 つの欄に `true` を書いた `:142` の ``error[E0220]: `true` is bound more than once in the same pattern`` と、全部に当たる腕の下の腕の ``warning[W0301]: unreachable match arm``（backspace の `:152-155` など）だけ。どちらも `True` を示さず、E0220 は 1 つの束縛の名前を 2 回書いたと読める
  repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-27）: `type Mods(ctrl: Bool, alt: Bool)` と、`Mods(ctrl:, alt:) match { Mods(ctrl: true, ..) -> 1 }` だけを腕に持つ関数は、`emela check` が何も出さずに通る。`ctrl_only(False, False) == 1` を確かめるテストも通った。束縛した `true` を使わなくても、未使用の束縛の警告は無い（`spec/diagnostics.md` に、使わない束縛の警告は無い）。腕が 1 つで網羅しているので W0301 も出ない
- 回避策: `True` に直した（`src/key/encode.emel` の `character`、`ctrl_character`、`tab`、`backspace` の `Mods(ctrl: True, ..)` など）。正しい書き方に直しただけなので、コードに印は付けない。golden の表のテスト（`test/golden_test.emel`）が、修飾ごとの腕のずれを 11,904 の組で確かめる
- コスト: コードのコストは無い。危ういのは、誤りがコンパイルも実行も通ること（033 の `${...}` と同じ形）。encode では、同じ match の下の腕が W0301 になったので気づけたが、腕の順で全部に当たる腕が最後に来れば何も出ない。修飾のような Bool の欄を持つ型の規則は、このパターンで書くのが普通なので、誤りの起きやすさは高い。普段のコードに基盤レベルは漏れていない
- spec: `[grammar.pattern]`（`pattern = ... | lower_name | ...`、`pat_arg = pattern | lower_name ":" [ pattern ]`）、`[fn.match]`（変数のパターンは何にでも当たる）、`[lex.literal]`（「Boolean values are not literals. They are `True` and `False`」）、`[kw.non-keyword]`（`True` と `False` は Prelude の enum の構成子）、`spec/diagnostics.md` の E0220 と W0301
- 既存: emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「lowercase true」「pattern binding true」「unused binding」「unused variable」を検索。当たったのは「unused binding」の、let で束ねた写しを置き換える最適化の PR #749 だけで、別の話題）。016（式の中の `true` と `false` に E0211 は出るが help が無い）と 033（`${...}` が診断なしに文字のまま残る）が近い
- 行き先: 自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: in a pattern, `true` and `false` are variable names, so `Mods(ctrl: true, ..)` binds the field `ctrl` to a variable named `true` and matches every `Mods`. Nothing is reported when it is the last arm, and a binding that is never used gets no warning. Two of them in one pattern get E0220 (`` `true` is bound more than once ``), which reads as a duplicated name, not as a wrong literal. A variable pattern named `true` or `false` should get a warning with ``= help: the Bool values are `True` and `False` ``. Lowercase `true` and `false` are what most languages write, and a match on a type with Bool fields (modifiers, flags) is where they appear

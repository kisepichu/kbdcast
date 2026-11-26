# 054 fmt-empty-call-break

- 状態: open
- Emela: v0.28.2
- 意図: key codec のテストの生成器（`test/key_gen.emel` の `codes`、サブプロジェクト 2 の計画の Task 3）で、文字の code point の List をいくつかつないで平らにし、`Char` に写す。1 行に書くと幅の 100 を超えるので、`emela fmt` に折り返させる
- こう書きたかった:
  wish は無い（テストの生成器）。1 行に書き、fmt が読みやすい所で折り返すと考えた。`[lex.continuation]` の規則 1 で、`.` で始まる行は前の行に続くので、`.` の前で折り返す形も書ける
  ```emela
  chars = [List.range(0x20, 0x7F), [0xE9, 0x3042, 0x1F600], List.range(0x00, 0x20), [0x7F]].flatten().map(|c| Char(c))
  ```
- 診断:
  診断は無い。`emela fmt`（v0.28.2）が、空の引数の列の `()` を 2 行に割る。`emela fmt --check` はこの形を通す
  ```emela
  chars = [List.range(0x20, 0x7F), [0xE9, 0x3042, 0x1F600], List.range(0x00, 0x20), [0x7F]].flatten(
  ).map(|c| Char(c))
  ```
  repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-27）で、同じ入力から同じ出力を確かめた。ほかに:
  - `.` の前で折り返して手で書いた形（`[...]` の次の行に `    .flatten()`、その次の行に `    .map(|c| Char(c))`）は `emela check` を通るが、fmt は 1 行に戻してから、上と同じ `.flatten(\n  ).map(...)` にする
  - 幅を超える所が引数のある呼び出しなら、その引数の列を割る: `[...].flatten().drop(0).map(|c| Char(c))` は `.drop(\n    0,\n  ).map(|c| Char(c))` になる
  - 最後の呼び出しで幅を超えるなら、その引数を割る: `lists().flatten().reverse()...reverse().map(|c| Char(c))` は `.map(\n    |c| Char(c),\n  )` になる
- 回避策: fmt の出力のまま残した（`test/key_gen.emel` の `codes` の `.flatten(\n  ).map(|c| Char(c))`）。`emela fmt --check` を `tools/check.ts` が走らせるので、手で直しても戻る。束縛を 2 つに分ければ（`all = [...].flatten()` と `all.map(|c| Char(c))`）割られないが、fmt に合わせるためだけの書き換えになるので、しなかった。Emela のコードの外（道具）の friction なので、コードに印は付けない
- コスト: コードのコストは無い。読む人には `flatten(` の後ろに引数があるように見え、次の行の `)` で空だと分かる。fmt の出力を変えられないので、同じ形が他の所にも出うる
- spec: `[fmt.wrap]`（「A sequence of arguments ... is put on one line without a trailing comma if it fits. If it does not fit, it is put one element per line with a trailing comma.」。要素の無い列が幅を超えたときの形は書いていない。`.` の前で折り返す規則は無い）、`[fmt.io]`（幅は 100）、`[fmt.block]`（「An empty block is `{}`.」。空の block の形は決めている）、`[lex.continuation]`（規則 1: `.` で始まる行は前の行に続く）
- 既存: emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「fmt empty」「fmt method chain」「formatter chain」「formatter break」を検索。当たりなし）。019（長い `||` の guard の fmt）は別の論点
- 行き先: spec と実装がずれている、またはバグ → fmt の issue の下書き。下書き（未提出。出すのは user）: `emela fmt` breaks an empty argument list across two lines when a method chain does not fit in the width: `[...].flatten().map(|c| Char(c))` becomes `[...].flatten(\n  ).map(|c| Char(c))`. `[fmt.wrap]` puts a sequence that does not fit "one element per line", which says nothing for a sequence with no elements, and the result looks like a call whose arguments are missing. A hand-written break before `.` (allowed by rule 1 of `[lex.continuation]`) is joined back into the same output. Expected: an empty `()` is never broken; the formatter breaks the next sequence that has elements, or breaks the chain before `.` (`[fmt.wrap]` has no rule for that yet). Reproduced with v0.28.2 on a 118-column line

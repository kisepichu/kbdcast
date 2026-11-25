# 033 dollar-interpolation

- 状態: open
- Emela: v0.28.2
- 意図: regex の差分テストの wish（`wish/differential.emel`、計画の Task 8）で、生成した pattern を `compile` が断ったときのテストの失敗の message に、pattern と error の欄を埋め込む
- こう書きたかった: `wish/differential.emel:31`（JS の template literal、Kotlin、Dart、shell の補間の `${...}` のつもり）
  ```emela
  Err(e) -> assert.fail("generated pattern ${pattern} was rejected: ${e.message} at ${e.offset}")
  ```
- 診断:
  なし。wish check（v0.28.2）は `wish/differential.emel:27` の `test "..." {` の E0126 で止まり、`:31` には届かなかった（016）
  repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-26。friction-review の後の修正のときと、この修正のときの 2 回）: `pub fn message(b: Int) -> String { "message ${b}" }` は、`emela check` が何も出さずに 0 で終わる。値は `${b}` が文字のまま残った `"message ${b}"` で、`dbg` もそう出し、`!= "message 1"` と code point が 12 個であることを確かめるテストが通った
  同じ日の使い捨ての Pome で、文字の `${name}` を書く他の形も確かめた: `"\${name}"` は ``error[E0107]: unknown escape sequence `\$` ``、`"#{"$"}{name}"` は `${name}` の 7 文字になる（テストが通った）
- 回避策: 書き直したテスト（`regex/test/differential_test.emel`）は、失敗をそのまま `Property.check_with` まで伝える形にしたので（016）、message を組み立てる所が無くなった。補間を書くなら `"generated pattern #{pattern} was rejected: #{message} at #{offset}"`（`[lex.literal]`）。正しい書き方に直しただけなので、コードに印は付けない
- コスト:
  コードのコストは無い（増えた行は 0。普段のコードに基盤レベルは漏れていない）。危ういのは、この誤りがコンパイルも実行も通ること。失敗の message のように、テストが落ちたときにしか読まない文字列で起き、落ちて初めて `${pattern}` が値でないと分かる。今回は wish check が手前の E0126 で止まったので、診断が無いことにも気づかず、使い捨ての Pome で確かめて初めて分かった
- spec: `[lex.literal]`（補間は `#{expression}`。escape は 7 つで、`\#` は `#{` を文字で書くためのもの。`$` については何も言わず、ただの文字。`\$` は E0107）、`[diag]`（`spec/diagnostics.md`。警告の番号は段ごとの帯に分かれ、字句と構文の段の `W01xx` はまだ 1 つも無い）
- 既存: emela の issue と PR に無い（2026-11-26、`gh api search/issues` で `is:issue` と `is:pull-request` のそれぞれを「"interpolation"」「"${"」「"dollar"」「"string literal warning"」で検索。当たったのは PR だけで、補間の連結の最適化（#606、#626、#767）と release（#548、#797））
- 行き先:
  自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。誤検出がありうるので候補にとどめ、出すかどうかは user が決める。範囲は `${`、名前（Emela の lower_name）、`}` の形に限る。`$` は正規表現の pattern や shell の文字列で普通に使うので（`"$1"`、`"^a$"`）、それには出さない。大文字の `${HOME}` にも出ない。wish の `${e.message}` と `${e.offset}` は欄を読む形なので外れるが、同じ literal の `${pattern}` に 1 つ出れば、誤りには気づける
  下書き（未提出。出すのは user）: A string literal that contains `${name}` compiles without a diagnostic, and the `$`, `{` and `}` stay as characters (`[lex.literal]`: interpolation is `#{expression}`). A writer who comes from JavaScript template literals, Kotlin, Dart or shell writes `"value: ${x}"` and gets the text `value: ${x}`. The mistake shows only when the string is read, often in a failure message that is printed only when a test fails. Proposal: a warning (in the band `W01xx`, which has none yet) on a string literal that contains `${`, a lower name, and `}`, with ``= help: interpolation is written `#{...}` ``. Limiting it to a name keeps `$` in regex patterns and shell text (`"$1"`, `"^a$"`, `"${HOME}"`) silent. It still fires on text that means `${name}` on purpose, such as a shell script or a template for another tool, and there is no escape for `$` to silence it (`\$` is E0107; `"#{"$"}{name}"` works but is awkward). That cost is why this is only a candidate

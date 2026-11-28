# 033 dollar-interpolation

- 状態: open
- Emela: v0.28.2
- 意図: regex の差分テストの wish（`wish/differential.emel`、計画の Task 8）で、生成した pattern を `compile` が断ったときのテストの失敗の message に、pattern と error の欄を埋め込む
- こう書きたかった: `wish/differential.emel:31`（JS の template literal、Kotlin、Dart、shell の補間の `${...}` のつもり）
  ```emela
  Err(e) -> assert.fail("generated pattern ${pattern} was rejected: ${e.message} at ${e.offset}")
  ```
  key codec の表記の wish（`wish/notation.emel:28`、`:29`、`:146`、`:168`、サブプロジェクト 2 の計画の Task 3）でも、error の message（`"unknown key name: <${body}>"`、`"duplicate modifier in <${body}>"`）と `print` の結果（`"<${c}${a}${s}${d}${name}>"`、`"F${f.f_number()}"`）に `${...}` を書いた
  key codec の encode の wish（`wish/encode.emel:161-163`、`:168`、`:175`、`:183`、サブプロジェクト 2 の計画の Task 6）では、`$` も `#` も付けない `{...}` で書いた（Python の f-string、C# の `$"..."`、Rust の `format!` の中身のつもりで、前置きを書き忘れた形）: `"\e[{final}"`、`"\e[{n};{modifier_number(m)}~"`、`"\e[27;{modifier_number(m)};{c}~"`
  VT の公開 API の wish（`wish/vt.emel:40`、サブプロジェクト 3 の計画の Task 6）でも、CPR の返事の列に `${...}` を書いた: `"\e[${row};${col}R"`
  tape のパーサの wish（`wish/tape.emel:67`、`:70`、`:75`、`:93`、`:103-104`、`:106`、`:114`、`:117-119`、サブプロジェクト 1 の計画の Task 1）でも、TapeError の message の 11 の literal に `${...}` を書いた（`"${name} must come after run"`、`"run appears more than once (first on line ${tape.command.line})"`、`"duration needs a unit: ${n}ms or ${n}s"` など）。String のパターンにも `"${n:digits}ms"` と書いた（`:115-118`。値を取り出すパターンのつもりで、016）
  cast の writer の wish（`wish/cast.emel:9`、`:17`、`:24`、サブプロジェクト 1 の計画の Task 2）でも、header とイベントの行と interval の 3 つの literal に `${...}` を書いた（`"{\"version\": 3, \"term\": {\"cols\": ${cols}, ...}, \"command\": ${cmd}}"`、`"[${interval(at_ms - w.last_ms)}, ${Json.encode(...)}, ...]"`、`"${ms / 1000}.${frac}"`）
  cli の main の wish（`wish/main.emel:32`、`:35`、`:43-44`、`:57`、`:59-60`、`:62`、`:68`、サブプロジェクト 1 の計画の Task 6）でも、stderr に書く error の文と Duration の文字列の 10 の literal に `${...}` を書いた（`"${path}: ${reason}"`、`"${path}:${line}:${column}: ${message}"`、`"/${pattern} did not appear within ${duration(timeout)}\nscreen:\n${screen}"`、`"${d.as_ms() / 1000}s"` など）
  cast の reader の wish（`wish/cast_read.emel:29`、`:40`、`:41`、サブプロジェクト 4 の計画の Task 1）でも、CastError の message の 3 つの literal に `${...}` を書いた（`"invalid JSON: ${e.message}"`、`"only asciicast v3 is supported (this is version ${v}; ...)"`、同じ文の `${json.version}`）
- 診断:
  なし。wish check（v0.28.2）は `wish/differential.emel:27` の `test "..." {` の E0126 で止まり、`:31` には届かなかった（016）
  repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-26。friction-review の後の修正のときと、この修正のときの 2 回）: `pub fn message(b: Int) -> String { "message ${b}" }` は、`emela check` が何も出さずに 0 で終わる。値は `${b}` が文字のまま残った `"message ${b}"` で、`dbg` もそう出し、`!= "message 1"` と code point が 12 個であることを確かめるテストが通った
  同じ日の使い捨ての Pome で、文字の `${name}` を書く他の形も確かめた: `"\${name}"` は ``error[E0107]: unknown escape sequence `\$` ``、`"#{"$"}{name}"` は `${name}` の 7 文字になる（テストが通った）
  表記の wish check（v0.28.2）でも、4 つの literal のどれにも `${` についての診断は無い（`:168` に出たのは同じ行の `=>` の E0110 などで、`:28-29` と `:146` には何も出ない）。`"F${f.f_number()}"` は名前でなく式なので、下の行き先の警告の範囲（`${`、名前、`}`）にも入らない
  encode の wish check（v0.28.2）でも、8 つの literal のどれにも `{` についての診断は無い（出たのは、同じ literal の `\e` の E0107（016）と `.to_bytes()` の E0313 だけ）。repo の外の使い捨ての Pome での最小の形（`pub fn csi(final: String) -> String { "x{final}" }`、2026-11-27）は、`emela check` が何も出さずに通り、`csi("A") == "x{final}"` と `csi("A") != "xA"` を確かめるテストが通った
  VT の公開 API の wish check（v0.28.2）でも、`${` についての診断は無い（`:40` に出たのは、同じ literal の `\e` の E0107（016）と、同じ行の `=>` の E0110 などだけ）
  tape のパーサの wish check（v0.28.2）でも、11 の literal のどれにも `${` についての診断は無い。パターンの `"${n:digits}ms"` も診断なしに literal の String のパターンになり、出たのは腕の本体の `n` の E0211（016）だけ。`[fn.match]` は補間をパターンに書くと E0117 と言うが、`${` は補間でないので E0117 も出ない
  cast の writer の wish check（v0.28.2）でも、3 つの literal のどれにも `${` についての診断は無い。`:9` の `${cmd}` と `:24` の `${frac}` は、`let`（004）で束縛されなかった名前を指していたが、補間でないので E0211 も出ず、`let` の誤りの後追いの診断が 1 つ消えた形になった
  cli の main の wish check（v0.28.2）でも、10 の literal のどれにも `${` についての診断は無い（`:57`、`:59`、`:62` に出たのは、同じ腕の `->` の後の改行（078）の E0110 だけ。`:68` は同じ行の `as_ms` の E0315（016））
  cast の reader の wish check（v0.28.2）でも、3 つの literal のどれにも `${` についての診断は無い（`:29` に出たのは同じ腕の `Err` の E0211（016）だけで、`:40-41` には何も出ない）
- 回避策: 書き直したテスト（`regex/test/differential_test.emel`）は、失敗をそのまま `Property.check_with` まで伝える形にしたので（016）、message を組み立てる所が無くなった。補間を書くなら `"generated pattern #{pattern} was rejected: #{message} at #{offset}"`（`[lex.literal]`）。正しい書き方に直しただけなので、コードに印は付けない
  表記（Task 3、`src/key/notation.emel`）は `#{...}` に直した。正しい書き方に直しただけなので、コードに印は付けない。表記のテストは message と `print` の結果を完全に一致させるので、直さなければテストが落ちて気づけた
  encode（Task 6、`src/key/encode.emel`）は `#{...}` に直した（`"#{CSI}#{final}"`、`"#{CSI}27;#{modifier_number(m)};#{c}~"`）。正しい書き方に直しただけなので、コードに印は付けない。encode の固定の例と golden の表のテストは bytes を完全に一致させるので、直さなければテストが落ちて気づけた
  VT の公開 API（Task 6、`src/vt.emel` の `reply_bytes`）は `#{...}` に直した（`"\u{1b}[#{row};#{col}R"`）。正しい書き方に直しただけなので、コードに印は付けない。`reply_bytes(CursorPosition(2, 3))` の固定の例が bytes を完全に一致させるので、直さなければテストが落ちて気づけた
  tape のパーサ（サブプロジェクト 1 の Task 1、`src/tape.emel`）は `#{...}` に直した（`"#{what} needs a duration"`、`"run appears more than once (first on line #{first.line})"` など）。正しい書き方に直しただけなので、コードに印は付けない。テストは message を完全に一致させるので、直さなければテストが落ちて気づけた。パターンの所は 016
  cast の writer（サブプロジェクト 1 の Task 2、`src/cast.emel`）は `#{...}` に直した（`"... \"cols\": #{cols}, ... \"command\": #{quote(command)}}"`、`"[#{interval(at_ms - w.last_ms)}, #{quote(code)}, #{quote(data)}]"`、`"#{ms / 1000}.#{zeros}#{millis}"`）。正しい書き方に直しただけなので、コードに印は付けない。テストは行を完全に一致させるので、直さなければテストが落ちて気づけた。header の literal は JSON なので、補間のほかに `{` と `}` を文字として 2 つずつ含む（下のコストの `{name}` の誤検出の例）
  cli の main（サブプロジェクト 1 の Task 6、`cli/src/main.emel`）は `#{...}` に直した（`"#{path}:#{line}:#{column}: #{message}"`、`"/#{pattern} did not appear within #{dur(timeout)}\nscreen:\n#{screen}"` など）。正しい書き方に直しただけなので、コードに印は付けない。cli には permanent なテストが無く（E2E は smoke）、直さなくてもコンパイルは通るので、error の文を E2E の smoke で 1 つずつ出して確かめた
  cast の reader（サブプロジェクト 4 の Task 1、`src/cast.emel`）は `#{...}` に直した（`"invalid JSON: #{message}"`、`"... (this is version #{shown}; ...)"`）。正しい書き方に直しただけなので、コードに印は付けない。version の文はテストが message を完全に一致させるので、直さなければテストが落ちて気づけた。`invalid JSON: ` の文は、テストが接頭辞だけを確かめる（後ろは Std.Json の message）ので、`${e.message}` のままでも通ってしまう。使い捨てのテストで `dbg` に出し、``invalid JSON: expected `,` or `}` `` のように Std.Json の message が入ることを確かめた
- コスト:
  コードのコストは無い（増えた行は 0。普段のコードに基盤レベルは漏れていない）。危ういのは、この誤りがコンパイルも実行も通ること。失敗の message のように、テストが落ちたときにしか読まない文字列で起き、落ちて初めて `${pattern}` が値でないと分かる。今回は wish check が手前の E0126 で止まったので、診断が無いことにも気づかず、使い捨ての Pome で確かめて初めて分かった
  encode の `{...}` は `${...}` より見分けにくい: `{` と `}` は JSON や正規表現の量指定子（`a{2}`）など、文字として書くことの多い文字なので、下の行き先の警告の範囲を `{name}` に広げると誤検出が増える。このメモの警告の案は `${` に限ったままにし、`{name}` は使い道の記録にとどめる
- spec: `[lex.literal]`（補間は `#{expression}`。escape は 7 つで、`\#` は `#{` を文字で書くためのもの。`$` については何も言わず、ただの文字。`\$` は E0107）、`[diag]`（`spec/diagnostics.md`。警告の番号は段ごとの帯に分かれ、字句と構文の段の `W01xx` はまだ 1 つも無い）
- 既存: emela の issue と PR に無い（2026-11-26、`gh api search/issues` で `is:issue` と `is:pull-request` のそれぞれを「"interpolation"」「"${"」「"dollar"」「"string literal warning"」で検索。当たったのは PR だけで、補間の連結の最適化（#606、#626、#767）と release（#548、#797））
- 行き先:
  自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。誤検出がありうるので候補にとどめ、出すかどうかは user が決める。範囲は `${`、名前（Emela の lower_name）、`}` の形に限る。`$` は正規表現の pattern や shell の文字列で普通に使うので（`"$1"`、`"^a$"`）、それには出さない。大文字の `${HOME}` にも出ない。wish の `${e.message}` と `${e.offset}` は欄を読む形なので外れるが、同じ literal の `${pattern}` に 1 つ出れば、誤りには気づける
  下書き（未提出。出すのは user）: A string literal that contains `${name}` compiles without a diagnostic, and the `$`, `{` and `}` stay as characters (`[lex.literal]`: interpolation is `#{expression}`). A writer who comes from JavaScript template literals, Kotlin, Dart or shell writes `"value: ${x}"` and gets the text `value: ${x}`. The mistake shows only when the string is read, often in a failure message that is printed only when a test fails. Proposal: a warning (in the band `W01xx`, which has none yet) on a string literal that contains `${`, a lower name, and `}`, with ``= help: interpolation is written `#{...}` ``. Limiting it to a name keeps `$` in regex patterns and shell text (`"$1"`, `"^a$"`, `"${HOME}"`) silent. It still fires on text that means `${name}` on purpose, such as a shell script or a template for another tool, and there is no escape for `$` to silence it (`\$` is E0107; `"#{"$"}{name}"` works but is awkward). That cost is why this is only a candidate

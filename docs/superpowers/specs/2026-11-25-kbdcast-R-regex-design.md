# サブプロジェクト R: 正規表現の Pome

- 日付: 2026-11-25
- 全体設計: `docs/superpowers/specs/2026-11-23-kbdcast-design.md`（§5 の R）
- 状態: 実装済み（PR #11）

## 1. 目的と範囲

汎用の正規表現の Pome `regex` と、それが要る String の関数を補う Pome `text` を作る。kbdcast の tape の `wait /pattern` が使うだけでなく、Emela の ecosystem への貢献（`emela-lang/x` に持ち込み、いずれ std に）を目指す。

Emela の std の方針（`15-stdlib.md`）は、形の決まっていない純粋な部品を `github.com/emela-lang/x` で先に出し、使われて固まったら std に入れる、としている。R の 2 つの Pome は、最初から x に移せる形で作る。x に出すのは user の手で行う（AGENTS.md）。

## 2. 決めたこと

| 論点 | 決定 | 採らなかった案 |
|---|---|---|
| 受け付ける言語 | ECMAScript（`u` フラグ）の正規な部分集合。線形時間を保証する（後方参照、先読み、後読みなし） | RE2 の構文、ECMAScript のほぼ全部を backtracking で |
| API | `compile`、`is_match`、`find`、`find_all`、`replace`（関数を受け取る）、`split` | 一致と capture まで、最小限 |
| `i` flag | Unicode の simple case folding（ECMAScript の `iu` と同じ） | 入れない、ASCII だけ |
| 単位 | code point | grapheme、UTF-16 |
| エンジン | Pike VM。ECMAScript の capture の消去と empty check は Barrière と Pit-Claudel（PLDI 2024、arXiv 2311.17620）に従う | 導関数（capture の意味論が POSIX で、ECMAScript と合わない）、backtracking |
| String の部分文字列 | `text` Pome に、std に入れるならこうなる名前と型で置く。std に入ったら消す | regex の中に隠す（core でも要るので重複する）、emela の fork の std に足す（release の版で開発できなくなる） |
| 置き場所 | kbdcast の repo の中に x の形（`Pome.toml`、`README.md`、`src/`、`test/`）で置く。x に入ったら source path を `github.com/emela-lang/x/<name>` に変える | x の fork の中で開発する（kbdcast の検査の仕組みが効かない） |

## 3. Pome の構成

| Pome | source path | root name | 依存 |
|---|---|---|---|
| `text/` | `github.com/kisepichu/kbdcast/text` | `Text` | なし |
| `regex/` | `github.com/kisepichu/kbdcast/regex` | `Regex` | `text`（`[replace]` で `../text`）。テストだけ brix |

- どちらも `@external` を持たない（`regex/test/` の正解役を除く）。
- 公開 API に `Text` の型は出さない。std に関数が入ったら、regex は `Text.x` を `String.x` に置き換えて `text` への依存を外す。regex を使う側は何も変わらない。
- `emela` の欄は `mise.toml` で固定した版にする。

## 4. text

```emela
pub fn from_code_points(cps: List[Int]) -> Option[String]  # String.code_points の逆。scalar value でない値があれば None
pub fn slice(s: String, from: Int, to: Int) -> String       # code point の offset。from 以上 to 未満
```

- `slice` は `Bytes.slice` と `Array.slice` と同じく、`from` と `to` を 0 から長さの範囲に丸め、`from >= to` なら空にする。
- `from_code_points([])` は `Some("")`。
- 名前、引数の順、範囲外の扱いは `[lib.api-rules]` に従う（subject が先、丸める、Option）。

これは std に足りない関数の代わりなので、friction のメモを 1 つ書く（`String に部分文字列と code point からの組み立てが無い`）。メモの行き先は proposal の下書きとし、使い道（regex、後の VT）、規約との対応、性能の差（code point のリストを経由するので O(n)）を育てる。位置の単位（std の `length` は grapheme、`contains` と `Json` の offset は code point）は、proposal の Open question として書く。

## 5. regex の公開 API

```emela
pub type Flags(ignore_case: Bool, multiline: Bool, dot_all: Bool)
pub error RegexSyntax(message: String, offset: Int)
pub opaque type Regex(...)
pub opaque type Match(...)

pub fn compile(pattern: String, flags: Flags) -> Regex fails RegexSyntax
pub fn is_match(re: Regex, s: String) -> Bool
pub fn find(re: Regex, s: String) -> Option[Match]
pub fn find_all(re: Regex, s: String) -> List[Match]
pub fn replace(re: Regex, s: String, f: fn(Match) -> String) -> String
pub fn split(re: Regex, s: String) -> List[String]

pub fn start(m: Match) -> Int
pub fn end(m: Match) -> Int
pub fn text(m: Match) -> String
pub fn group(m: Match, index: Int) -> Option[String]
pub fn named(m: Match, name: String) -> Option[String]
```

flag を何も立てない値は `NO_FLAGS`。`Match` の関数は `Match` を定義するモジュール（`lib`）に置き、`m.text()` と書ける。

`RegexSyntax` は `lib` と `syntax` の両方に同じ形で宣言し、`compile` で詰め替える。Emela には再公開が無く、モジュールの循環も compile error なので、`import Regex.{RegexSyntax}` と `Syntax.parse(...) fails RegexSyntax` を両立させる形がこれしか無い（friction 012）。

振る舞いは、どれも JS の RegExp（`u` フラグ付き）の振る舞いで定義する。

| 関数 | 定義 |
|---|---|
| `is_match` | `find` が `Some` か |
| `find` | `re.exec(s)`（`lastIndex` 0 から） |
| `find_all` | `s.matchAll(re)`（`g` と `u`）。空の一致の後は 1 code point 進める |
| `replace` | `s.replace(re, f)`（`g` と `u`）。すべての一致を `f` の結果で置き換える |
| `split` | `s.split(re)` から capture の要素を除いたもの（JS は capture を結果に挟むが、regex は挟まない） |
| `start`、`end` | 一致の位置。code point の offset |
| `group(m, i)` | `i` 番目の capture。0 は一致全体。一致しなかった group と、範囲外の `i` は `None` |
| `named(m, name)` | 名前付きの capture。無い名前と一致しなかった group は `None` |

## 6. 構文

| 区分 | 受け付ける | 受け付けない（`RegexSyntax`） |
|---|---|---|
| 文字 | 文字そのもの、`.`、`\n` `\r` `\t` `\v` `\f` `\0`、`\u{...}`、`\uXXXX`、`\xXX`、`\cX`、構文の文字の escape（`^$\.*+?()[]{}\|/`、class の中では `-` も） | `u` モードで許されない escape（`\q` など） |
| 文字クラス | `[...]`、`[^...]`、範囲、`\d` `\D` `\w` `\W` `\s` `\S` | `\p{...}` `\P{...}`、`v` フラグの集合演算 |
| 量指定子 | `*` `+` `?` `{n}` `{n,}` `{n,m}` と最短一致版 | 繰り返しの回数が 1000 を超えるもの、繰り返すものが無いもの（`*a`、`a**`）、順序の逆な `{n,m}`、展開した命令列が大きすぎるもの（`pattern too large`） |
| group | `(...)`、`(?:...)`、`(?<name>...)`、`\|`。名前は ASCII の識別子（`[A-Za-z$_][A-Za-z0-9$_]*`、`\u` の escape がそれに戻るものを含む） | 後方参照（`\1`、`\k<name>`）、先読み、後読み、修飾子の group（`(?i:...)`）、重複した名前（選択肢をまたぐ `(?<a>x)\|(?<a>y)` も）、ASCII の識別子でない名前（ECMAScript では正しい `(?<名前>x)` も。正確な形は issue #10） |
| 位置 | `^` `$` `\b` `\B` | — |
| flag | `ignore_case`、`multiline`、`dot_all` | — |

- 文法は ECMAScript の `u` モードの文法に従う。`u` モードで SyntaxError になる pattern は、受け付ける範囲のものでも `RegexSyntax` にする（単独の `{`、`}`、`]` など）。
- `RegexSyntax` の `offset` は pattern の code point の offset で、問題のある構文の始まりを指す。閉じていない group と class は、開きの位置を指す。`pattern too large` は 1 つの構文のせいではないので offset 0。メッセージは英語（x と std に合わせる）。

## 7. 意味論

- leftmost-first。最初に一致する位置のうち、ECMAScript の backtracking が最初に見つける一致を返す。
- 量指定子の 1 回ごとに、その中の capture を消す（`/(?:(a)|b)+/` に `"ab"` で group 1 は `None`）。
- 必須の回数を超えた 1 回が空の一致なら、その 1 回は失敗とみなす（`/(a*)*/` に `"b"` で group 1 は `None`、`/(a*)+/` では `""`）。
- `.` は、`dot_all` でなければ行末の文字（`\n` `\r` U+2028 U+2029）に一致しない。`multiline` では、`^` と `$` が行末の文字の前後にも一致する。
- `\s` は ECMAScript の WhiteSpace と LineTerminator（U+3000 などを含む）。`\d` と `\w` は ASCII。
- `ignore_case` では、入力の文字と pattern の文字の両方を simple case folding（CaseFolding.txt の status C と S）で正規化して比べる。`\w`、`\W`、`\b`、`\B` は、正規化した結果が ASCII の word 文字になる文字（U+017F、U+212A）も word 文字とみなす（ECMAScript の `iu`）。
- case folding の表は Unicode 17.0（正解役の Bun 1.4.3 と Node 24 の ICU 78.3 と同じ版）。

## 8. エンジン

| モジュール | 責務 |
|---|---|
| `lib` | 公開 API |
| `syntax` | pattern の code point を AST に変換する。受け付ける構文だけを表現できる AST にし、group の番号と名前もここで決める |
| `class` | code point の範囲の集合（並んだ、重ならない範囲）。和、補集合、case folding による正規化、`\d` `\w` `\s` `.` |
| `fold` | case folding の表を引く。表は `tools/gen-case-folding.ts` が生成する `fold_table.emel` |
| `program` | AST を Pike VM の命令の Array に変換する。回数付きの繰り返しは展開する（`e{n,m}` は `e` を n 個と、入れ子の省略できる `e` を m − n 個）。空に一致しうる本体の `e{n,}` と `e{n,}?`（`+`、`+?` を含む）は、`e` を n 個並べた後に `e*` か `e*?` を置く。展開した命令列が `MAX_SIZE`（100_000）を超えたら作らず、`compile` が `pattern too large` にする（RE2 の `max_mem`、Rust regex の `size_limit` と同じ考え） |
| `vm` | 照合する。スレッドは命令の位置、`left` の flag（空に一致しうる本体の省略できる 1 回を、空の一致で終えさせないため。論文 §4.1）、capture の書き込みの記録（論文 §4.2 と §4.6）を持ち、優先順位の順に並ぶ。重複を除く鍵は（命令の位置、`left`）の組で、優先順位の高い方だけを残す |

計算量:

- **`find` と `is_match`**: O(m·n) 歩。m は展開した命令列の大きさ（上限 100_000）、n は入力の code point の数。1 歩は O(log m)。JS で O(1) の更新ができる配列が無いため、訪れた状態の集合を `Std.Set` にしている（friction 024）。
- **`find_all`、`replace`、`split`**: 探索を繰り返すので、最悪 O(m·n²) 歩（`a*b|a` を `"a"` × n に。Rust regex の `find_iter` と同じ）。一致した文字列と部分を作る手間は、O(n + 出力の長さ)。

論文が扱う範囲とこのエンジンの対応は `vm.emel` の doc comment にある。空に一致しうる本体の最短一致の plus は、論文でも未解決の問題（§4.5.3、§7）なので、本体を複製する。

## 9. テスト

| 対象 | 手法 |
|---|---|
| 意味論（固定） | 計画に載せた表（JS の RegExp で node と bun の両方から得た結果）。`find`、`find_all`、`replace`、`split`、エラーの offset |
| 意味論（ランダム） | brix の pbt で、受け付ける文法の pattern と、小さな文字の集合（`a`、`b`、改行、空白、U+017F、U+212A、U+00DF、U+1E9E、U+1F600 など）の文字列を作り、`find` の結果（位置と capture）を JS の RegExp と比べる。RegExp は `regex/test/` の `@external` から呼び、`d` フラグの位置を code point の位置に直す |
| 線形時間 | vm が処理したスレッドの数（決定的）で、入力の長さを n = 2000 と 4000 にして比べる。`(a*)*b`、`(a\|a)*b`、`(a?){30}a{30}b`（全部 `a` の入力には一致しないので、全位置を走る）で、比が 1.5 倍以上 2.5 倍以下。歩数が 2 ×（命令の数）×（n + 1）以下であることも確かめる |
| 結果を作る手間 | 同じ n（`"a"` × 4000）で、`replace` の時間を `find_all` と比べる（1 回ごとの中央値）。4 倍以下。壁時計の飛びを避けるために中央値を使う（friction 032） |
| text | 範囲の丸め、scalar value でない値、astral |

brix の pbt に組み合わせの関数（選択、再帰）が無ければ、`Gen` を直接組み立てる。そのこと自体を friction として記録する（行き先は brix。出すのは user）。

## 10. 検査の仕組みとの関係

- wish-first の単位: text、fold、regex の公開 API、syntax、class、vm（program を含む）、find_all と replace と split、差分テストの生成器。
- lint の対象に `text` を加える（`tools/lib/pomes.ts` の `LINT_POMES`）。公開 API で `fails` を宣言するモジュールは、理由を付けて `tools/lint/foundation.allow` に登録する。エンジンのモジュールは普段のレベルのままにする。
- `tools/check.ts --commit` が検査するファイルに `Pome.lock` を足す（issue #9）。
- 先に予想しておく friction: String の部分文字列の関数が無い（`text` そのもの）、JS で `Array.set` が常にコピーする（スレッドの重複を除く集合）、大きな表を Emela のソースとして書く、brix の pbt の組み合わせの関数。
- PR を出す前に、別の session で friction-review skill を走らせる。

## 11. 周辺の変更

- AGENTS.md の構成の表に `text/` を足す。
- 全体設計: §7 の置き場所の決めごとを「x の形で作り、x に出す」に改める。§13 の貢献候補に「String の部分文字列」「regex の x への持ち込み」「brix の pbt の組み合わせ」を足す。

## 12. 完了条件

- `text` と `regex` の `emela test` が通る（固定の表、性質テスト、差分テスト、線形時間）。
- `mise exec -- bun tools/check.ts --commit` と `mise exec -- prek run --all-files` が通る。
- 予想した friction と、実際に出た friction がメモになっている。
- friction-review の結果が PR 本文にある。

## 13. リスク

- 論文のアルゴリズムを Emela で書く難しさ。→ 実装できた。論文の範囲から外れる構文（回数付きの繰り返し、空に一致しうる本体の最短一致の plus）は、本体を展開または複製して扱い、大きすぎる展開だけを断った（§8）。
- JS ターゲットでの性能。→ 線形性は歩数のテストで、結果を作る手間は `replace` と `find_all` の時間の比で見る（§9）。絶対の時間の上限は置かなかった。WSL2 では壁時計が約 32 秒ごとに 2〜4 秒飛び、時間の比較が揺れるため（friction 032）。kbdcast の `wait` の pattern は小さい（m が数十）ので、困らない見込み。
- 生成した表が大きく、`emela fmt` や compile に時間がかかる可能性。→ 起きなかった（`emela check` 0.16 秒）。

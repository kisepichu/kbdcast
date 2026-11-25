# regex

ECMAScript の正規表現（`u` flag）のうち正規な部分集合を，入力の長さに線形な時間で照合する Pome．一致と capture は JavaScript の `RegExp` と同じものを返す．位置はコードポイントで数える．

```emela
import Regex
import Regex.{Flags, NO_FLAGS, RegexSyntax}

re = Regex.compile("(?<y>\\d{4})-(?<m>\\d\\d)", NO_FLAGS)
Regex.find(re, "on 2026-11")                          # Some(m)．m.start() は 3，m.text() は "2026-11"，m.named("m") は Some("11")
Regex.replace(re, "on 2026-11", |m| "[#{m.text()}]") # "on [2026-11]"

Regex.is_match(Regex.compile("straße", Flags(ignore_case: True, ..NO_FLAGS)), "STRAẞE") # True

fn check(pattern: String) -> String {
  {
    Regex.compile(pattern, NO_FLAGS)
    "ok"
  } escape {
    RegexSyntax(message:, offset:) -> "#{message} at #{offset}"
  }
}

check("a(?<=b)") # "lookbehind is not supported at 1"
```

| 関数 | 型 | 振る舞い |
|---|---|---|
| `compile` | `compile(pattern: String, flags: Flags) -> Regex fails RegexSyntax` | `pattern` を ECMAScript の `u` の構文で読む．受け付けない pattern は `RegexSyntax` で失敗する |
| `is_match` | `is_match(re: Regex, s: String) -> Bool` | `find` が `Some` か |
| `find` | `find(re: Regex, s: String) -> Option[Match]` | 最初の一致．JS の `re.exec(s)` |
| `find_all` | `find_all(re: Regex, s: String) -> List[Match]` | すべての一致を順に．JS の `s.matchAll(re)`（`g` と `u`）．次の探索は一致の終わりから始め，空の一致なら 1 コードポイント先から始める |
| `replace` | `replace(re: Regex, s: String, f: fn(Match) -> String) -> String` | `find_all` の一致 `m` をそれぞれ `f(m)` で置き換えた文字列．JS の `s.replace(re, f)`（`g` と `u`）．`f` は一致の順に呼ぶ |
| `split` | `split(re: Regex, s: String) -> List[String]` | `s` を一致の所で切った文字列．JS の `s.split(re)`（`u`）から capture を除いたもの．`s` の終わりで始まる一致では切らない．空の一致は，前に切った所と `s` の先頭では切らない．`""` は `[""]`，`re` が `""` に一致するなら `[]` |
| `start` | `start(m: Match) -> Int` | 一致の始まり |
| `end` | `end(m: Match) -> Int` | 一致の終わり（含まない） |
| `text` | `text(m: Match) -> String` | 一致した文字列 |
| `group` | `group(m: Match, index: Int) -> Option[String]` | `index` 番目の group の文字列．0 は一致全体．一致に加わらなかった group と，範囲外の `index` は `None` |
| `named` | `named(m: Match, name: String) -> Option[String]` | 名前が `name` の group の文字列．pattern に無い名前と，一致に加わらなかった group は `None` |

- `Flags(ignore_case: Bool, multiline: Bool, dot_all: Bool)` は JS の `i`，`m`，`s`．`NO_FLAGS` はどれも立てない値で，`Flags(ignore_case: True, ..NO_FLAGS)` のように一部だけを立てる
- `RegexSyntax(message: String, offset: Int)` の `offset` は pattern の先頭からのコードポイントの数で，断った構文の始まり（閉じていない group と class は，開きの `(` と `[`）を指す．`pattern too large` だけは 0
- `Regex` と `Match` は opaque．`Match` の関数は `m.text()` のように呼べる

## 受け付けるもの

| 区分 | 受け付ける | 受け付けない（`RegexSyntax`） |
|---|---|---|
| 文字 | 文字そのもの，`.`，`\n` `\r` `\t` `\v` `\f` `\0`，`\cX`，`\xXX`，`\uXXXX`（サロゲートの対は 1 つのコードポイント），`\u{...}`，構文の文字の escape（`^$\.*+?()[]{}\|/`．class の中では `-` も） | `u` モードで許されない escape（`\q` など） |
| 文字クラス | `[...]`，`[^...]`，範囲，`\d` `\D` `\w` `\W` `\s` `\S`，class の中の `\b`（U+0008） | `\p{...}` `\P{...}`，`v` flag の集合の演算 |
| 量指定子 | `*` `+` `?` `{n}` `{n,}` `{n,m}` と最短一致の版 | 1000 を超える回数 |
| group | `(...)`，`(?:...)`，`(?<name>...)`，`\|` | 後方参照（`\1`，`\k<name>`），先読み，後読み，修飾子の group（`(?i:...)`） |
| 位置 | `^` `$` `\b` `\B` | — |
| flag | `ignore_case`（`i`），`multiline`（`m`），`dot_all`（`s`） | —（`g` `y` `d` `v` に当たるものは無い．`find_all` と `replace` は `g` を立てたときと同じに探す） |

ほかに，次のものを `RegexSyntax` で断る．

- `u` モードで SyntaxError になる pattern（単独の `{`，`}`，`]`，繰り返すものの無い `*a` と `a**`，順序の逆な `a{2,1}` など）
- ASCII の識別子（`[A-Za-z$_][A-Za-z0-9$_]*`）でない group の名前．`capture group names must be ASCII identifiers` で，JS で正しい名前（`(?<名前>x)`）も断る．`\u` の escape で書いた名前は，戻した文字がこれに入れば受け付ける（`(?<\u0061>x)` の名前は `a`）
- pattern の中で 2 度目に出てきた group の名前．選択の別の枝でも `duplicate capture group name` で断る（`(?<a>x)|(?<a>y)`．JS は ES2025 から，別の枝なら同じ名前を許す）
- 展開した命令列が 100_000 を超える pattern．回数付きの繰り返しは本体を回数の分だけ並べ，入れ子の回数は掛け算で増える（`(?:(?:a{1000}){1000}){1000}` は 10^9）．RE2 の `max_mem` と Rust regex の `size_limit` と同じく，`compile` は大きさに上限を置き，`pattern too large`（offset 0）で断る

## 意味

- 一致は JS の backtracking が最初に見つけるもの（leftmost-first）．量指定子の 1 回ごとに，その中の capture を消す（`(?:(a)|b)+` に `"ab"` で group 1 は `None`）．必須の回数を超えた 1 回が空に一致したら，その 1 回は失敗とみなす（`(a*)*` に `"b"` で group 1 は `None`，`(a*)+` では `Some("")`）
- `.` は，`dot_all` でなければ行末の文字（`\n` `\r` U+2028 U+2029）に一致しない．`multiline` では，`^` と `$` が行末の文字の前後にも一致する
- `\d` と `\w` は ASCII．`\s` は ECMAScript の WhiteSpace と LineTerminator（U+3000 などを含む）
- `ignore_case` では，入力と pattern の文字の両方を Unicode 17.0 の simple case folding（CaseFolding.txt の status C と S）で正規化して比べる．`\w` `\W` `\b` `\B` は，正規化すると ASCII の word 文字になる U+017F と U+212A も word 文字とみなす（ECMAScript の `iu`）

## 線形時間の保証

`find` と `is_match` は O(m·n) 歩．1 歩は O(log m)（JS で O(1) の更新ができる配列が無いため．friction 024）．m は回数付きの繰り返しを展開した命令列の大きさ（100_000 まで），n は入力のコードポイントの数．backtracking の engine が指数時間をかける `(a*)*b` や `(a|a)*b` も，入力の長さに線形に収まる．

- `find_all`，`replace`，`split` は探索を繰り返すので，最悪で O(m·n²) 歩（Rust regex が `find_iter` について書くのと同じ）
- `replace`，`split`，`Match` の `text`，`group`，`named` は，文字列を `Text.slice` で切り出す．切り出す 1 つにつき O(n) かかる（friction 002）

## JS と違う点

- `split` は capture を結果に挟まない．JS の `"a-b".split(/(-)/u)` は `["a", "-", "b"]`，`Regex.split(Regex.compile("(-)", NO_FLAGS), "a-b")` は `["a", "b"]`
- 位置はコードポイントで数える．JS の `index` と `d` flag の `indices` は UTF-16 の code unit で数える（`"😀a"` の `a` は，JS では 2，regex では 1）
- 受け付ける構文が狭い（「受け付けるもの」）．JS で正しい pattern でも，後方参照，先読み，後読み，`\p{...}`，修飾子の group，`v` flag の集合の演算，1000 を超える回数，ASCII でない group の名前，別の枝で重なる group の名前，展開すると大きすぎる pattern は断る

## 仕組み

- エンジンは Pike VM．Barrière と Pit-Claudel の "Linear Matching of JavaScript Regular Expressions"（PLDI 2024，https://arxiv.org/abs/2311.17620）に従い，capture の消去と空の繰り返しの扱いを，線形時間のまま JS と同じにする．論文のどの節に従うか，どこが違うかは `src/vm.emel` の先頭のコメントにある
- case folding の表（`src/fold_table.emel`）は，kbdcast の `tools/gen-case-folding.ts` が Unicode 17.0 の CaseFolding.txt から生成する．正解役にした Bun 1.4.3 と Node 24 の ICU と同じ版
- `src/` は純粋な Emela で書いていて，host に依存しない．依存は `text`（std に入ったら外す）だけ
- テストは 3 種類ある．Bun と Node の `RegExp` から取った結果の表，brix の pbt で作った pattern と入力で JS の `RegExp` と結果を比べる差分テスト（正解役の `test/oracle.mjs` はテストだけの `@external`），入力を 2 倍にしても歩数が 2.5 倍以下に収まることを確かめる線形時間のテスト

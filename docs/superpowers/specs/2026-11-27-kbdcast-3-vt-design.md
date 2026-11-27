# サブプロジェクト 3: VT

- 日付: 2026-11-27
- 全体設計: `docs/superpowers/specs/2026-11-23-kbdcast-design.md`（§5 の 3）
- 状態: 実装済み（PR #17）

## 1. 目的と範囲

端末の出力を読んで画面を作る VT を作る。使うのは次の 2 つ。

- recorder（1）: `wait /pattern` が見る画面の文字列、アプリの問い合わせへの返事、key codec の encode が読む `InputModes`。
- overlay（4）: キー表示を重ねる前の画面（セルの文字と属性、カーソル）。overlay はこの画面を描き直す出力を書き、agg が描く。

あわせて、PTY の bytes を文字列にするストリーム用の UTF-8 デコーダを作る（recorder が cast の `o` イベントを書くのに使う）。どれも純粋な関数で、effect を使わない。

## 2. 決めたこと

| 論点 | 決定 | 採らなかった案 |
|---|---|---|
| 意味論 | agg 1.9.0（最新の release）が使う avt 0.18.0 と同じ画面を作る。比べるのは agg と同じく、画面のセル（文字、全角の左か右か、pen）とカーソル | xterm の ctlseqs を正にする（agg が元の cast を描いたときと、描き直した画面が食い違いうる。正解役が無い） |
| 入力 | `feed` は String（code point の列）を受ける | Bytes を受けて中で UTF-8 を読む（cast の `o` は文字列で、recorder も cast に書くために文字列にする。avt も `feed_str`） |
| UTF-8 | 別の module のストリーム用デコーダ。正しくない bytes は U+FFFD にする（WHATWG Encoding の UTF-8 decoder。極大の不正な部分列ごとに 1 つ）。BOM は残す | 不正な bytes で止める（PTY の出力は不正なことがある） |
| 幅 | unicode-width 0.1.14（agg 1.9.0 の lock の版）から生成した表。avt と同じく、U+007E より上で unicode-width が 2 と言う文字だけが幅 2、ほかは幅 1（結合文字も 1 セルを取る） | 自前の wcwidth（agg と幅が食い違う） |
| 正解 | avt 0.18.0 を Rust の harness から呼び、種を固定したランダムな入力と手で書いた入力で、画面のスナップショットの表を作る | avt を WASM にして test から呼ぶ（build と生成物の管理が増える。2 と同じ形の表で足りる） |
| kbdcast が足すもの | 返事（DA1、DSR、CPR）と、modifyOtherKeys の段階（2 の `InputModes`）。DECCKM と LNM は avt も持つ | kitty の問い合わせに答える（encoder が kitty を扱わない。2 の spec §2） |
| 足さないもの | scrollback、大きさの変更（cast の `r`。avt の xtwinops も既定で無効）、マウス、bracketed paste の追跡、OSC（題名など）、DCS | — |
| 画面の持ち方 | 行の Array（各行はセルの Array）。まず素直に書き、§9 の計測で遅ければ、続く文字をまとめて 1 回で行に書く形にする | List（行を 1 つ書き換えるのに O(rows)） |

## 3. 置き場所

root の Pome に足す。

| 場所 | module | 中身 |
|---|---|---|
| `src/utf8.emel` | `Utf8` | ストリーム用の UTF-8 デコーダ |
| `src/vt/width_table.emel` | `Vt.WidthTable` | 生成した幅 2 の範囲の表 |
| `src/vt/width.emel` | `Vt.Width` | `is_wide` |
| `src/vt/parser.emel` | `Vt.Parser` | DEC の状態機械（文字の列 → action の列） |
| `src/vt/screen.emel` | `Vt.Screen` | セル、pen、色、行と画面の操作（書く、消す、挿入、削除、スクロール） |
| `src/vt/terminal.emel` | `Vt.Terminal` | action の解釈（カーソル、mode、pen、余白、タブ、文字集合、保存したカーソル、alt screen、返事） |
| `src/vt.emel` | `Vt` | 公開 API |
| `tools/avt-golden/` | — | avt 0.18.0 と unicode-width 0.1.14 の Rust の harness |
| `tools/gen-vt-golden.ts` | — | harness の出力から幅の表と golden の表を作る |
| `test/vt_golden.emel` | — | 生成した golden の表 |

型と関数の形は wish で決める。以下の節の書き方は、意味を決めるための仮の形である。

## 4. UTF-8

```emela
pub opaque type Decoder
pub fn decoder() -> Decoder
pub fn feed(d: Decoder, b: Bytes) -> (Decoder, String)   # 読めた文字。途中で切れた文字は持ち越す
pub fn finish(d: Decoder) -> String                       # 持ち越した途中の文字があれば U+FFFD
```

- 結果は、bytes をどこで分けて `feed` しても同じ（分けずに 1 回で `feed` して `finish` したものと等しい）。
- 正解役は JS の `TextDecoder("utf-8", { ignoreBOM: true })` の `decode(chunk, { stream: true })`。test の `@external` から呼ぶ（regex と同じ）。

## 5. parser

avt 0.18.0 の `parser.rs` と同じ状態機械（Paul Williams の DEC の状態遷移図。Ground、Escape、EscapeIntermediate、CsiEntry、CsiParam、CsiIntermediate、CsiIgnore、Dcs…、OscString、SosPmApcString）を、文字の列に対して走らせる。

- 状態は `feed` をまたいで持ち越す。途中で切れた escape の列も、次の `feed` で続きを読む。
- 出す action は、文字を書く（続く文字はまとめてよい）、C0 の制御、CSI（引数、中間の文字、終わりの文字）、ESC（中間の文字、終わりの文字）。OSC、DCS、SOS、PM、APC の中身は捨てる。
- 引数と中間の文字の扱い（`:` の下位の引数、引数の数の上限、溢れ、C1 の制御文字 0x80〜0x9F）は avt に合わせる。

## 6. 画面と解釈

- avt 0.18.0 の `terminal.rs`、`buffer.rs`、`line.rs` と同じ振る舞いにする。扱う制御は avt と同じで、次のとおり。
  - 文字を書く（全角と折り返しと insert mode を含む）。BS、HT、LF、VT、FF、CR、SO、SI
  - `ESC 7` `ESC 8`（DECSC、DECRC）、`ESC D` `ESC E` `ESC M`、`ESC H`（HTS）、`ESC c`（RIS）、`ESC ( X` と `ESC ) X`（`X` が `0` なら DEC の罫線、ほかのどの終わりの文字でも ASCII）、`ESC # 8`（DECALN）。`ESC @`〜`ESC _` は、その文字 + 0x40 の C1 の制御文字として扱う（`ESC D` は IND と同じ）
  - CSI の `@ A B C D E F G H I J K L M P S T W X Z ` a b d e f g h l m r s u`、`CSI ? … h/l`、`CSI ! p`（DECSTR）。`CSI c` と `CSI n` は §7 の返事。`CSI … t`（xtwinops）は、agg と同じく無視する
  - SGR の 16 色、256 色、RGB（`;` と `:` の書き方）、太字、faint、斜体、下線、点滅、反転、取り消し線と、その解除
  - DEC の mode: 1（DECCKM）、6（DECOM）、7（DECAWM）、25（DECTCEM）、47、1047、1048、1049。ANSI の mode: 4（IRM）、20（LNM）
- セルは、文字、占め方（幅 1、全角の左、全角の右）、pen。pen は、前景色と背景色（無し、256 色の番号、RGB）、強さ（普通、太字、faint）、斜体、下線、取り消し線、点滅、反転。
- カーソルは列と行と見えるかどうか。avt と同じく、最後の列に書いた直後の列は `cols` になる（次の文字で折り返す）。`cursor` の列もそのまま `cols` になりうる（overlay の spec で扱う）。
- 画面は primary と alternate の 2 つ。どちらも scrollback を持たない（agg の `scrollback_limit(0)` と同じ）。
- avt は Apache-2.0。写すのは振る舞いで、golden の表で合わせる。avt のコードを読んで写すときは、module の頭のコメントに出どころを書く（kbdcast の license を決めるときに NOTICE を考える）。

## 7. kbdcast が足すもの

返事（`feed` が返す）:

| 問い合わせ | 返事 |
|---|---|
| DA1（`CSI c`、`CSI 0 c`） | `CSI ? 62 ; 22 c`（VT220、ANSI の色） |
| DSR（`CSI 5 n`） | `CSI 0 n` |
| CPR（`CSI 6 n`） | `CSI <行> ; <列> R`。1 から数える。列は最後の列より右にならない（`cols` のときは `cols`）。DECOM のときは、行をスクロール領域の上端から数える。DECRC で余白の上端より上に戻ったときも、行は 1 より小さくしない |

ほかの問い合わせ（kitty の `CSI ? u`、DA2、XTVERSION、DECRQM、OSC の色の問い合わせ）には答えない。kitty に対応しない端末は `CSI ? u` に答えず、アプリは後に送る DA1 の返事でそれを知る。

`InputModes`（2 の `Key.Encode`）:

- `cursor_keys`: DECCKM（avt の cursor keys mode と同じ）。
- `newline`: LNM（avt の new line mode と同じ）。
- `other_keys`: `CSI > 4 ; n m` の n が 0 なら `Off`、1 なら `On(One)`、2 なら `On(Two)`。`CSI > 4 m` と、引数の無い `CSI > m` は `Off`（xterm の XTMODKEYS と同じ）。ほかの n は無視する。下位の引数（`CSI > 4 : 2 m`）は読まず、各引数の最初の部分だけを見る（この例は `CSI > 4 m` と同じく `Off`）。RIS で `Off` に戻す。DECSTR では変えない。

## 8. 公開 API

```emela
pub opaque type Terminal
pub fn new(cols: Int, rows: Int) -> Terminal               # 1 未満は defect（tape のパーサが先に断る）
pub fn feed(t: Terminal, s: String) -> (Terminal, List[Reply])
pub fn reply_bytes(r: Reply) -> Bytes
pub fn size(t: Terminal) -> (Int, Int)                     # 列と行
pub fn lines(t: Terminal) -> List[List[Cell]]              # 見えている画面の各行のセル
pub fn cursor(t: Terminal) -> Option[(Int, Int)]           # 列と行。見えないときは None（agg と同じ）
pub fn text(t: Terminal) -> String                         # wait が見る文字列
pub fn input_modes(t: Terminal) -> InputModes
```

- `Reply`（`DeviceAttributes | Status | CursorPosition(Int, Int)`。行と列は 1 から）は `Vt.Terminal` に、`Cell` と `Pen` は `Vt.Screen` にある。Emela に再公開が無いので、使う側はそこから import する（friction 012）。
- `text` は、見えている画面（alt screen のときは alternate）の各行の文字をつなぎ、行の末尾の空白（Unicode の White_Space）を除き、行を `\n` でつなぐ。全角の右のセルは飛ばす。折り返した行はつながない。avt の公開の `Vt::text` は alt screen のときも primary を読むが、`wait` は全画面の TUI が alt screen に出すものを見る必要があるので、見えている画面にする。

## 9. テスト

| 対象 | 手法 |
|---|---|
| UTF-8（差分） | brix の pbt で、UTF-8 の境目を狙った bytes（正しい文字、途中で切れた文字、過長、surrogate、範囲外、単独の継続 byte）と分け方を作り、JS の `TextDecoder` と比べる |
| UTF-8（性質） | どこで分けても、1 回で読んだのと同じ |
| 幅 | 生成した表の各範囲の端と、その外の隣。よく使う文字（`a`、`é`、`あ`、`😀`、結合文字） |
| parser（固定） | 文字、C0、ESC、CSI（引数、下位の引数、中間の文字、private の印）、OSC と DCS を捨てること、途中で切れた列、C1 |
| parser（性質） | どこで分けても、続く文字をまとめた action の列が同じ |
| 画面（固定） | 全角の書き込みと上書き、最後の列の全角、消去の範囲と pen、行と文字の挿入と削除、スクロール領域 |
| VT（golden） | `tools/avt-golden/` が書いた `test/vt_golden.emel` の各行で、`new(cols, rows)` に入力を `feed` した画面のスナップショットが、avt のものと一致する。スナップショットの形は harness のコメントのとおり（カーソル、DECCKM、各行のセルと pen） |
| VT（性質） | golden の入力をどこで分けて `feed` しても、画面と返事の列が同じ。カーソルの行は 0 以上 rows 未満、列は 0 以上 cols 以下 |
| 返事と `InputModes`（固定） | §7 の表、modifyOtherKeys の値、RIS、DECSTR |
| `text`（固定） | 末尾の空白、全角、空の行 |

golden の表:

- 手で書いた 42 個の例と、種 20261127 のランダムな 2000 個で、全部で 2042 個。手で書いた例は、計画の 12 個（折り返し、最後の列の全角、全角の右への上書き、DECAWM の解除、スクロール領域、alt screen、insert mode、DEC の罫線、SGR の色、カーソルを隠す、タブ、pen を持つ消去）に、ランダムな部品が作らない入力の 30 個（C1、U+00A0 以上の終わりの文字、`ESC (`/`ESC )` の `0`/`B` 以外、SGR の下位の引数と切れた形、DEC の罫線や最後の列や全角の後の REP、DECOM で余白の上に戻した DECRC、2 つ以上のタブ、余白の外の IL/DL など）を足したもの。ランダムな例は、1〜10 列、1〜6 行の画面に、1〜40 個の部品（文字、全角、結合文字、C0、ESC の列、CSI、DEC と ANSI の mode、SGR、OSC、DCS、壊れた列、C1）をつないだもの。
- harness は種と数を引数で変えられる。表に入れるのは既定の種と数だけで、実装の途中では別の種で多く試してよい（R と同じ探索）。
- avt は `=0.18.0`、unicode-width は `=0.1.14` に固定し、`Cargo.lock` を commit する。
- 試作で確かめた（2026-11-27）: 2012 個の例の表は fmt の後 13,790 行で、`emela fmt --check`、`emela check`、`emela test` は合わせて 0.5 秒。

性能: 80 列 × 24 行の画面に、全画面の描き直し（カーソルの移動、SGR、文字）を 1 MB 分 `feed` して、かかる時間を測り、PR に書く。permanent な test にはしない（壁時計が飛ぶ。friction 032）。10 秒を超えたら、§2 の「画面の持ち方」のとおり書き方を変え、`Array.set` のコピーの数字を friction 024 に足す。

結果（PR #17）:

- golden の 2042 個がすべて avt と一致する。実装の途中に、別の種で 470,000 個を試し、誤りは 0（最初の実装がすべて通った）。
- 速さは、計画の描き直しで 1 MB あたり 0.62〜0.89 秒、REP の多い描き直しで 3.7〜4.2 秒。閾値の内なので、`Vt.Screen.print` は `Array.set` で素直に書いたまま。REP が遅いのは、前のセルを 1 つ読むのに画面全体を List にするため。overlay（4）がセルを 1 つずつ読むときに、`Vt.Screen` にセルを 1 つ読む関数を足す。

## 10. 検査の仕組みとの関係

- wish-first の単位: utf8、width、parser、screen、terminal、vt の公開 API。
- `fails` を宣言する公開 API は無い（`new` の誤りは defect）。`tools/lint/foundation.allow` に足すものは無い見込み。
- 先に予想しておく friction: 1 文字ずつの状態機械を再帰で書く（ループ構文が無い）、`Array.set` のコピー（024）、大きな enum の dispatch、Bytes から文字列への変換、`Char` の literal（013）。→ 結果（PR #17）: String の状態機械は `code_points().fold` で素直に書けたが、Bytes には `fold` が無く `Utf8` は位置で歩く（055）。`Array.set` のコピーは閾値の内で回避は要らず、代わりに Array に範囲の操作が無いことが出た（057）。dispatch は素直な match で書け、苦しさは既存の 013、015、030、038 として出た。予想しなかったものは 056、058、059、060。
- PR を出す前に、別の session で friction-review skill を走らせる。

## 11. 周辺の変更

- AGENTS.md の構成の表: `tools/` に avt の harness を書き足す。
- 全体設計は、この spec と同じ commit で直した（§7 の置き場所、§8 の `Vt.feed(t, String)` と UTF-8 のデコーダ、§11 の VT の行、§14 の Rust の harness、§15 の決定の記録）。

## 12. 完了条件

- root の Pome の `emela test` が通る（golden の全行、性質テスト、固定の例）。
- `mise exec -- bun tools/check.ts --commit --test`、`mise exec -- bun test tools/test`、`mise exec -- prek run --all-files` が通る。
- 1 MB の計測の数字が PR にある。
- 予想した friction と、実際に出た friction がメモになっている。
- friction-review の結果が PR 本文にある。

## 13. リスク

- avt の細部（全角と折り返しの組み合わせ、消去が全角の半分にかかるとき、余白の外のカーソル）が多い。golden の表が正なので、合わなければ avt のコードを読んで合わせる。
- JS で `Array.set` が常にコピーするので、長い cast で遅いかもしれない。§9 の計測で見る。
- agg の次の版（main は avt 0.19.0）で振る舞いが変わるかもしれない。agg の版を上げるときに、harness の avt の版を上げて表を作り直す。

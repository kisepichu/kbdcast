# サブプロジェクト 2: key codec

- 日付: 2026-11-27
- 全体設計: `docs/superpowers/specs/2026-11-23-kbdcast-design.md`（§5 の 2）
- 状態: spec

## 1. 目的と範囲

キーを表す型と、その 3 つの変換を作る。

- 表記: tape の `>` の行に書く vim の表記と `Key` の間の変換。overlay もこの表記でキーを見せる。
- encode: `Key` を、アプリが今有効にしている mode に合わせて、端末がアプリに送る bytes にする。recorder（1）が使う。
- decode: `i` イベントの bytes を `Key` の列に戻す。overlay（4）が使う。

真似る端末は WezTerm の既定の設定（xterm 互換の符号化）とする。kitty keyboard protocol は扱わない。純粋な関数だけで書き、effect を使わない。

## 2. 決めたこと

| 論点 | 決定 | 採らなかった案 |
|---|---|---|
| encode が真似る範囲 | WezTerm の既定と同じ。普通のキー、DECCKM、LNM、xterm の modifyOtherKeys（段階 1 と 2）。VT（3）は kitty の問い合わせに「非対応」と答える | kitty も扱う（flags の扱いが増え、golden に WezTerm の設定の変更が要る）、普通のキーと DECCKM だけ（nvim のデモで `<C-i>` と `<Tab>` を区別して送れない） |
| 今の mode で表せないキー | `Unencodable` で止める。理由に、送れるようになる modifyOtherKeys の段階を入れる | 端末と同じく修飾を落として送る（書いた意図が黙って失われ、overlay に書いたのと違うキーが出る）、落として警告する（警告の経路が増える） |
| overlay の表記 | vim の表記（`print`）をそのまま使う | 2 は vim の表記だけにして見せる形は 4 で決める、2 で人向けの表記も作る |
| 正解 | termwiz 0.22.0（入っている WezTerm 20230712-072601-f4abf8fd が使う encoder）を Rust の harness から呼んで表を生成する | 手で打って録る（Windows 版 WezTerm と WSL の間に ConPTY が入り、録れるのは WezTerm の bytes とは限らない。組み合わせを全部は打てない） |
| encode の作り方 | キーの種類ごとの規則を Emela で書き、生成した表は test だけが読む | 生成した表を src で引く（src に大きな生成物が入り、表せない理由を表から言えない） |
| `<` の扱い | 全体設計 §6 のとおり。`<`、英数字と `-` の並び、`>` の形で名前を知らないもの（`<Ecs>`）は error。この形にならない `<`（`cat < in.txt`）は文字 | 名前にならない `<` をすべて error にする（shell のリダイレクトやヒアドキュメントの `<` を `<lt>` と書くことになる）、vim と同じく文字として送る（`<Ecs>` が黙って 5 文字になる） |
| decode の状態 | 1 つの `i` イベントごとに状態を持たずに読む | 貼り付けのために `Decoder` の状態を持つ（overlay が状態を持ち回る。tape に貼り付けの行は無い） |

## 3. 置き場所

root に最初の Pome を作る。

| 場所 | module | 中身 |
|---|---|---|
| `Pome.toml` | — | `github.com/kisepichu/kbdcast`。`emela` の欄は `mise.toml` で固定した版。依存はテストの brix だけ |
| `src/lib.emel` | `Kbdcast`（library root） | library root として置く。2 では中身を持たない |
| `src/key.emel` | `Key` | `Key`、`KeyCode`、`Mods`、`FKey`、`Decoded` |
| `src/key/notation.emel` | `Key.Notation` | `parse`、`print`、`NotationError` |
| `src/key/encode.emel` | `Key.Encode` | `InputModes`、`encode`、`Unencodable` |
| `src/key/decode.emel` | `Key.Decode` | `decode` |
| `test/` | — | 表記、encode、decode のテストと、生成した `key_golden.emel` |
| `tools/termwiz-golden/` | — | 表を生成する Rust の harness |

型と関数の形は wish で決める。以下の節の書き方は、意味を決めるための仮の形である。

## 4. 型

```emela
pub opaque type Key(code: KeyCode, mods: Mods)
pub enum KeyCode { Char(Int) | Enter | Esc | Tab | Backspace | Delete | Insert
                 | Up | Down | Left | Right | Home | End | PageUp | PageDown | F(FKey) }
pub type Mods(ctrl: Bool, alt: Bool, shift: Bool, super: Bool)
pub opaque type FKey                              # 1 から 12
pub enum Decoded { Key(Key) | Paste(String) | Unknown(Bytes) }
```

- `Char` は、Shift を効かせた後に出る文字の code point を持つ。空白と `<` も `Char` である。
- `Mods` は互いに独立な 4 つの修飾なので、Bool を並べる。super は tape に書けて、`Unencodable` で理由を言うためだけにある。kitty を足すまで送れない。
- `FKey` は 1 から 12。termwiz は F24 まで送れるが、xterm の terminfo は F13 を `<S-F1>` と同じ bytes（`CSI 1;2P`）にしていて紛らわしいので、F13 以降は入れない。

`Key` を作る関数は、次の正規形にそろえる。正規形は termwiz の `KeyCode::encode` が最初に行う正規化と同じである。

- Shift と ASCII の英小文字は、大文字にして Shift を外す（`a` と Shift → `A`）。
- Shift と ASCII の英大文字、ASCII の記号（`is_ascii_punctuation`）は、Shift を外す。
- それ以外（数字、空白、ASCII でない文字、特殊キー）の Shift は残す（`<S-1>`、`<S-Space>`、`<S-Up>`）。
- 制御文字（0x00〜0x1f、0x7f）の `Char` は作らない。§6 の代表のキーにする（0x01 は Ctrl 付きの `a`、0x09 は `Tab`）。
- Ctrl 付きの英大文字は、Ctrl と Shift の両方が押されたことを表す（termwiz も `Char('A')` と Ctrl を `<C-S-a>` として送る）。
- 失敗するのは、scalar value でない code point と、範囲外の F キーだけ。

## 5. 表記

```emela
pub error NotationError(message: String, offset: Int)
pub fn parse(s: String) -> List[Key] fails NotationError
pub fn print(k: Key) -> String
```

- `parse` は `>` の行の内容（区切りの空白の後ろ）を読む。`offset` は `s` の code point の offset で、問題のある `<` を指す。tape のパーサ（1）が行番号と列を足す。
- `<...>` の中の名前と修飾は、大文字と小文字を区別しない。
  - 特殊キーの名前: `CR`（別名 `Enter`、`Return`）、`Esc`、`Tab`、`BS`、`Del`、`Insert`、`Up`、`Down`、`Left`、`Right`、`Home`、`End`、`PageUp`、`PageDown`、`F1`〜`F12`、`Space`、`lt`
  - 修飾: `C-`、`M-`（別名 `A-`）、`S-`、`D-`
- `<C-A>` は `<C-a>` と同じ（vim と同じ）。Ctrl があって Shift が無いとき、英大文字を小文字にしてから正規形にする。`<M-A>` は Alt と `A` で、`<M-a>` と違う。
- `<S-a>` は `A`、`<S-!>` は `!`（§4 の正規形）。
- `<` は、後ろが `(修飾)*名前>` か `(修飾)+1 文字>` の形なら 1 つのキーを始める（`<CR>`、`<C-]>`、`<M-あ>`、`<C->>` も）。そうでなく、後ろが英数字と `-` の並びと `>` なら error（`<Ecs>`、`<C-Foo>`、修飾の無い 1 文字の `<x>`）。どちらでもない `<` は文字（`a < b`、閉じない `<C-x`、`<<EOF`）。
- ほかに error にするもの: 同じ修飾を 2 回（`<C-C-x>`）、範囲外の F キー（`<F13>`）。メッセージは英語。
- `print` は正規の名前を出す。修飾の順は `C-M-S-D-`。
  - 修飾の無い文字はそのまま出す。空白は `<Space>`、`<` は `<lt>`。
  - 修飾のある文字は `<M-x>`、`<C-Space>`、`<M-lt>` の形。Ctrl 付きの英大文字は `<C-S-a>`。
  - 特殊キーは `<CR> <Esc> <Tab> <BS> <Del> <Insert> <Up> <Down> <Left> <Right> <Home> <End> <PageUp> <PageDown> <F1>`〜`<F12>`。

## 6. encode

```emela
pub type InputModes(cursor_keys: CursorKeys, newline: Newline, other_keys: OtherKeys)
pub enum CursorKeys { Normal | Application }     # DECCKM（CSI ? 1 h / l）
pub enum Newline { Cr | CrLf }                   # LNM（CSI 20 h / l）
pub enum OtherKeys { Off | Level1 | Level2 }     # modifyOtherKeys（CSI > 4 ; n m）
pub error Unencodable(key: Key, reason: Reason)
pub enum Reason { NeedsOtherKeys(level) | NeedsKitty }   # level は Level1 か Level2 だけ
pub fn encode(key: Key, modes: InputModes) -> Bytes fails Unencodable
```

- 既定の mode は `Normal`、`Cr`、`Off`。mode を保つのは VT（3）で、encoder は読むだけ。
- `encode` は termwiz 0.22.0 の `KeyCode::encode`（`KeyboardEncoding::Xterm`）と同じ bytes を出す。ただし、出る bytes を decode すると代表に戻らないキーは `Unencodable` にする。
- 修飾の番号は xterm と同じく 1 + Shift(1) + Alt(2) + Ctrl(4)。super は番号に入らないので、super の付いたキーは常に `NeedsKitty`。
- `NeedsOtherKeys` の段階は、ほかの mode を変えずに `other_keys` だけを上げたとき、表せる最小の段階。どの段階でも表せなければ `NeedsKitty`。

キーの種類ごとの形（m は修飾の番号。細部は termwiz を正とし、golden で確かめる）:

| キー | 形 |
|---|---|
| 修飾の無い文字 | UTF-8 |
| Ctrl と文字 | Level2 では `CSI 27;m;c~`。Off と Level1 では、termwiz の `ctrl_mapping` がある文字は制御文字（Alt なら前に ESC）。Ctrl 付きの英大文字は、Level1 で `CSI 27;m;c~`、Off では表せない。`ctrl_mapping` の無い文字は、Alt も付いた ASCII の英数字と記号なら ESC と文字で、Ctrl が落ちるので表せない。それ以外は、Level1 で `CSI 27;m;c~`、Off では表せない |
| Alt と ASCII の英数字、記号（Ctrl なし） | ESC と文字。Shift の残る数字では、どの段階でも Shift が落ちるので `NeedsKitty` |
| ほかの修飾付きの文字（Ctrl なし。Shift の付いた数字、空白、ASCII でない文字） | Level1 と Level2 では `CSI 27;m;c~`。Off では、Alt は ESC を前に付け、Shift は落ちるので表せない |
| 矢印、Home、End | 修飾が無ければ `CSI A`〜`D`、`H`、`F`（`Application` では SS3）。修飾があれば `CSI 1;m A` など |
| Insert、Delete、PageUp、PageDown | `CSI 2~`、`3~`、`5~`、`6~`。修飾があれば `CSI n;m~` |
| F1〜F4 | `SS3 P`〜`S`。修飾があれば `CSI 1;m P`〜`S` |
| F5〜F12 | `CSI 15~`、`17~`〜`21~`、`23~`、`24~`。修飾があれば `CSI n;m~` |
| Tab | 0x09。`other_keys` が Off でなく修飾があれば `CSI 27;m;9~`。Off では、Shift は `CSI Z`、Ctrl は `CSI 9;5u`、Ctrl と Shift は `CSI 1;5Z`、Alt は ESC を前に付ける |
| Enter、Esc | 0x0d（`CrLf` では 0x0d 0x0a）、0x1b。Alt は ESC を前に付ける。Shift か Ctrl があれば、Enter は Level1 から、Esc は Level2 から `CSI 27;m;c~` で、それより下では表せない |
| Backspace | 0x7f。Alt は ESC を前に付ける。Ctrl は Off と Level1 で 0x08、Level2 で `CSI 27;m;8~`。Shift は Level2 で `CSI 27;m;127~`、それより下では表せない |

代表: 同じ制御文字になるキーの組は、1 つの名前（代表）にまとめる。組は termwiz の `ctrl_mapping` の組で、英大文字（Ctrl と Shift）は除く。Level2 では、Ctrl 付きの文字は `CSI 27;m;c~` になって区別できるので、代表は使わない（どのキーも自分自身が代表）。Off と Level1 の代表は次のとおり。

| bytes | 代表 | 同じ組 |
|---|---|---|
| 0x00 | `<C-Space>` | `<C-@>`、`` <C-`> ``、`<C-2>` |
| 0x08、0x7f | `<BS>` | `<C-h>`、`<C-BS>`、`<C-8>`、`<C-?>` |
| 0x09 | `<Tab>` | `<C-i>` |
| 0x0d | `<CR>` | `<C-m>` |
| 0x1b | `<Esc>` | `<C-[>`、`<C-3>`、`<C-{>` |
| 0x1c | `<C-\>` | `<C-4>`、`<C-\|>` |
| 0x1d | `<C-]>` | `<C-5>`、`<C-}>` |
| 0x1e | `<C-^>` | `<C-6>`、`<C-~>` |
| 0x1f | `<C-_>` | `<C-7>`、`<C-/>` |

ほかの制御文字（0x01〜0x1a のうち上に無いもの）は、Ctrl 付きの英小文字だけが同じ組で、それ自身が代表（0x0a は `<C-j>`）。Alt の付いたキーの代表は、Alt を外したキーの代表に Alt を付けたもの。

## 7. decode

```emela
pub fn decode(b: Bytes) -> List[Decoded]
```

失敗しない。1 つの `i` イベントの bytes を、前から次の順に読む。イベントの間で状態を持たない。

1. `CSI 200~ … CSI 201~` は `Paste(text)`。中身が UTF-8 として正しくなければ、全体を `Unknown` にする。終わりの `CSI 201~` が無ければ、残りを全部 `Paste` にする。
2. `ESC [` の後は、引数（0x30〜0x3f）、中間の文字（0x20〜0x2f）、終わりの文字（0x40〜0x7e）という ECMA-48 の形で、1 つの列として切り出す。読める列:
   - `A B C D H F`（矢印、Home、End）、`1;m` が付けば修飾
   - `n ~` と `n;m ~`（Insert、Delete、PageUp、PageDown、F5〜F12）
   - `1;m P`〜`S`（修飾付きの F1〜F4）
   - `Z` は Shift と Tab。`1;m Z` は、m の修飾に Shift を足した Tab
   - `27;m;c ~`（modifyOtherKeys）と、kitty の拡張の無い `c;m u`。c が 9、13、27、127、8 なら Tab、Enter、Esc、Backspace、Backspace。それ以外は `Char(c)`
   - 修飾の番号に、Shift、Alt、Ctrl のほかのビットが立っていたら読めない列とする

   読めない列は、列ごとに `Unknown`。終わりの文字が来ないまま bytes が終わったら、`ESC [` からの残りを `Unknown` にする。ただし `ESC [` だけで終わったら `<M-[>`。
3. `ESC O` の後の `A B C D H F P Q R S` は SS3 の列（矢印、Home、End、F1〜F4）。`ESC O` だけで終わったら `<M-O>`。
4. `ESC` の後に 1 つのキーが続けば、そのキーに Alt を付ける（`ESC x` → `<M-x>`、`ESC 0x01` → `<C-M-a>`、`ESC ESC` → `<M-Esc>`）。末尾の `ESC` だけなら `<Esc>`。
5. 制御文字は §6 の代表にする。0x0d の直後の 0x0a は、その 0x0d に含める（`CrLf` の Enter）。
6. それ以外は UTF-8 として読み、1 つの code point を 1 つの `Char` にする。読めない bytes は、続く分をまとめて 1 つの `Unknown` にする。

1 キーを 1 イベントで送る recorder の出力では、単独の `Esc` と Alt の前置きが区別できる（全体設計 §8）。手で録った長い貼り付けが複数のイベントに割れると、前半は終わりの無い `Paste`、後半は文字と `Unknown` になる。これは受け入れる。

## 8. テスト

| 対象 | 手法 |
|---|---|
| encode と decode（golden） | `tools/termwiz-golden/` が書いた `test/key_golden.emel` の各行で、「`encode` が成功する」と「termwiz の bytes を decode すると `[Key(代表)]` になる」が同じであること。成功したら bytes が termwiz と一致すること。失敗したら理由の段階が、成功する最小の段階であること |
| super | 固定の例。どのキーでも、どの mode でも `NeedsKitty` |
| 表記（性質） | brix の pbt で正規形の `Key` を作り（ASCII でない文字を含む）、`parse(print(k)) == [k]`。正規化を 2 回かけても変わらない |
| encode と decode（性質） | 表せる `k` と mode `m` について `decode(encode(k, m)) == [Key(代表)]`。ASCII でない文字と、Alt と Ctrl と Shift の組を含む |
| 表記（固定） | 別名、大文字と小文字、`<C-A>`、`<S-a>`、文字になる `<`（`a < b`、`<C-x`、`<<EOF`）、error のメッセージと `offset` |
| decode（固定） | 貼り付け（閉じない場合と UTF-8 でない場合）、末尾の ESC、`ESC [` と `ESC O` だけ、読めない CSI、途中で切れた列、正しくない UTF-8、1 つのイベントに複数のキー、CR LF |

golden の表:

- 行は、キー 121 個 × Ctrl、Alt、Shift の組 8 通り × mode 12 通り（DECCKM 2 × LNM 2 × modifyOtherKeys 3）で、約 11,600 行。キーは、ASCII の印字できる文字 95 個（空白を含む）、特殊キー 14 個、F1〜F12。
- harness は、termwiz の `KeyCode::Char(c)` などと `Modifiers` をそのまま渡し、正規化は termwiz に任せる。test の側は同じ入力から `Key` を作るので、正規化の規則（§4）も表で確かめられる。
- termwiz は `=0.22.0` に固定し、`Cargo.lock` を commit する。0.22.0 と main（0.24.0）の `encode` の差は F13〜F24 だけで、`csi_u_encode`、`ctrl_mapping`、`encode_xterm` は同じ（2026-11-27 に確かめた）。
- 真似るのは WezTerm の端末の層（`term/src/terminalstate/keyboard.rs` が termwiz の `encode` を呼ぶ所）だけ。GUI の層が物理キーを `KeyCode` にする部分（Windows の AltGr など）は扱わない。
- Rust の版は `mise.toml` で固定する。`tools/check.ts` は harness を走らせない。`tools/gen-case-folding.ts` と同じく、表は手で作り直して commit する。

## 9. 検査の仕組みとの関係

- wish-first の単位: key、notation、encode、decode。
- 公開 API で `fails` を宣言する `key/notation` と `key/encode` を、理由を付けて `tools/lint/foundation.allow` に登録する。
- root に Pome ができると、`tools/wish.ts` が入れ子の新しい Pome の wish を黙って検査しなくなる（issue #12）。2 の wish はどれも root の `src/` を指すので当たらないが、問題が起き始めるのは 2 からなので、最初の task で直す。
- 先に予想しておく friction: 文字の code point のリテラルが無い（013 と同じ）、正規形を保つ opaque な型と構築関数の書き方、Bytes を 1 byte ずつ読む再帰、生成した大きな表の compile の時間。
- PR を出す前に、別の session で friction-review skill を走らせる。

## 10. 周辺の変更

- `mise.toml` に Rust を足す。
- AGENTS.md の構成の表: `tools/` に Rust の harness を書き足す。
- 全体設計は、この spec と同じ commit で直す。§8 の `InputModes` と kitty の答え、§11 の key codec の golden、§14 の Rust の harness（3 から 2 に前倒し）、§15 の決定の記録。

## 11. 完了条件

- root の Pome の `emela test` が通る（golden の全行、性質テスト、固定の例）。
- `mise exec -- bun tools/check.ts --commit`、`mise exec -- bun test tools/test`、`mise exec -- prek run --all-files` が通る。
- issue #12 が直り、PR で close される。
- 予想した friction と、実際に出た friction がメモになっている。
- friction-review の結果が PR 本文にある。

## 12. リスク

- 約 11,600 行の表を Emela のソースにすると、compile や `emela fmt` が遅くなるかもしれない。遅ければ、キーと修飾ごとに 12 の mode の bytes を 1 行にまとめる（約 970 行）か、mode ごとにファイルを分ける。
- termwiz の細部が §6 の表と違うかもしれない。golden が正なので、違いは表に合わせて §6 を直す。
- 手で録った入力（ConPTY と tmux を通ったもの）は golden に入っていないので、読めない列が `Unknown` になるかもしれない。4 で実際の cast を通すときに見る。

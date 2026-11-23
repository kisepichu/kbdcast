# AGENTS.md

kbdcast は、端末アプリのデモ GIF を、操作を書いた tape から決定的に作るツール。Emela で書き、詰まった所を記録して Emela と ecosystem に返すことも目的にしている。

- 全体設計: `docs/superpowers/specs/2026-11-23-kbdcast-design.md`
- サブプロジェクトの spec と plan: `docs/superpowers/specs/`、`docs/superpowers/plans/`

## 構成

| 場所 | 中身 | `@external` |
|---|---|---|
| `/`（`src/`） | core。純粋な部分と effect を使う部分 | 置かない |
| `regex/` | 汎用の正規表現の Pome | 置かない |
| `pty/` | effect Pty の宣言だけ | 置かない |
| `pty-bun/` | handler BunPty | ここだけ |
| `cli/` | main | 置かない |
| `wish/` | 理想のコード（src の外）。`wish/README.md` | — |
| `friction/` | 回り道の記録。`friction/README.md` | — |
| `tools/` | 検査の道具（Bun 上の TypeScript） | — |

まだ無いディレクトリは、そのサブプロジェクトで作る。

## 規則

### 1. wish-first

新しい単位（モジュール、effect、主要な関数）を書くときは:

1. spec を調べる前に、推測の文法で「こう書きたい」コードを `wish/<name>.emel` に書く。先頭に `# wish-target: <置く予定の repo からの相対パス>` を書く。
2. `bun tools/wish.ts check wish/<name>.emel` を走らせる。診断がファイルの末尾に貼られる。
3. wish だけを commit する。
4. それから spec を調べ、`src/` に実装する。wish と実装が違ったら、その差が回り道かどうかを判断する。

### 2. 黙って回避しない

次のどれかをしたら、それは回り道。止まって記録する。

- 回避のためだけの補助関数を足した
- String を経由して base64 で Bytes を渡した
- UTF-8 を自前で読んだ
- 素直に書けないので、まわりくどい再帰や変換を挟んだ
- Option や Result を握りつぶした
- `@external` を足した
- 普通の処理なのに基盤レベル（`effect`、`handler`、`layer`、`suspend`、`trait`、`impl`、`fails`、`uses`、`@external`、`@export`）を書いた
- wish の書き方が通らず、別の書き方に変えた

記録の手順:

1. 回避したコードに `# FRICTION(NNN)` を付ける（その行か、直前のコメント行）。
2. `friction/NNN-slug.md` を `friction/README.md` の雛形で書く。
3. 迷ったら記録する側に倒す。分類は後で直せる。

### 3. 基盤レベル

core、regex、cli の `src/` で基盤レベルのキーワードを書けるのは、`tools/lint/foundation.allow` に理由と一緒に登録したモジュールだけ。登録するのは、設計として選んだもの（ドメインの port にする effect など）。登録の理由と実際の使い方がずれたら、それも回り道として記録する。

### 4. 検査

- ターンを終える前と commit の前に `mise exec -- bun tools/check.ts` を通す。
- Claude Code と omp の hook が編集のたびとターンの終わりに、prek が commit のたびに、同じ検査を走らせる。hook や prek を止めたり飛ばしたりして通さない。
- `tools/` を変えたら `mise exec -- bun test tools/test` も通す。

## Emela について

- 版は `mise.toml` で固定している（今は 0.28.2）。
- 仕様は `../emela`（emela-lang/emela の checkout）の `spec/` にある。`python3 scripts/spec.py show <name>` で節を引ける。`emela-spec` skill も使える。checkout の版は固定した版とずれることがあるので、違いが効くときは `git -C ../emela show v0.28.2:<path>` で読む。
- 前提（`[intro.premises]`）: 継続は 1 回しか再開できない、変数は不変、ループ構文は無い、高カインド型も演算子オーバーロードも無い。これに反する要望は記録だけして捨てる。
- emela に issue、proposal、PR を出す前に user に確認する。出すときは emela の `AGENTS.md` と `emela-proposal` skill の手順に従う。
- Koka は、苦しい箇所に概念の名前を付けるためだけに小さく書く。Koka で書いて写すことはしない。

## commit

- サブプロジェクトごとに branch を切り、PR を作って merge commit で main に入れる。wish の commit を履歴に残すため squash しない。
- message は `type: 日本語の説明`。type は `feat`、`fix`、`docs`、`chore`、`test`、`refactor`、`wish`。

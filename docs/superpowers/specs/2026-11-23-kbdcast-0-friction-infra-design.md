# サブプロジェクト 0: 回り道を記録する仕組み

- 日付: 2026-11-23
- 全体設計: `docs/superpowers/specs/2026-11-23-kbdcast-design.md` の §12
- 状態: 実装済み（PR #1）

## 1. 目的と範囲

Emela のコードを書き始める前に、回り道を検知して記録する仕組みを置く。検知は agent の自己申告に頼らず、編集のたび（agent の hook）と commit のたび（prek）に同じ検査を機械的に走らせる。

このサブプロジェクトでは Emela のコードも Pome も作らない。作るのは道具、設定、規則の文書だけで、Pome が無い状態でも検査が通るようにする。

## 2. 確かめたこと（2026-11-23）

| 項目 | 結果 |
|---|---|
| mise の `github:emela-lang/emela` | v0.28.0、v0.28.1、v0.28.2 が取れる。attestation と SLSA provenance も検証される |
| 公式の Linux バイナリ | glibc 2.39 の weak シンボル（`pidfd_spawnp`、`pidfd_getpid`）を要求する。この環境（Ubuntu 22.04、glibc 2.35）では、呼ぶたびに `weak version 'GLIBC_2.39' not found` が stderr に出る。`check` と `run` は動く。friction 001 として記録する |
| `[replace]` で兄弟の Pome を参照 | ネットワーク無しで動く。`emela pome install` は replace した依存を含まない lock を書く（`Pome.lock is up to date`）。`emela run` も通る。全体設計 §14 のリスクは解消 |
| root name | 最後の段に小文字が無い source path（`.../b`）は E0235。`pty-bun` は `PtyBun` になる |
| `emela fmt --check` | ある。整形が要るファイルを stdout に出し、1 で終わる |
| Claude Code の hook | PostToolUse で exit 2 にすると、stderr が Claude に見える（ツールは実行済み）。Stop で exit 2 にすると止まらずに続ける。入力の `stop_hook_active` が true なら、既に hook で続けている最中。連続で続けられるのは 8 回まで |
| omp の hook | `.omp/hooks/post/*.ts` に factory を置くと読まれる（`pi.on(...)`）。`tool_result` は `{ additionalContext }` を返せる。`session_stop` は `{ continue: true, additionalContext }` で続けられる（8 回まで）。`pi.exec(command, args, { cwd })` は `{ code, stdout, stderr, killed }` を返す |
| Bun、prek | Bun 1.4.3、prek 0.4.1（mise で入っている） |

## 3. ファイル構成

```text
kbdcast/
├── mise.toml
├── .gitignore
├── AGENTS.md
├── CLAUDE.md                       @AGENTS.md
├── .pre-commit-config.yaml
├── .claude/
│   ├── settings.json               hook
│   └── skills/friction-review -> ../../.agents/skills/friction-review
├── .agents/skills/friction-review/SKILL.md
├── .omp/hooks/post/kbdcast-check.ts
├── friction/
│   ├── README.md                   雛形、状態、番号、分類
│   └── 001-release-binary-glibc.md
├── wish/README.md
└── tools/
    ├── check.ts                    検査の入口
    ├── wish.ts                     wish check
    ├── hooks/claude.ts             Claude Code の hook の入口
    ├── lint/foundation.allow
    ├── lib/
    │   ├── scan.ts                 Emela の字句を最低限読む
    │   ├── lint.ts                 基盤レベルの検出
    │   ├── friction.ts             印とメモの検査
    │   ├── pomes.ts                Pome の発見
    │   ├── emela.ts                emela の呼び出し（001 の filter）
    │   └── report.ts               結果の型と表示
    └── test/*.test.ts
```

全体設計で `tools/check`、`tools/wish check` と書いたものは、`bun tools/check.ts`、`bun tools/wish.ts check` で呼ぶ。全体設計の該当箇所もこの名前に直す。

## 4. 各部品

### 4.1 mise.toml

```toml
[tools]
bun = "1.4.3"
prek = "0.4.1"
"github:emela-lang/emela" = "0.28.2"

[env]
EMELA_JS_HOST = "bun"
```

- Emela の版はここだけに書く。`tools/check.ts` はこの値と `emela --version` を比べる。
- `EMELA_JS_HOST=bun` は、後で使う `Bun.Terminal` に合わせて、今から Bun に揃えておくため。

### 4.2 .gitignore

`tmp/`、`target/`、`.claude/settings.local.json`。

### 4.3 AGENTS.md

日本語で書く。中身:

1. この repo の目的と、全体設計と spec へのリンク
2. 構成（Pome の一覧と、`@external` を置ける場所）
3. 規則
   - wish-first の手順
   - 回り道の定義（例: 回避のためだけの補助関数、String を経由した base64、自前の UTF-8 処理、まわりくどい再帰、Option や Result の握りつぶし、`@external` の追加、基盤レベルの使用）と、見つけたときの手順: 止まる、`FRICTION(NNN)` を付ける、メモを書く
   - 基盤レベルのキーワードは `tools/lint/foundation.allow` に登録したモジュールでだけ使う
   - ターンを終える前と commit の前に、`bun tools/check.ts` を通す
4. Emela の仕様の調べ方（`../emela` の `scripts/spec.py`、`emela-spec` skill）。固定している版と checkout の版がずれうることも書く
5. Koka は概念の名前を得るためだけに使う
6. commit: サブプロジェクトごとに branch を切り、PR を作って merge commit で main に入れる（wish の commit を履歴に残すため squash しない）。メッセージは `type: 日本語の説明`。clone したら一度 `mise install` と `mise exec -- prek install` を走らせる

### 4.4 friction/

- ファイル名は `NNN-slug.md`。NNN は 3 桁の連番で重複させない。slug は小文字と `-`。
- 必須欄: `状態`、`Emela`、`意図`、`こう書きたかった`、`診断`、`回避策`、`コスト`、`spec`、`既存`、`行き先`。空にしない（分からないときは「なし」と書く）。
- 状態は `open`、`filed`、`resolved`、`dropped` のどれか。
- `README.md` に雛形、状態の意味、分類と行き先の表（全体設計 §12）を書く。
- 001 は §2 の glibc の件。行き先は issue（提出前に user に確認する）。

### 4.5 wish/

wish ファイルの先頭に、置く予定の場所を書く。

```emela
# wish-target: src/recorder.emel
```

`mise exec -- bun tools/wish.ts check wish/<name>.emel` は次の手順で動く。

1. 先頭の `# wish-target: <repo からの相対パス>` を読む。無ければエラー。repo の外を指すパス（空、`..` で始まる、絶対パス）もエラー。
2. repo を一時ディレクトリに写す（`.git`、`target`、`tmp`、`node_modules` は除く）。兄弟の Pome への `[replace]` の相対パスが保たれる。
3. wish の本文（下の診断ブロックを除いたもの）を、写した repo の wish-target の位置に書く。
4. wish-target から上にたどって最初の `Pome.toml` を探し、そのディレクトリで `emela pome install`、`emela check` を順に走らせる。一時コピーの根か `/` まで上がっても Pome が見つからなければエラー。
5. 出力（001 の filter をかけたもの）を、wish ファイルの末尾の診断ブロックに書く。既にあれば置き換える。

```emela
# --- wish check (emela 0.28.2) ---
# error[E0412]: ...
# --- end wish check ---
```

一時ディレクトリは最後に消す。`README.md` には、wish は commit してから実装する、という手順も書く。

### 4.6 tools/lib/scan.ts

Emela のソースを読み、コード部分の識別子（`@` 付きの注釈を含む）とコメントを、行番号付きで返す。

- `#` から行末までがコメント（`##` も含む）。
- `"..."` は文字列。`\` の次の 1 文字は読み飛ばす。`#{` から対応する `}` まではコードとして読む。中に文字列や `{}` が入れ子になってもよい。
- `"""` から、行頭の空白の後に `"""` だけがある行までが複数行の文字列。中の `#{...}` は同じくコードとして読む。
- 字句の誤りでは止まらない。lint は emela check の代わりではないので、読めた範囲だけを返す。

### 4.7 tools/lib/lint.ts

- 対象: lint の対象とする Pome（repo の直下、`regex`、`cli` のうち存在するもの）の `src/**/*.emel`。
- 検出するもの: コード部分の識別子 `effect`、`handler`、`layer`、`suspend`、`trait`、`impl`、`fails`、`uses`、注釈 `@external`、`@export`。
- 次のどちらかに当てはまれば違反にしない。
  - ファイルが `tools/lint/foundation.allow` に登録されている。
  - 検出した行か、その直前の空行でない行（コメントだけの行）に、`FRICTION(\d{3})` を含むコメントがある。
- `foundation.allow` の形式: 1 行に 1 つ、`<repo からの相対パス>  # <理由>`。理由が無い行と、存在しないパスはエラー。空行と `#` で始まる行は読み飛ばす。

### 4.8 tools/lib/friction.ts

- メモ: `friction/*.md`（`README.md` を除く）の、ファイル名の形、番号の重複、必須欄、状態の値を検査する。
- 印: repo の `*.emel` と `tools/**/*.ts`（`tools/test` を除く）にある `FRICTION(NNN)` を集め、対応するメモが無ければエラーにする。
- メモの側に印があることは求めない（コードの外の friction もある）。

### 4.9 tools/lib/emela.ts

- `emela` を子プロセスで呼び、`{ code, stdout, stderr }` を返す。
- stderr から、`weak version \`GLIBC_2.39' not found` を含む行を取り除く。この filter には `// FRICTION(001)` を付ける。

### 4.10 tools/check.ts

順に検査し、すべての問題を出してから、1 つでもあれば 1 で終わる。

1. 版: `emela --version` の `X.Y.Z` と、`mise.toml` の固定値を比べる。emela が無ければ `mise install` を勧める。
2. Pome ごと（repo の中で `Pome.toml` があるディレクトリ。`target`、`tmp`、`node_modules`、`.git` の下は除く）に、`emela fmt --check` と `emela check` を走らせる。0 以外で終わったら、その出力をそのまま載せる。
3. lint（4.7）。
4. friction（4.8）。

出力は、問題ごとに `<種類> <path>:<line>: <内容>` の 1 行と、emela の出力のブロック。成功したときは `tools/check: ok` の 1 行だけを出す。

`--commit` を付けると、上の検査に加えて、検査が読んだファイルのうち git が追跡していないもの（`git ls-files --others --exclude-standard`）を「commit に入っていない」と報告する。prek は追跡していないファイルを stash しないので、これが無いと「メモを書いたが `git add` を忘れた」commit が通ってしまう。

### 4.11 hook

Claude Code（`.claude/settings.json`）:

- PostToolUse（matcher `Edit|Write|MultiEdit`）: `bun "$CLAUDE_PROJECT_DIR/tools/hooks/claude.ts" post`。入力の `tool_input.file_path` が `*.emel`、`Pome.toml`、`friction/`、`wish/`、`tools/lint/foundation.allow` のどれかのときだけ検査する。失敗したら出力を stderr に書いて 2 で終わる。
- Stop: `bun "$CLAUDE_PROJECT_DIR/tools/hooks/claude.ts" stop`。`stop_hook_active` が true なら何もせず 0 で終わる（同じ失敗で回り続けないため）。それ以外は検査し、失敗したら stderr に書いて 2 で終わる。

omp（`.omp/hooks/post/kbdcast-check.ts`）:

- `tool_result`: `toolName` が `edit` か `write` で、`event.input` の `path` か `paths` に上と同じ対象が含まれるとき、`bun tools/check.ts` を `pi.exec` で走らせる。失敗したら `{ additionalContext }` で出力を返す。パスが分からないときは走らせる。
- `session_stop`: 検査し、失敗したら `{ continue: true, additionalContext }` を返す。前回と同じ出力なら返さない（同じ失敗で回り続けないため）。

### 4.12 prek

`.pre-commit-config.yaml` の local hook を 2 つ置く。

- `tools-check`: `mise exec -- bun tools/check.ts --commit`。`always_run: true`、`pass_filenames: false`。
- `tools-test`: `mise exec -- bun test tools/test`。`files: ^tools/`、`pass_filenames: false`。tools を変えない commit では Skipped になる。

### 4.13 レビューの skill

`.agents/skills/friction-review/SKILL.md`。別のセッションで、指定した範囲（PR、commit の範囲、ファイル）を読ませ、次のものを探させる。

- wish と実装の差のうち、メモが無いもの
- 臭い: 回避のためだけの補助関数、String を経由した base64、自前の UTF-8 処理、まわりくどい再帰、Option や Result の握りつぶし、目的に合わない型変換、`foundation.allow` の理由と実際の使い方のずれ

見つけたものは、`friction/` に下書きとして書くか、一覧として返す。コードは直さない。

## 5. テスト

`bun test tools/test` で、振る舞いに意味のあるところだけを検査する。

| 対象 | 検査する振る舞い |
|---|---|
| scan | コメントと文字列の中のキーワードを拾わない。`#{...}` の中は拾う。`\#` と `\"` を正しく読み飛ばす。`"""` の中と、その中の `#{...}` |
| lint | 対象の外のファイルは見ない。allowlist で通る。直前の行の `FRICTION` で通り、2 行以上離れていると通らない。`use` と `uses` を区別する。allowlist の理由が無い行と存在しないパスはエラー |
| friction | 番号の重複、必須欄の空、状態の値の誤り、メモの無い印 |
| emela | 001 の filter は該当する行だけを消し、他の stderr は残す |
| check | 版の文字列の読み取り（`emela 0.28.2+9d052d2`）と、`mise.toml` からの固定値の読み取り |

使い捨ての smoke（commit しない）:

- Pome が無い状態で `bun tools/check.ts` が `ok` になる。
- `/tmp` に作った使い捨ての repo 構成で、違反があれば 1 で終わり、allowlist か `FRICTION` を足せば通る。
- `bun tools/wish.ts check` が、使い捨ての wish に診断ブロックを書く。
- `tools/hooks/claude.ts` に PostToolUse と Stop の入力を流し、exit code と stderr を確かめる。
- prek: `prek run --all-files` が通る。

omp の hook はこの session の中では読み込まれないので、型と `bun build` での構文の確認までにする。実際に動くかは、次に omp を起動したときに確かめる。

## 6. 完了条件

- §3 のファイルがすべてあり、`bun test tools/test` と `prek run --all-files` が通る。
- §5 の smoke がすべて期待どおりに動く。
- 全体設計の `tools/check`、`tools/wish check` の表記を直している。
- friction 001 があり、`tools/lib/emela.ts` の `FRICTION(001)` と対応している。

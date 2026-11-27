# 081 replace-per-pome

- 状態: open
- Emela: v0.28.2
- 意図: 1 つの repo の中の Pome（root、`text`、`regex`、`pty`、`pty-bun`、`cli`）を、公開の版でなく手元の path で互いに使う。サブプロジェクト 1 で `pty`、`pty-bun`、`cli` が増え（計画の Task 3、Task 6）、`cli` は root と `pty-bun` に依存し、root は `pty`、`regex`、`text` に、`regex` は `text` に、`pty-bun` は `pty` に依存する
- こう書きたかった:
  path を 1 か所に書き、repo の中のどの Pome を build しても使われる形（Cargo の workspace と `[patch]` を root に 1 つ書く形、npm、pnpm の workspace のつもり）。たとえば root の `Pome.toml` に
  ```toml
  [workspace]
  members = ["text", "regex", "pty", "pty-bun", "cli"]
  ```
  と書き、各 Pome の `Pome.toml` には自分が import する `[dependencies]` だけを書く
- 診断:
  repo の外の使い捨ての Pome での試し（v0.28.2、2026-11-28。`app` は `bee` に、`bee` は `cee` に依存し、`bee` の `Pome.toml` は `cee` の `[replace]` を path で持つ）:
  - `app` の `[replace]` が `bee` だけ: `emela pome install` が ``error: github.com/example/cee: git fetch: remote: Repository not found.`` で止まる（`bee` の `[replace]` は依存される側では読まれないので、`cee` を GitHub から取りに行く）。続く `emela check` は ``error: no Pome.lock; run `emela pome install` ``
  - `app` の `[replace]` に `cee` の行を足す（`[dependencies]` には足さない）: `install` も `check` も通り、`emela run` は `8` を出す。`Pome.lock` に行は増えない（置き換えた依存の hash は lock に書かない）
  - その `app` から `import Cee` と書くと ``error[E0205]: undefined module `Cee` ``（`[dependencies]` に無い Pome は import できない）
- 回避策:
  build する Pome ごとに、下にある path の Pome を全部 `[replace]` に並べ直した: `cli/Pome.toml` に 5 行（root、`pty`、`pty-bun`、`regex`、`text`）、root に 3 行（`pty`、`regex`、`text`）、`regex` に 1 行（`text`）、`pty-bun` に 1 行（`pty`）。`text` の path は 3 つの manifest に、`pty` の path も 3 つに書いてある。設計どおりの書き方なので、印は付けない
  最終レビューの後の修正（manager の Q4 の答え）で、`cli/Pome.toml` の `[dependencies]` から、cli が import しない `pty`、`regex`、`text` の 3 行を消した（計画の Task 6 がそのまま書いた行で、依存の依存は `[replace]` の行だけで足りる）。`[replace]` の 5 行は残した。確かめたこと（2026-11-28）:
  - `cli/` で `mise exec -- emela pome install`: `Pome.lock is up to date`、exit 0。`cli/Pome.lock` は変わらない
  - `cli/` で `mise exec -- emela check .`: 診断なし、exit 0
  - repo の root で `mise exec -- emela run cli -- rec examples/shell.tape > /tmp/shell.cast; echo "exit $?"`: `exit 0`。cast の 1 行目は header（`{"version": 3, "term": {"cols": 40, "rows": 5, "type": "xterm-256color"}, ...}`）で、18 行。`/tmp/shell.cast` は確かめた後に消した
- コスト:
  `[replace]` が 4 つの manifest に計 10 行。Pome を 1 つ足すと、その Pome を下に持つ build する Pome すべての `[replace]` に行を足す（足し忘れると、上の試しのとおり `install` が GitHub を取りに行って止まる。まだ公開していない Pome なので `Repository not found` になり、公開した後なら黙って公開の版を使う [INFERENCE: 公開の版がある場合は試していない]）。消した 3 行は害は無かったが、cli から `pty`、`regex`、`text` を import できる状態にしていた。普段のコードに基盤レベルは漏れていない
- spec: `[module.pome]`（`spec/language/04-modules.md:288`「`[replace]` uses a local directory as that dependency. It takes effect only when building that Pome and is ignored when the Pome is depended on. The hash of a replaced dependency is not written to the lock.」、`:290`「Not included (to be considered in a later version): a workspace that groups multiple Pomes (Bushel)」、`:178`「A module can import only the Pomes listed in its own `[dependencies]`」）
- 既存: 既に知られている制限（`:290` の Bushel）。emela の issue と PR に無い（2026-11-28、`gh search issues --repo emela-lang/emela --include-prs` で「workspace」「Bushel」「replace transitive」「replace path dependency」「replace dependencies of dependencies」を検索。「workspace」の当たりは Cargo の workspace の依存の更新（#610、#612）と compiler の内部の refactor（#924、#929、#930、#939 など）、「Bushel」の当たりは release の PR #36 だけで、別の話題）。サブプロジェクト 1 の spec §11 が予想した friction
- 行き先: 既に知られている制限 → 実際の使い道（1 つの repo に 6 つの Pome、`[replace]` が計 10 行）を添えて issue にする（Bushel の検討の材料）。未提出。出すのは user

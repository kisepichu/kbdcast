# wish

実装する前に書く「こう書きたい」コード。spec を調べる前に、推測の文法で書く。

## 書き方

- ファイルは `wish/<name>.emel`。
- 先頭に、置く予定の場所を repo からの相対パスで書く: `# wish-target: src/recorder.emel`
- 中身は、置く予定のモジュールとして書く（import もそのモジュールから見た形で書く）。

## 検査

`mise exec -- bun tools/wish.ts check wish/<name>.emel`

repo を一時ディレクトリに写し、wish-target の場所に wish を置いて、その Pome で `emela pome install` と `emela check` を走らせる。出力はファイル末尾の `# --- wish check` から `# --- end wish check ---` までのブロックに書かれる。もう一度走らせると、このブロックは置き換わる。元の repo の `src/` は変わらない。

Pome がまだ無ければ、wish check が仮の Pome.toml を置く。wish-target の最初の `src` か `test` の段より前を Pome のディレクトリとし、一時ディレクトリの中にだけ置く（`src` も `test` も無い wish-target は「Pome が無い」エラーになる）。置いたときは、ブロックの最初の行に `# (Pome.toml は wish check が仮に置いた: <dir>/Pome.toml)` と書かれる。

## 手順

1. wish を書いて検査する。
2. wish だけを commit する（`wish: <name> の理想形を書く`）。実装との差を履歴で比べられるようにするため。
3. 実装する。wish と違う書き方になったら、それが回り道かどうかを判断し、回り道なら `friction/` に記録する。

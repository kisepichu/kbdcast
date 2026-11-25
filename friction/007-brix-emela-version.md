# 007 brix-emela-version

- 状態: open
- Emela: v0.28.2
- 意図: text（後の regex も）のテストで brix の `Property.check` と `Gen` を使い、`emela test` と `emela check` の出力に知らない警告を残さない
- こう書きたかった: `emela pome add --dev github:emela-lang/brix` で入る最新の brix（v0.4.0）を、警告なしで使う
- 診断:
  `text/` で `emela check` と `emela test` を呼ぶたびに出る（v0.28.2）:
  ```
  warning[W0203]: `github.com/emela-lang/brix` is written for emela 0.27.0; this is 0.28.2
     ─[ /home/kise/.emela/pomes/github.com/emela-lang/brix@v0.4.0/Pome.toml ]
     = note: it is built anyway; errors inside it may come from changes between the versions
  ```
- 回避策: なし。spec に W0203 を止める設定は見当たらないので、読み流す。text のテストは 0.28.2 でも brix の中でエラーを出さずに通る（7 passed）
- コスト: 呼ぶたびに 5 行（警告の 3 行、空行、`1 warning`）。`tools/check.ts` が失敗したときの出力にも混ざるので、本物の警告を見落としやすい。普段のコードに基盤レベルは漏れていない
- spec: `[module.pome]`（「A dependency for an older minor version is built with a warning」、`spec/language/04-modules.md:238-239`）、`spec/diagnostics.md` の W0203
- 既存:
  brix の最新の tag は v0.4.0（a685c98b、2026-11-08「chore: emela 0.27.0 に上げる（v0.4.0）」）で、main の先頭も同じ commit。main の `Pome.toml` も `emela = "0.27.0"`。brix の issue は無く、PR は Renovate の設定（#1）だけ（`gh api repos/emela-lang/brix/tags` などで確認、2026-11-25）
- 行き先: emela ではなく brix の版の追従 → brix への issue。下書き（未提出。出すのは user）: brix v0.4.0 の `Pome.toml` は `emela = "0.27.0"` なので、emela 0.28.x で brix を dev-dependencies に入れた Pome は `emela check` と `emela test` のたびに W0203 を出す。kbdcast の text Pome は 0.28.2 で `Property.check` と `Gen` を使い、brix の中でエラーは出ていない。`[pome].emela` を 0.28 に上げた版を tag してほしい

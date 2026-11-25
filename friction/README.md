# friction

Emela で回り道をした記録。1 つのファイルに 1 つの論点だけを書く（proposal の「1 draft に 1 決定」に揃える）。

## ファイル

- 名前は `NNN-slug.md`。NNN は 3 桁の連番で重複させない。slug は小文字と `-`。
- コードの回避箇所には `# FRICTION(NNN)` を付ける（その行か、直前のコメント行）。印のある番号にはメモが要る（`tools/check.ts` が検査する）。
- コードの外の friction（道具、ドキュメント）は、印なしでよい。

## 雛形

欄はすべて必須。分からなければ「なし」と書く。値は次の行から字下げして続けてもよい。

```md
# NNN slug

- 状態: open
- Emela: v<mise.toml の版>（見つけたときの版）
- 意図: 何をしたかったか
- こう書きたかった: wish/<name>.emel の該当部分、またはコード
- 診断: 出た診断（E0443 など）
- 回避策: 実際にどう書いたか
- コスト: 行数 / 性能 / 普段のコードに基盤レベルが漏れたか
- spec: 関係する節（[ext.boundary] など）
- 既存: 関係する open question / issue / proposal
- 行き先: 分類と、提出したものへのリンク
```

## 状態

| 状態 | 意味 |
|---|---|
| `open` | 記録しただけ |
| `filed` | issue や proposal などを出した |
| `resolved` | 解消した（版を上げたら書けるようになった、自分の誤解だった、など） |
| `dropped` | 前提（`[intro.premises]`）に反するなどで捨てた。コストの記録は残す |

## 分類と行き先

| 分類 | 行き先 |
|---|---|
| 自分の誤解だった | ドキュメントや診断メッセージの改善（emela の `spec/diagnostics.md`） |
| spec と実装がずれている、またはバグ | issue |
| 既に知られている制限（`open-questions.md`、Known limitations） | 実際の使い道を添えて issue にするか、既存のものに足す |
| 前提の範囲内で spec に足りない | proposal の下書き（emela の `emela-proposal` skill で詰める） |
| ecosystem の Pome（brix、x）に足りない、または版が遅れている | その repo への issue の下書き |
| 前提に反する | 捨てる。コストだけ残す |

emela には agent から issue、proposal、PR、コメントを出さない。行き先が決まったら、出す文面をメモに下書きし、user が自分で出す。

## 見直し

Emela の版を上げたら、`open` と `filed` のメモをすべて見直す。解消したものは `resolved` にする。

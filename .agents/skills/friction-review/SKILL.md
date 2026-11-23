---
name: friction-review
description: kbdcast で、書いた agent とは別のセッションから差分を読み、記録されていない回り道（friction）を探す。PR やまとまった変更の後に使う。
---

# friction-review

書いた側が黙って合わせた箇所を、後から拾うためのレビュー。コードは直さない。

## 入力

レビューする範囲（PR 番号、commit の範囲、ファイル）。指定が無ければ `git log` で直近のまとまりを選び、範囲を明示してから始める。

## 手順

1. `AGENTS.md`、`friction/README.md`、`tools/lint/foundation.allow` を読む。
2. 範囲の差分を読む。範囲で実装した単位ごとに `wish/` の wish を探し、wish と実装を比べる。
3. 次のものを探す。
   - wish と実装の差のうち、friction のメモも説明も無いもの
   - 回避のためだけの補助関数
   - String を経由した base64、自前の UTF-8 処理
   - まわりくどい再帰や変換
   - Option や Result の握りつぶし（既定値での上書きを含む）
   - 目的に合わない型変換
   - `foundation.allow` の理由と実際の使い方のずれ
   - `FRICTION` の印はあるが、メモの内容が実際の回避と合わないもの
4. 見つけたものごとに、場所、何が回り道か、Emela でどう書きたかったはずか、を書く。確信が無いものは「候補」とする。

## 出力

- 見つけたものの一覧を返す。
- user が望めば、`friction/` に下書きを足す（雛形は `friction/README.md`、番号は既存の最大の次）。

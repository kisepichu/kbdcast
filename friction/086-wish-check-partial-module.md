# 086 wish-check-partial-module

- 状態: open
- Emela: v0.28.2
- 意図: wish-first（AGENTS.md 規則 1）で、既にある module に足す単位の wish を `tools/wish.ts check` で検査し、wish の書き方の誤りの診断を見る。サブプロジェクト 4 の cast の reader（`wish/cast_read.emel`、計画の Task 1）は、サブプロジェクト 1 の writer（`Writer`、`writer`、`header`、`event`）がある `src/cast.emel` に足す。brief は、wish に reader の部分だけを書いてよいとした
- こう書きたかった: `wish/cast_read.emel`（`# wish-target: src/cast.emel`。reader の型と関数だけ）の check が、wish の中の誤りの診断だけを返す
- 診断:
  cast の reader の wish check（v0.28.2）: 60 の診断（error 57、warning 3）のうち 17 が、wish の外の module のもの（`wish/cast_read.emel:361-497`）。`src/recorder/live.emel` に 5: ``error[E0212]: module `Cast` has no `Writer` `` と、その後追いの ``error[E0211]: cannot find type `Writer` in this scope``、`writer`、`header`、`event` の E0212。`test/cast_test.emel` に、`event`、`writer`、`header` の E0212 が 12。写しの `src/cast.emel` が wish の本文だけになり、writer が消えたため。ほかに brix の ``warning[W0203]`` が 1（007）。wish そのもの（写しの `src/cast.emel`）の診断は 42（error 40、``warning[W0301]`` 2）
  cli の overlay の wish（`wish/main_overlay.emel`、Task 4）も、`rec` のある `cli/src/main.emel` を overlay の部分だけの wish で置き換えたが、`main` を import する module は無いので、19 の診断はどれも `src/main.emel` のもので、雑音は出なかった。キーの帯（`wish/strip.emel`）と overlay の合成（`wish/overlay.emel`）の wish は新しい file を指すので、起きない
- 回避策: なし。Task 1 は 60 の診断をそのまま commit した。Task 1 で各メモに書いた数（004 の「60 の診断のうち 8」と、016、017、033、051 に足した cast の reader の分）は、60 を分母にしている。60 には wish の外の 17 と W0203 が入っている（数は書き直さない。wish そのものの分母は 42）。道具の friction なので、コードに印は付けない
- コスト: 既にある module の一部だけを書いた wish では、その module を import する module と test の診断が、wish の診断に混ざる（cast の reader では 60 のうち 17）。数を数えるメモでは手で除く必要があり、Task 1 では除かずに書いた。import する所が多い module ほど増える。数え方は、このメモでは warning も含める（cast の reader の 60、overlay の合成の 119 と同じ。キーの帯の 45 は error だけで、W0203 を含めると 46）。普段のコードに基盤レベルは漏れていない
- spec: kbdcast の側だけ。`tools/wish.ts` の `checkWish`（`:65-66`。wish の本文を写しの `<wish-target>` に `writeFileSync` で書くので、既にある file は wish で置き換わる。足す形は選べない）。AGENTS.md 規則 1（wish は「推測の文法で『こう書きたい』コード」で、module の全体を書くとは決めていない）
- 既存: 080（同じ道具の、依存が wish の時点の manifest に無いときの friction）。kbdcast の issue #12（closed。入れ子の新しい Pome の wish が黙って検査されない）と #21（open。080 の仮の Pome の依存）は、別の話題。2026-11-28、`gh issue list --repo kisepichu/kbdcast --state all --search wish` で検索し、一部の wish の話は無かった
- 行き先: kbdcast の道具の friction（emela には出さない）。行き先は `tools/wish.ts`: wish の頭の注釈（`# wish-mode: extend` など）で、wish の本文を既にある module の後ろに足す形を選べるようにするか、置き換えたまま、wish-target の外の file の診断を印を付けた別の組にして書く。kbdcast の issue #24 にした

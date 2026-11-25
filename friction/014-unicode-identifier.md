# 014 unicode-identifier

- 状態: open
- Emela: v0.28.2
- 意図: regex の parser（`regex/src/syntax.emel`）で、ECMAScript の `u` モードの capture group の名前（RegExpIdentifierName）を判定する。最初の文字は ID_Start か `$` か `_`、続く文字は ID_Continue か `$` か ZWNJ か ZWJ で、どれも `\u` の escape で書ける
- こう書きたかった:
  `wish/syntax.emel:238-249` の `group_name`。Unicode の識別子の性質を std の関数で引く
  ```emela
  Some(c) if (acc == [] && Char.is_id_start(c)) || (acc != [] && Char.is_id_continue(c)) ->
    group_name(advance(s, 1), open, [c, ..acc])
  ```
- 診断:
  wish check（v0.28.2）: ``error[E0211]: cannot find module or trait `Char` in this scope`` が 2 つ。Char の型は無く（`[lex.literal]`）、std（v0.28.2 の `crates/emela-core/lib` と `spec/library`）にも、ID_Start、ID_Continue、XID_Start、XID_Continue などの文字の性質を引く関数は無い。`[api.string]` の code point の関数は `code_points` と `from_code_point` だけ
- 回避策:
  manager の判断（kbdcast の `.superpowers/sdd/ESCALATION-2-answer.md`）で、名前は ASCII の `[A-Za-z$_][A-Za-z0-9$_]*` だけを受け付けた。`\u` の escape は、戻した文字がそれに入れば受け付ける（`(?<\u0061\u{62}>x)` の名前は `ab`）。判定は `regex/src/syntax.emel` の `is_name_character`（`FRICTION(014)` の印）
  それ以外の名前は `RegexSyntax(message: "capture group names must be ASCII identifiers", offset: 名前の最初の文字)` で断る。JS で正しい名前（`(?<名前>x)`）と正しくない名前（`(?<1a>x)`、`(?<😀>x)`）を区別できないので、どちらにも当てはまる文にした。不正な pattern を受け付けることはないので、kbdcast の regex の spec（`docs/superpowers/specs/2026-11-25-kbdcast-R-regex-design.md` §6、`u` モードで SyntaxError になる pattern は RegexSyntax にする）には反しない
- コスト:
  受け付ける部分集合が狭まった。JS（Bun 1.4.3 で確かめた）が受け付ける `(?<名前>x)`、`(?<\uD835\uDC9C>x)` などを断る。コードは判定の関数 1 つ（3 行）。正確にするなら、Unicode 17.0 の `DerivedCoreProperties.txt` から ID_Start と ID_Continue の範囲の表を作る生成器（`tools/gen-case-folding.ts` と同じ形）と、表のモジュールと、そのテストが要る。普段のコードに基盤レベルは漏れていない
- spec:
  `[api.string]`、`[lex.literal]`（Char が無い）、`[lex.name]`（Emela の名前は ASCII だけなので、compiler の中にも Unicode の識別子の表が要らない）。ECMA-262 の RegExpIdentifierName と GroupName（22.2.1）、Early Errors（22.2.1.1）
- 既存:
  emela の issue と PR に無い（2026-11-25 に取得した 864 件を、「ID_Start」「ID_Continue」「XID」「identifier」「識別子」で検索。当たったのは別の話題）。`spec/open-questions.md` と `proposals/` にも無い。正確にする版は kbdcast の issue #10（「regex: group の名前に非 ASCII（ID_Start と ID_Continue）を受け付ける」）
- 行き先: 今は出さない。ECMAScript と正確に揃えるときに見直す（kbdcast #10）

# 051 enum-variant-bar

- 状態: open
- Emela: v0.28.2
- 意図: key codec の 4 つの単位（サブプロジェクト 2 の計画の Task 2〜4、6）で、enum の variant を並べる
- こう書きたかった:
  Haskell、OCaml、Elm、F# の `|` で variant を区切った。行の頭に `|` を置く形（OCaml、F#、Elm の 2 つ目からの variant）と、1 行に並べる形の 2 通り
  - 行の頭の `|`: `wish/key.emel:8-10`（`KeyCode`）、`wish/decode.emel:11-12`（`Decoded`）
  - 1 行に並べる: `wish/notation.emel:68`（`enum Modifier { Ctrl | Alt | Shift | Super }`）、`wish/encode.emel:7`、`:9`、`:10`、`:12`、`:18`（`CursorKeys`、`Newline`、`Level`、`OtherKeys`、`Reason`）
  - ストリーム用の UTF-8 デコーダ（サブプロジェクト 3 の計画の Task 1）でも、行の頭の `|`: `wish/utf8.emel:23-25`、`:27`（`Step`。`enum` でなく `type Step =` の後ろに書いた。029）
  ```emela
  pub enum KeyCode {
    Char(Int)
    | Enter | Esc | Tab | Backspace | Delete | Insert
    | F(FKey)
  }
  pub enum Level { One | Two }
  ```
  key codec の design spec（`docs/superpowers/specs/2026-11-27-kbdcast-2-key-codec-design.md` の §7）も `{ Key(Key) | Paste(String) | Unknown(Bytes) }` と書いている
- 診断:
  wish check（v0.28.2）で 16（key 6、notation 1、decode 4、encode 5）。どれも help は付かない
  - 1 行に並べた `|`（notation、encode）: その `|` を指す ``error[E0110]: expected `,` or newline between variants``。何を書けばよいかを言う
  - 行の頭の `|`（key、decode）: その `|` を指す ``error[E0110]: expected variant name``（直し方を言わない）と、続く variant の名前を指す ``error[E0110]: expected `,` or newline between variants`` の 2 つ。2 つ目は、正しい名前の `Enter` や `Paste` を指して、区切りが要ると言う
  repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-27）でも同じ: `pub enum Leading {\n  Up\n  | Down\n}` は `| Down` の `|` に ``E0110: expected variant name``、`Down` に ``E0110: expected `,` or newline between variants``。`Left | Right` と `{ Home | End }` は、`|` に ``E0110: expected `,` or newline between variants`` の 1 つずつ
  行の頭の `|` の後ろの variant の名前は、2 つ目の E0110 を受けるだけで、名前そのものの検査が届かない。使い捨ての Pome の `| F(Int)` でも、`F` には ``expected `,` or newline between variants`` が出るだけで、`|` を消すと出る ``E0110: expected variant name (a type name)``（034）は出ない。key の wish の `F(FKey)` の誤りは、これで実装まで見えなかった（034）
  UTF-8 デコーダの wish check（v0.28.2）では、`type Step =` の `=` で宣言が終わった（029 の E0130 と E0122）ので、4 つの `|` にはどれも診断が届かなかった
- 回避策: 1 行に 1 つの variant を書いた（`src/key.emel`、`src/key/notation.emel`、`src/key/decode.emel`、`src/key/encode.emel`。サブプロジェクト 3 の UTF-8 デコーダの `src/utf8.emel` の `Step` も同じ）。正しい書き方に直しただけなので、コードに印は付けない
- コスト: コードのコストは無い。直すには spec を引く必要があった（行の頭の `|` の診断は、区切りが `,` か改行であることを言わない）。行の頭の `|` は、後ろの名前の診断を隠す（034 の `F`）
- spec: `[grammar.decl]`（`enum_decl = "enum" type_name [ type_params ] "{" variant { sep variant } "}" [ derive ]`、`sep = "," | NL`）、`[data.enum]`、`spec/diagnostics.md` の E0110
- 既存: emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「variant name」「enum variant」「leading bar」「E0110」を検索。当たったのは release の PR と、with の項目や import の別の話題）
- 行き先: 自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: a `|` before a variant (`| Down` on its own line, as OCaml, F# and Elm write it) gets ``E0110: expected variant name`` at the `|`, and then ``E0110: expected `,` or newline between variants`` at the correct name after it. The first could say ``variants are separated by `,` or a newline; there is no `|` before a variant``, and the second should not be reported (the parser could skip the `|` and read the name, so that a wrong name after it, such as `F` in 034, still gets its own diagnostic). A `|` between variants on one line already gets a diagnostic that says what to write

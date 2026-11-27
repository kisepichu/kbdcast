# 067 handler-fields

- 状態: open
- Emela: v0.28.2
- 意図: pty-bun の handler `BunPty`（`pty-bun/src/lib.emel`、サブプロジェクト 1 の計画の Task 3）に、JS の側の端末とプロセス（`Host`）を状態として持たせ、init で作り、release と操作で使う
- こう書きたかった:
  `wish/pty_bun.emel:34-35`、`:43`、`:47`、`:51-52`、`:56`。欄を handler の本体の中に宣言し（Kotlin の class の property、Koka の handler の `val` のつもり）、init は欄の record（056）を返し、release と操作では欄を素の名前で読む
  ```emela
  pub handler BunPty: Pty {
    host: Host

    init(...) { ...; { host: h } }
    release { close(host) }
  ```
- 診断:
  wish check（v0.28.2）は 063 の panic で何も出さなかった。panic の原因の `fails` だけを消した写しの `emela check`（2026-11-28）:
  - 本体の中の `host: Host` に ``error[E0110]: expected `init`, `release`, operation (`fn`) or inner handler (`handler`)``。欄は名前の後ろの括弧に書く、とは言わない
  - 欄を素の名前で読んだ所（`close(host)`、`read_host(host)`、`exit_code(host)`、`write_host(host, b)`）に ``error[E0211]: cannot find value `host` in this scope`` が 4。`self.host` を示す help は付かない（handler の中で、名前が欄の名前と同じなのに）
  - `{ host: h }` は 056 の 3 つと、``error[E0301]: type mismatch: expected `BunPty`, found `()` ``
- 回避策:
  欄を名前の後ろの括弧に書き（`pub handler BunPty(host: Host): Pty`）、init は `BunPty(host:)` を返し、release と操作では `self.host` と書いた（`pty-bun/src/lib.emel`）。spec の決まった形に直しただけなので、コードに印は付けない
- コスト: コードのコストは無い。直すには spec を引く必要があった。普段のコードに基盤レベルは漏れていない
- spec:
  `[effect.handler]`（「A handler with state declares fields after its name. Fields are referenced through `self`, as in `self.conn`.」）、`[module.resolution]`（`self` は操作と release の中で見える。init では見えない）、`[grammar.decl]` の `handler_decl`、`spec/diagnostics.md` の E0110 と E0211
- 既存: emela の issue と PR に無い（2026-11-28、`gh search issues --repo emela-lang/emela --include-prs` で「handler field」「handler fields self」「self handler」「handler state」「E0110 handler」「handler body field」「handler の欄」「欄 self」「handler 状態」「fields after its name」を検索）。当たったのは別の話題: init で handler の値を `Self(...)` と書けるようにする #646、init の中で handler の値を `Self(...)` だけで作る proposal #907（open。`BunPty(host:)` のような handler の名前の構成子は、0.30 までは W4001、0.30 からは E4014 にする案）、with の項目に括弧を付ける案 #904（open）、release の後の handler member の #712 など。欄の宣言の場所や `self` を示す診断の話は無い
- 行き先:
  自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: In a handler body, `name: Type` gets ``E0110: expected `init`, `release`, operation (`fn`) or inner handler (`handler`)``; it could add ``help: a handler declares its fields after its name: `handler H(name: Type): E` ``. Inside the operations and the release of a handler with a field `host`, an unresolved `host` could get ``help: fields are read through self: `self.host` ``

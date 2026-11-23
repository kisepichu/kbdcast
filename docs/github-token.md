# agent 用の gh token

開発中、この端末の gh を kisepichu の repo にしか書けない fine-grained personal access token で認証する。agent が emela-lang などの他の owner の repo に issue、PR、コメントを出そうとしても、GitHub 側で拒まれるようにするため。

## 仕組み

- fine-grained token は、resource owner に選んだ 1 つの user か organization の repo にしか書けない。他の owner の public repo は読めるが、issue や PR を出すことはできない（GitHub Docs「Managing your personal access tokens」）。
- gh は環境変数 `GH_TOKEN` を、保存してある認証より優先する。ただし環境変数は agent が外せるので、保存してある認証そのものをこの token に置き換える。
- emela-lang/emela には push 権限が無い（`gh api repos/emela-lang/emela --jq .permissions` で `push: false`）。そのため SSH の鍵で upstream に push されることも無い。

## 手順（人間が行う）

1. 次の URL で token を作る。名前、owner、期限、権限が入った状態で開く。
   `https://github.com/settings/personal-access-tokens/new?name=agent-kisepichu-only&description=kisepichu+repos+only&target_name=kisepichu&expires_in=90&contents=write&pull_requests=write&issues=write&workflows=write`
   - Repository access は「All repositories」にする（kisepichu の repo だけが対象になる）。
   - Metadata の read は自動で付く。
2. 今の認証を置き換える: `gh auth login --with-token`（標準入力に token を貼り、Enter のあと Ctrl-D）。
3. 確かめる:
   - `gh auth status` の Token が `github_pat_` で始まる。
   - `gh api repos/kisepichu/kbdcast --jq .permissions.push` が `true`。
   - `gh api -X POST repos/emela-lang/emela/issues -f body=probe` が 403（`Resource not accessible by personal access token`）で失敗する。title を付けていないので、権限があっても 422 になるだけで issue は作られない。422 が返ったら token が emela に書ける状態なので、手順 1 からやり直す。

## 自分で emela に出したいとき

web から出すか、一時的に `gh auth login`（ブラウザ）で入り直し、終わったら手順 2 で戻す。

" kbdcast の最小の例: sh に名前を聞かせて答える
set size 40x5
set typing 40ms
run sh -c 'printf "name? "; read name; echo "hi $name"'
wait /name\?
> kbdcast<CR>
wait /hi kbdcast

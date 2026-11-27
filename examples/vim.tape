" vim で 1 行書いて保存する
set size 60x10
set typing 30ms
run vim --clean -n /tmp/kbdcast-example.txt
wait /kbdcast-example
> ihello from kbdcast<Esc>
sleep 300ms
> :wq<CR>

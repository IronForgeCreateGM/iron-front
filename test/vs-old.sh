#!/bin/bash
# test/vs-old.sh N "A" "B" [map] [maxMin] -> parallel runs of test/vs-old.js, W/L summary for side A
n=$1; a=$2; b=$3; m=${4:-classic}; mm=${5:-30}; d=$(dirname $0)
r=$(seq 1 $n | xargs -P ${PAR:-8} -I{} sh -c "node $d/vs-old.js '$a' '$b' \$(( {} * 31 + ${SEED0:-7} )) $m $mm")
echo "$r" >> /tmp/vsold_all.txt; echo "$r"
echo "SUMMARY $a vs $b [$m]: A $(echo "$r" | grep -c ' A ') A(pts) $(echo "$r" | grep -c ' A(pts) ') B $(echo "$r" | grep -c ' B ') B(pts) $(echo "$r" | grep -c ' B(pts) ') T $(echo "$r" | grep -c ' T ')"

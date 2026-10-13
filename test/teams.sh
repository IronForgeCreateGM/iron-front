#!/bin/bash
# test/teams.sh N "A" "B" [map] [maxMin] -> W/L summary for side A
n=$1; a=$2; b=$3; m=${4:-classic}; mm=${5:-40}; d=$(dirname $0)
r=$(seq 1 $n | xargs -P 8 -I{} sh -c "node $d/team.js '$a' '$b' \$(( {} * 31 + 7 )) $m $mm")
echo "$r" > /tmp/teams_last.txt
echo "$a vs $b [$m]: A $(echo "$r" | grep -c ' A') B $(echo "$r" | grep -c ' B') T $(echo "$r" | grep -c ' T ')"

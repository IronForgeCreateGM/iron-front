#!/bin/bash
# head-to-head AI ladder: test/pairs.sh [nseeds] [pairs...]  e.g. si:chief chief:hard
n=${1:-8}; shift; pairs=${@:-"si:chief chief:hard hard:normal normal:easy"}; d=$(dirname $0)
for p in $pairs; do a=${p%%:*}; b=${p##*:}
  r=$(seq 1 $n | xargs -P 8 -I{} sh -c "node $d/one.js $a \$(( {} * 37 + 11 )) $b")
  w=$(echo "$r" | grep -c victory); l=$(echo "$r" | grep -c defeat); t=$(echo "$r" | grep -c timeout)
  echo "$a vs $b: W$w L$l T$t"
done

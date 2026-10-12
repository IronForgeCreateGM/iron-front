#!/bin/bash
# per-game results for a pair: test/detail.sh a b [n]
n=${3:-10}; seq 1 $n | xargs -P 8 -I{} sh -c "node $(dirname $0)/one.js $1 \$(( {} * 37 + 11 )) $2"

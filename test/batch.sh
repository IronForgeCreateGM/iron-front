#!/bin/bash
# usage: SIOFF=.. test/batch.sh who nseeds  -> W/L/T summary
who=$1; n=${2:-10}; d=$(dirname $0)
seq 1 $n | xargs -P 8 -I{} sh -c "node $d/one.js $who \$(( {} * 101 ))" > /tmp/batch_$$.txt
w=$(grep -c victory /tmp/batch_$$.txt); l=$(grep -c defeat /tmp/batch_$$.txt); t=$(grep -c timeout /tmp/batch_$$.txt)
echo "$who SIOFF=$SIOFF: W$w L$l T$t  ($(sort -k2 -n /tmp/batch_$$.txt | awk '{printf "%s:%s@%s ", $2, substr($3,1,1), $4}'))"

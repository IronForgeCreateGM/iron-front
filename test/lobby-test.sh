#!/bin/bash
# lobby/start-position regression (real DOM in headless Chrome)
d=$(cd $(dirname $0)/.. && pwd)
t=$(timeout 300 google-chrome --headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader --virtual-time-budget=60000 --dump-dom "file://$d/index.html?lobbytest=1" 2>/dev/null | grep -o "<title>[^<]*")
echo "$t"; echo "$t" | grep -q "LOBBYTEST OK"

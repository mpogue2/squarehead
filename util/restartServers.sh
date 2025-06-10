#!/bin/bash

# Ensure that there is only 1 VITE and 1 PHP server running

# kill all of the existing servers
pkill -f "node.*vite"
pkill -f "php.*localhost"

# start up just the ones we want (PHP:8000 and VITE:5181)
cd /Users/mpogue/squarehead/backend/public && php -S localhost:8000 &
cd /Users/mpogue/squarehead/frontend && npm run dev &

# And check the results
sleep 3 && lsof -i :5181
lsof -i :8000

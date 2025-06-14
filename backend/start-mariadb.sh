#!/bin/bash
# Start MariaDB with custom data directory on port 3307

# Kill any existing MariaDB on port 3307
pkill -f "port=3307" || true

# Start MariaDB with custom data directory
echo "Starting MariaDB on port 3307 with custom data directory..."
echo "Data directory: /Users/mpogue/squarehead/backend/database/mariadb_data"
echo "==========================================="

/usr/local/Cellar/mariadb/11.7.2/bin/mariadbd-safe \
    --datadir='/Users/mpogue/squarehead/backend/database/mariadb_data' \
    --port=3307 \
    --socket=/tmp/mysql_custom.sock \
    --pid-file=/Users/mpogue/squarehead/backend/database/mariadb_data/custom.pid \
    --log-error=/Users/mpogue/squarehead/backend/database/mariadb_data/error.log &

echo "MariaDB started on port 3307"
echo "Connect using: mysql -u mpogue -P 3307 -S /tmp/mysql_custom.sock"
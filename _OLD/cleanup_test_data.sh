#!/bin/bash

# Cleanup script to remove test reminder data
echo "=== Cleaning up test reminder data ==="

cd /Users/mpogue/squarehead/backend

echo "Removing test user (Mike Pogue)..."
sqlite3 database/squarehead.sqlite "DELETE FROM users WHERE id = 999;"

echo "Removing test schedule assignments..."
sqlite3 database/squarehead.sqlite "DELETE FROM schedule_assignments WHERE id >= 100;"

echo "Resetting modified assignments back to original state..."
sqlite3 database/squarehead.sqlite "
UPDATE schedule_assignments SET squarehead1_id = 111, squarehead2_id = 110 WHERE id = 6;
UPDATE schedule_assignments SET squarehead1_id = NULL WHERE id IN (7, 8);
"

echo "Checking remaining assignments for schedule_id = 2:"
sqlite3 database/squarehead.sqlite "
SELECT 
    sa.id,
    sa.dance_date,
    u1.email as sq1_email,
    u2.email as sq2_email
FROM schedule_assignments sa
LEFT JOIN users u1 ON sa.squarehead1_id = u1.id
LEFT JOIN users u2 ON sa.squarehead2_id = u2.id
WHERE sa.schedule_id = 2 
ORDER BY sa.dance_date;
"

echo "=== Cleanup complete ==="

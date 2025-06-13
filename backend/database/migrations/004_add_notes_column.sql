-- Migration: Add notes column to users table
-- For storing original email addresses and other user notes

-- Simply add the notes column to users table
ALTER TABLE users ADD COLUMN notes TEXT DEFAULT NULL AFTER birthday;

-- For SQLite
-- ALTER TABLE users ADD COLUMN notes TEXT;
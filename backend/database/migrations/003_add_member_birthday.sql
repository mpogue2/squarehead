-- Migration: Add birthday field to users table
-- Created: 2025-06-10

-- Add the birthday field to store month/day in a MM/DD format
ALTER TABLE users ADD COLUMN birthday VARCHAR(5) NULL;

-- Add an index for sorting by birthday
CREATE INDEX idx_birthday ON users(birthday);
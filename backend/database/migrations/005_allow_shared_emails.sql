-- Migration: Allow shared emails between users
-- Removes UNIQUE constraint on email column and adds composite index

-- 1. Remove the UNIQUE constraint from email column
-- We'll drop the existing index first
ALTER TABLE users DROP INDEX email;

-- 2. Create a new composite unique index on first_name, last_name, and email
-- This ensures we can have duplicate emails but not exact duplicate entries
ALTER TABLE users ADD CONSTRAINT unique_name_email UNIQUE (first_name, last_name, email);

-- For SQLite
-- CREATE UNIQUE INDEX unique_name_email ON users (first_name, last_name, email);
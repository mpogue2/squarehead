-- Migration: Change unique constraint from email only to first_name + last_name + email
-- This allows multiple users to share the same email address

-- Drop the existing unique constraint on email
ALTER TABLE users DROP INDEX `email`;

-- Add composite unique constraint on first_name + last_name + email
ALTER TABLE users ADD UNIQUE KEY `unique_user_identity` (`first_name`, `last_name`, `email`);

-- Keep the regular index on email for query performance
-- (The idx_email index already exists, so we don't need to recreate it)
-- Migration: Add latitude and longitude fields to users table for caching
-- Purpose: Cache member address coordinates to avoid repeated geocoding API calls
-- SQLite version

-- Add latitude column
ALTER TABLE users ADD COLUMN latitude REAL;

-- Add longitude column  
ALTER TABLE users ADD COLUMN longitude REAL;

-- Add geocoded_at timestamp column
ALTER TABLE users ADD COLUMN geocoded_at TEXT;

-- Add index for spatial queries if needed later
CREATE INDEX idx_coordinates ON users(latitude, longitude);

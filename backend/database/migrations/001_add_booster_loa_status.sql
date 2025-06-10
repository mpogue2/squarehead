-- Migration: Add Booster and LOA status options
-- Date: 2025-06-08
-- Description: Add 'booster' and 'loa' status options to users table

-- For SQLite (development)
-- Note: SQLite doesn't support ALTER COLUMN with CHECK constraints directly
-- We need to recreate the table to modify the CHECK constraint

BEGIN TRANSACTION;

-- Create temporary table with new status options
CREATE TABLE users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    partner_id INTEGER,
    friend_id INTEGER,
    status TEXT DEFAULT 'assignable' CHECK (status IN ('exempt', 'assignable', 'booster', 'loa')),
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Copy existing data
INSERT INTO users_new SELECT * FROM users;

-- Drop old table and rename new one
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- Recreate indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_partner ON users(partner_id);
CREATE INDEX idx_users_friend ON users(friend_id);

COMMIT;

-- For MySQL/MariaDB (production)
-- Uncomment these lines when deploying to production:

-- ALTER TABLE users MODIFY COLUMN status ENUM('exempt', 'assignable', 'booster', 'loa') DEFAULT 'assignable';

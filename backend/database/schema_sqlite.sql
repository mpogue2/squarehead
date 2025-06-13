-- Square Dance Club Management System - SQLite Schema
-- Created: 2025-06-08

PRAGMA foreign_keys = ON;

-- Users Table: Club members and admin users
CREATE TABLE users (
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
    birthday TEXT,
    notes TEXT,
    latitude REAL,
    longitude REAL,
    geocoded_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_partner ON users(partner_id);
CREATE INDEX idx_users_friend ON users(friend_id);

-- Login Tokens Table: Passwordless authentication
CREATE TABLE login_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_login_tokens_token ON login_tokens(token);
CREATE INDEX idx_login_tokens_user_id ON login_tokens(user_id);
CREATE INDEX idx_login_tokens_expires ON login_tokens(expires_at);

-- Settings Table: Club configuration and preferences
CREATE TABLE settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type TEXT DEFAULT 'string' CHECK (setting_type IN ('string', 'integer', 'boolean', 'json')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_settings_key ON settings(setting_key);

-- Schedules Table: Container for schedule periods
CREATE TABLE schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('current', 'next')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_schedules_type ON schedules(schedule_type);
CREATE INDEX idx_schedules_dates ON schedules(start_date, end_date);
CREATE INDEX idx_schedules_active ON schedules(is_active);

-- Schedule Assignments Table: Individual dance assignments
CREATE TABLE schedule_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER NOT NULL,
    dance_date DATE NOT NULL,
    club_night_type TEXT DEFAULT 'NORMAL' CHECK (club_night_type IN ('NORMAL', 'FIFTH WED')),
    squarehead1_id INTEGER,
    squarehead2_id INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
    FOREIGN KEY (squarehead1_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (squarehead2_id) REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE(schedule_id, dance_date)
);

CREATE INDEX idx_schedule_assignments_schedule ON schedule_assignments(schedule_id);
CREATE INDEX idx_schedule_assignments_date ON schedule_assignments(dance_date);
CREATE INDEX idx_schedule_assignments_squarehead1 ON schedule_assignments(squarehead1_id);
CREATE INDEX idx_schedule_assignments_squarehead2 ON schedule_assignments(squarehead2_id);

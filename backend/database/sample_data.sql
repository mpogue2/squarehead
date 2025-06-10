-- Sample Data for Square Dance Club Management System
-- Created: 2025-06-08

-- Insert default admin user (permanent admin as specified in requirements)
INSERT INTO users (email, first_name, last_name, address, phone, role, status, is_admin) VALUES
('mpogue@zenstarstudio.com', 'Mike', 'Pogue', '123 Admin St, San Jose, CA 95120', '555-0001', 'admin', 'assignable', TRUE);

-- Insert sample club members
INSERT INTO users (email, first_name, last_name, address, phone, role, status, is_admin) VALUES
('john.smith@email.com', 'John', 'Smith', '456 Oak Ave, San Jose, CA 95121', '555-0002', 'member', 'assignable', FALSE),
('jane.doe@email.com', 'Jane', 'Doe', '789 Pine St, San Jose, CA 95122', '555-0003', 'member', 'assignable', FALSE),
('bob.wilson@email.com', 'Bob', 'Wilson', '321 Elm Dr, San Jose, CA 95123', '555-0004', 'member', 'assignable', FALSE),
('alice.brown@email.com', 'Alice', 'Brown', '654 Maple Ln, San Jose, CA 95124', '555-0005', 'member', 'assignable', FALSE),
('charlie.davis@email.com', 'Charlie', 'Davis', '987 Cedar Ct, San Jose, CA 95125', '555-0006', 'member', 'exempt', FALSE),
('diana.miller@email.com', 'Diana', 'Miller', '147 Birch Way, San Jose, CA 95126', '555-0007', 'member', 'assignable', FALSE),
('frank.garcia@email.com', 'Frank', 'Garcia', '258 Spruce Ave, San Jose, CA 95127', '555-0008', 'member', 'assignable', FALSE),
('grace.martinez@email.com', 'Grace', 'Martinez', '369 Willow St, San Jose, CA 95128', '555-0009', 'member', 'assignable', FALSE),
('steve.booster@email.com', 'Steve', 'Booster', '555 Support St, San Jose, CA 95129', '555-0010', 'member', 'booster', FALSE),
('linda.vacation@email.com', 'Linda', 'Vacation', '777 Away Ave, San Jose, CA 95130', '555-0011', 'member', 'loa', FALSE);

-- Set up partner relationships (John & Jane are partners, Bob & Alice are partners)
UPDATE users SET partner_id = (SELECT id FROM users u2 WHERE u2.email = 'jane.doe@email.com') WHERE email = 'john.smith@email.com';
UPDATE users SET partner_id = (SELECT id FROM users u2 WHERE u2.email = 'john.smith@email.com') WHERE email = 'jane.doe@email.com';
UPDATE users SET partner_id = (SELECT id FROM users u2 WHERE u2.email = 'alice.brown@email.com') WHERE email = 'bob.wilson@email.com';
UPDATE users SET partner_id = (SELECT id FROM users u2 WHERE u2.email = 'bob.wilson@email.com') WHERE email = 'alice.brown@email.com';

-- Set up friend relationships (Charlie & Diana prefer to work together)
UPDATE users SET friend_id = (SELECT id FROM users u2 WHERE u2.email = 'diana.miller@email.com') WHERE email = 'charlie.davis@email.com';
UPDATE users SET friend_id = (SELECT id FROM users u2 WHERE u2.email = 'charlie.davis@email.com') WHERE email = 'diana.miller@email.com';

-- Insert default club settings
INSERT INTO settings (setting_key, setting_value, setting_type) VALUES
('club_name', 'Rockin'' Jokers', 'string'),
('club_subtitle', 'SSD/Plus/Round dance club', 'string'),
('club_color', '#EA3323', 'string'),
('club_address', '1919 Gunston Way, San Jose, CA', 'string'),
('club_day_of_week', 'Wednesday', 'string'),
('reminder_days', '14,7,3,1', 'string'),
('club_logo_url', '', 'string'),
('email_template_reminder', 'You are scheduled for squarehead duty on {date}. Thank you for volunteering!', 'string');

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS squarehead;

-- Create user if it doesn't exist
CREATE USER IF NOT EXISTS 'squarehead_user'@'localhost' IDENTIFIED BY 'squarehead_pass123';

-- Grant all privileges on the squarehead database
GRANT ALL PRIVILEGES ON squarehead.* TO 'squarehead_user'@'localhost';

-- Flush privileges to ensure changes take effect
FLUSH PRIVILEGES;

-- Show confirmation
SELECT 'Database and user created successfully!' AS status;
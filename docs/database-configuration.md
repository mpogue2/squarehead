# Database Configuration Guide

This guide explains how to configure the Square Dance Club application to work with both SQLite and MariaDB/MySQL databases in development and production environments.

## Overview

The application supports two database systems:

1. **SQLite** - Simple file-based database (default for development)
2. **MariaDB/MySQL** - Full-featured relational database (recommended for production)

The system automatically detects which database you're using and adjusts SQL syntax accordingly.

## Configuration Settings

Database settings are controlled through environment variables in the `.env` file:

```
# SQLite Configuration
DB_NAME=/absolute/path/to/database.sqlite

# OR MySQL/MariaDB Configuration
DB_NAME=squarehead
DB_HOST=localhost
DB_USER=root
DB_PASS=password
```

## Switching Between Databases in Development

### Option 1: Using SQLite (Default)

1. Edit your `.env` file in the `backend` directory:

```
DB_NAME=/Users/mpogue/squarehead/backend/database/squarehead.sqlite
```

2. Make sure the SQLite file exists or will be created:

```bash
# Check if directory exists
mkdir -p /Users/mpogue/squarehead/backend/database

# Ensure proper permissions
chmod 755 /Users/mpogue/squarehead/backend/database
```

3. Start the backend server:

```bash
cd backend
./run-server.sh
```

### Option 2: Using MariaDB/MySQL

1. First, ensure MariaDB or MySQL is installed and running:

```bash
# For macOS with Homebrew
brew install mariadb
brew services start mariadb

# For Ubuntu/Debian
sudo apt-get install mariadb-server
sudo systemctl start mariadb
```

2. Create the database and user:

```sql
CREATE DATABASE squarehead;
CREATE USER 'squarehead'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON squarehead.* TO 'squarehead'@'localhost';
FLUSH PRIVILEGES;
```

3. Import the schema:

```bash
mysql -u squarehead -p squarehead < backend/database/schema.sql
```

4. Configure the `.env` file:

```
DB_NAME=squarehead
DB_HOST=localhost
DB_USER=squarehead
DB_PASS=your_password
```

5. Start the backend server:

```bash
cd backend
./run-server.sh
```

## Verifying Database Configuration

To check which database system is being used:

1. Start the backend server
2. Visit `http://localhost:8000/db-test.php`

This will show database type, connection settings, and run a simple test query.

## Production Setup with MariaDB/MySQL

For production environments, MariaDB/MySQL is strongly recommended for:
- Better performance with multiple users
- More robust data integrity
- Better backup and restore options
- Scalability

### Step 1: Set Up MariaDB/MySQL Server

```bash
# Install MariaDB (CentOS/RHEL)
sudo yum install mariadb-server
sudo systemctl enable mariadb
sudo systemctl start mariadb

# OR Install MariaDB (Ubuntu/Debian)
sudo apt-get install mariadb-server
sudo systemctl enable mariadb
sudo systemctl start mariadb

# Secure the installation
sudo mysql_secure_installation
```

### Step 2: Create Database and User

```sql
CREATE DATABASE squarehead;
CREATE USER 'squarehead'@'localhost' IDENTIFIED BY 'strong_password_here';
GRANT ALL PRIVILEGES ON squarehead.* TO 'squarehead'@'localhost';
FLUSH PRIVILEGES;
```

### Step 3: Import Schema

```bash
mysql -u squarehead -p squarehead < /path/to/backend/database/schema.sql
```

### Step 4: Configure Environment Variables

Create a `.env` file in the backend directory:

```
# Production environment
APP_ENV=production
APP_URL=https://yourdomain.com

# Database settings
DB_NAME=squarehead
DB_HOST=localhost
DB_USER=squarehead
DB_PASS=strong_password_here

# JWT settings
JWT_SECRET=your_secure_random_string_here

# SMTP settings
MAIL_HOST=your-smtp-server.com
MAIL_PORT=587
MAIL_USERNAME=your-username
MAIL_PASSWORD=your-password
MAIL_FROM=noreply@yourdomain.com
MAIL_FROM_NAME="Square Dance Club"
```

### Step 5: Secure Database Settings

1. Make sure your `.env` file has restricted permissions:

```bash
chmod 600 /path/to/backend/.env
```

2. Ensure the database user has only the necessary privileges

3. Consider using environment variables instead of the `.env` file in production

## Database Migration Process

When switching from SQLite to MariaDB/MySQL with existing data:

1. **Export data from SQLite**:

```bash
cd backend
php utilities/export-sqlite-data.php > data_export.sql
```

2. **Modify exported SQL** (if needed):
   - Replace SQLite-specific syntax with MySQL syntax
   - Adjust data types if necessary

3. **Import to MariaDB/MySQL**:

```bash
mysql -u squarehead -p squarehead < data_export.sql
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Verify the database server is running
   - Check host, port, and credentials
   - Ensure the database exists

2. **Syntax Errors**
   - The application should handle SQL syntax differences automatically
   - If you encounter errors, check the server logs for details
   - Verify the `getDatabaseType()` function in `BaseModel.php` is working correctly

3. **Permission Issues**
   - For SQLite: ensure the web server has read/write access to the database file
   - For MariaDB/MySQL: verify the user has appropriate privileges

### Checking Database Type

Add this code to any PHP file to check which database is being used:

```php
<?php
require_once __DIR__ . '/../vendor/autoload.php';
$db = \App\Database::getConnection();
echo "Database type: " . $db->getAttribute(PDO::ATTR_DRIVER_NAME);
```

## Performance Considerations

### SQLite

- Good for development and small deployments
- Limited concurrency (single writer at a time)
- Simple to set up and back up
- No separate server required

### MariaDB/MySQL

- Better for production and multi-user environments
- Better performance under load
- More advanced features (stored procedures, triggers, etc.)
- Requires more configuration and maintenance

## Backup Strategies

### SQLite Backup

```bash
# Simple file copy
cp /path/to/database.sqlite /path/to/backup/database_$(date +%Y%m%d).sqlite

# Or using sqlite3 CLI
sqlite3 /path/to/database.sqlite ".backup '/path/to/backup/database_$(date +%Y%m%d).sqlite'"
```

### MariaDB/MySQL Backup

```bash
# Full database dump
mysqldump -u squarehead -p --opt squarehead > backup_$(date +%Y%m%d).sql

# Automated backup script
#!/bin/bash
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d)
mysqldump -u squarehead -p --opt squarehead > $BACKUP_DIR/backup_$DATE.sql
gzip $BACKUP_DIR/backup_$DATE.sql
```

## Conclusion

The application is designed to work seamlessly with both SQLite and MariaDB/MySQL databases. SQLite is ideal for development and testing, while MariaDB/MySQL is recommended for production deployments with multiple users.

Always test thoroughly when switching between database systems, as there can be subtle differences in behavior despite our best efforts to abstract these differences away.
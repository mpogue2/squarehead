# Production Database Setup Guide

This guide provides detailed instructions for setting up and configuring a MariaDB/MySQL database for production deployment of the Square Dance Club application.

## Why MariaDB/MySQL for Production?

While SQLite works well for development, MariaDB/MySQL is strongly recommended for production environments because:

1. **Concurrency**: Supports multiple simultaneous users without locking issues
2. **Reliability**: Better crash recovery and data integrity
3. **Performance**: Optimized for larger datasets and higher traffic
4. **Scalability**: Can handle growing user bases and data volumes
5. **Administration**: Better tools for backup, monitoring, and management

## Prerequisites

- A Linux server (Ubuntu/Debian or CentOS/RHEL recommended)
- Root or sudo access
- Basic knowledge of Linux command line
- SSH access to the server

## 1. Install MariaDB Server

### Ubuntu/Debian:

```bash
# Update package lists
sudo apt update

# Install MariaDB server
sudo apt install mariadb-server

# Start and enable MariaDB service
sudo systemctl start mariadb
sudo systemctl enable mariadb

# Secure the installation
sudo mysql_secure_installation
```

### CentOS/RHEL:

```bash
# Install MariaDB server
sudo yum install mariadb-server

# Start and enable MariaDB service
sudo systemctl start mariadb
sudo systemctl enable mariadb

# Secure the installation
sudo mysql_secure_installation
```

During `mysql_secure_installation`, you'll be prompted to:
- Set root password (recommended)
- Remove anonymous users (yes)
- Disallow root login remotely (yes)
- Remove test database (yes)
- Reload privilege tables (yes)

## 2. Create Database and User

Log in to MySQL as root:

```bash
sudo mysql -u root -p
```

Create database and user:

```sql
CREATE DATABASE squarehead CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'squarehead'@'localhost' IDENTIFIED BY 'strong_password_here';

GRANT ALL PRIVILEGES ON squarehead.* TO 'squarehead'@'localhost';

FLUSH PRIVILEGES;

EXIT;
```

**Important**: Replace `'strong_password_here'` with a secure, randomly generated password.

## 3. Import Database Schema

Copy the schema file to the server and import it:

```bash
# Copy schema.sql to server (from your local machine)
scp /path/to/backend/database/schema.sql user@your-server:/tmp/

# Import schema
mysql -u squarehead -p squarehead < /tmp/schema.sql

# Remove temporary file
sudo rm /tmp/schema.sql
```

## 4. Configure Application

### Create and Configure .env File

Create a `.env` file in your backend directory:

```bash
sudo nano /path/to/backend/.env
```

Add the following content:

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

Secure the file:

```bash
sudo chmod 600 /path/to/backend/.env
sudo chown www-data:www-data /path/to/backend/.env  # Assuming Apache/Nginx
```

## 5. Database Security Best Practices

### 1. Restrict Network Access

By default, MariaDB listens only on localhost. Keep this configuration unless remote access is needed:

Check configuration:
```bash
sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf
```

Ensure `bind-address` is set to `127.0.0.1` or `localhost`.

### 2. Limit User Privileges

If you want even tighter security, you can limit the database user to only needed privileges:

```sql
-- Revoke all privileges first
REVOKE ALL PRIVILEGES ON squarehead.* FROM 'squarehead'@'localhost';

-- Grant only specific privileges
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP ON squarehead.* TO 'squarehead'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Regular Backups

Set up automated backups:

```bash
# Create backup script
sudo nano /usr/local/bin/backup-squarehead-db.sh
```

Add the following content:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/squarehead"
MYSQL_USER="squarehead"
MYSQL_PASSWORD="your_password_here"
MYSQL_DATABASE="squarehead"
DATE=$(date +%Y-%m-%d-%H%M)

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Create backup
mysqldump --user=$MYSQL_USER --password=$MYSQL_PASSWORD --opt $MYSQL_DATABASE > $BACKUP_DIR/squarehead_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/squarehead_$DATE.sql

# Delete backups older than 30 days
find $BACKUP_DIR -name "squarehead_*.sql.gz" -mtime +30 -delete
```

Make the script executable:

```bash
sudo chmod +x /usr/local/bin/backup-squarehead-db.sh
```

Add to crontab to run daily:

```bash
sudo crontab -e
```

Add this line:

```
0 2 * * * /usr/local/bin/backup-squarehead-db.sh > /dev/null 2>&1
```

## 6. Performance Tuning

### Basic MariaDB Performance Settings

Edit the MariaDB configuration file:

```bash
sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf
```

Add or modify these settings based on your server's available memory:

For a server with 2GB RAM:
```
# InnoDB settings
innodb_buffer_pool_size = 512M
innodb_log_file_size = 128M

# Query cache
query_cache_size = 32M
query_cache_limit = 1M

# Connection settings
max_connections = 100
```

For a server with 4GB RAM:
```
# InnoDB settings
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M

# Query cache
query_cache_size = 64M
query_cache_limit = 2M

# Connection settings
max_connections = 150
```

Restart MariaDB:

```bash
sudo systemctl restart mariadb
```

## 7. Database Maintenance

### Regular Maintenance Tasks

Create a maintenance script:

```bash
sudo nano /usr/local/bin/maintain-squarehead-db.sh
```

Add this content:

```bash
#!/bin/bash
MYSQL_USER="squarehead"
MYSQL_PASSWORD="your_password_here"
MYSQL_DATABASE="squarehead"

# Optimize tables
mysql --user=$MYSQL_USER --password=$MYSQL_PASSWORD -e "OPTIMIZE TABLE login_tokens, users, schedules, schedule_assignments;" $MYSQL_DATABASE

# Clean up expired login tokens
mysql --user=$MYSQL_USER --password=$MYSQL_PASSWORD -e "DELETE FROM login_tokens WHERE expires_at < NOW();" $MYSQL_DATABASE
```

Make executable and add to weekly crontab:

```bash
sudo chmod +x /usr/local/bin/maintain-squarehead-db.sh

sudo crontab -e
```

Add:
```
0 3 * * 0 /usr/local/bin/maintain-squarehead-db.sh > /dev/null 2>&1
```

## 8. Monitoring and Troubleshooting

### Basic Monitoring

Install mysqladmin:

```bash
sudo apt install mysql-client   # Ubuntu/Debian
sudo yum install mysql          # CentOS/RHEL
```

Check server status:

```bash
mysqladmin -u squarehead -p status
mysqladmin -u squarehead -p processlist
mysqladmin -u squarehead -p extended-status
```

### Common Troubleshooting Commands

Check for slow queries:

```bash
sudo tail -f /var/log/mysql/mariadb-slow.log
```

If slow query log is not enabled, enable it:

```sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL slow_query_log_file = '/var/log/mysql/mariadb-slow.log';
SET GLOBAL long_query_time = 1;
```

## 9. Migrating from SQLite to MariaDB

If you've been using SQLite in development and need to migrate to MariaDB:

1. **Export data from SQLite**:

Create a PHP script to export data:

```php
<?php
// export-data.php
$sqliteDb = new PDO('sqlite:/path/to/development.sqlite');
$tables = $sqliteDb->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")->fetchAll(PDO::FETCH_COLUMN);

foreach ($tables as $table) {
    echo "-- Table: $table\n";
    echo "TRUNCATE TABLE `$table`;\n";
    
    $rows = $sqliteDb->query("SELECT * FROM $table")->fetchAll(PDO::FETCH_ASSOC);
    if (count($rows) > 0) {
        $columns = array_keys($rows[0]);
        $columnList = '`' . implode('`, `', $columns) . '`';
        
        foreach ($rows as $row) {
            $values = array();
            foreach ($row as $value) {
                if ($value === null) {
                    $values[] = 'NULL';
                } else {
                    $values[] = "'" . addslashes($value) . "'";
                }
            }
            echo "INSERT INTO `$table` ($columnList) VALUES (" . implode(', ', $values) . ");\n";
        }
    }
    echo "\n";
}
```

2. **Run the export script**:

```bash
php export-data.php > migration_data.sql
```

3. **Import into MariaDB**:

```bash
mysql -u squarehead -p squarehead < migration_data.sql
```

## 10. Conclusion

Following these steps will give you a secure, well-configured MariaDB database for your production Square Dance Club application. Regular backups and maintenance will help ensure data integrity and optimal performance.

For any database issues in production, always check:
1. Error logs in `/var/log/mysql/error.log`
2. Application logs for database-related errors
3. Database connection settings in your `.env` file

Remember that database security is critical - regularly update passwords, limit access, and ensure backups are working correctly.
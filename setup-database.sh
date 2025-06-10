#!/bin/bash

# Square Dance Club Management System - Database Setup Script
# This script sets up the database for development

echo "🗄️  Setting up Square Dance Club Database..."
echo "=============================================="

# Database configuration
DB_NAME="squarehead_db"
DB_USER="root"
DB_PASS=""
DB_HOST="localhost"

# Check if MySQL/MariaDB is running
echo "Checking MySQL/MariaDB connection..."
if ! mysql -h"$DB_HOST" -u"$DB_USER" ${DB_PASS:+-p"$DB_PASS"} -e "SELECT 1;" >/dev/null 2>&1; then
    echo "❌ Cannot connect to MySQL/MariaDB."
    echo "   Please ensure MySQL/MariaDB is installed and running."
    echo ""
    echo "To install MySQL via Homebrew:"
    echo "   brew install mysql"
    echo "   brew services start mysql"
    echo ""
    echo "Or install MariaDB via Homebrew:"
    echo "   brew install mariadb"
    echo "   brew services start mariadb"
    exit 1
fi

echo "✅ MySQL/MariaDB connection successful"

# Create database
echo "Creating database '$DB_NAME'..."
mysql -h"$DB_HOST" -u"$DB_USER" ${DB_PASS:+-p"$DB_PASS"} -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

if [ $? -eq 0 ]; then
    echo "✅ Database '$DB_NAME' created successfully"
else
    echo "❌ Failed to create database"
    exit 1
fi

# Import schema
echo "Importing database schema..."
mysql -h"$DB_HOST" -u"$DB_USER" ${DB_PASS:+-p"$DB_PASS"} "$DB_NAME" < backend/database/schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Schema imported successfully"
else
    echo "❌ Failed to import schema"
    exit 1
fi

# Import sample data
echo "Importing sample data..."
mysql -h"$DB_HOST" -u"$DB_USER" ${DB_PASS:+-p"$DB_PASS"} "$DB_NAME" < backend/database/sample_data.sql

if [ $? -eq 0 ]; then
    echo "✅ Sample data imported successfully"
else
    echo "❌ Failed to import sample data"
    exit 1
fi

echo ""
echo "🎉 Database setup complete!"
echo "Database: $DB_NAME"
echo "Tables created: users, login_tokens, settings, schedules, schedule_assignments"
echo "Sample data: 9 users (including admin), club settings"
echo ""
echo "Test the database connection:"
echo "curl http://localhost:8000/api/db-test"

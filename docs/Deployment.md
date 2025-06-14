# Squarehead Club Management System Deployment Guide

This document provides step-by-step instructions for deploying the Squarehead application to a web server using FTP. This guide assumes you'll be setting up the database manually using cPanel.

## Prerequisites

- FTP client (FileZilla, Cyberduck, etc.)
- FTP credentials for your web hosting account
- Access to cPanel on your web hosting account
- A domain or subdomain where you'll host the application
- PHP 8.1+ support on your web hosting
- MySQL/MariaDB database available on your hosting

## 1. Database Setup via cPanel

1. **Log in to cPanel** on your web hosting account
2. **Navigate to MySQL Databases** (or MariaDB Databases)
3. **Create a new database**:
   - Enter a name (e.g., `squarehead_db`)
   - Click "Create Database"
4. **Create a database user**:
   - Enter a username (e.g., `squarehead_user`) 
   - Create a strong password and save it securely
   - Click "Create User"
5. **Add the user to the database**:
   - Select the user and database you just created
   - Assign "ALL PRIVILEGES" to the user
   - Click "Add"
6. **Import the database schema**:
   - Go to phpMyAdmin in cPanel
   - Select your newly created database
   - Click on the "Import" tab
   - Upload the `/backend/database/schema.sql` file
   - Click "Go" to execute the import

## 2. Prepare Backend Files

1. **Create `.env` file**:
   - Make a copy of `.env.example` in the `backend` directory
   - Rename it to `.env`
   - Edit the file with your production settings:

```
# Database Configuration
DB_HOST=localhost
DB_NAME=squarehead_db
DB_USER=squarehead_user
DB_PASS=your_secure_password

# JWT Configuration
JWT_SECRET=generate_a_secure_random_string_here

# Email Configuration
MAIL_HOST=your_smtp_host
MAIL_PORT=587
MAIL_USERNAME=your_smtp_username
MAIL_PASSWORD=your_smtp_password
MAIL_FROM=noreply@yourdomain.com
MAIL_FROM_NAME="Your Club Name"

# Application Configuration
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com
```

2. **Build frontend**:
   ```bash
   cd /Users/mpogue/squarehead/frontend
   npm run build
   ```

3. **Prepare production files**:
   - Create a temporary deployment directory
   ```bash
   mkdir -p /Users/mpogue/squarehead/deploy
   mkdir -p /Users/mpogue/squarehead/deploy/public_html
   ```

   - Copy backend files to deployment directory
   ```bash
   cp -r /Users/mpogue/squarehead/backend/* /Users/mpogue/squarehead/deploy/
   cp -r /Users/mpogue/squarehead/backend/.env /Users/mpogue/squarehead/deploy/
   ```
   
   - Copy frontend build to public_html
   ```bash
   cp -r /Users/mpogue/squarehead/frontend/dist/* /Users/mpogue/squarehead/deploy/public_html/
   ```

## 3. Configure Web Server

### Create `.htaccess` Files

1. **Root `.htaccess`** (in the web root directory):
   Create file `/Users/mpogue/squarehead/deploy/public_html/.htaccess`:

```apache
# Frontend routing
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  
  # If the request is for an existing file or directory, serve it directly
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  
  # Send API requests to the backend
  RewriteRule ^api/(.*)$ /api/index.php [L,QSA]
  
  # For everything else, serve the index.html for SPA routing
  RewriteRule ^(.*)$ /index.html [L]
</IfModule>
```

2. **API `.htaccess`** (in the API directory):
   Create file `/Users/mpogue/squarehead/deploy/public_html/api/.htaccess`:

```apache
# Backend API routing
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /api/
  
  # If the request is for an existing file or directory, serve it directly
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  
  # Send all requests to index.php
  RewriteRule ^(.*)$ index.php [L,QSA]
</IfModule>
```

3. **API index.php** (entry point for backend):
   Create file `/Users/mpogue/squarehead/deploy/public_html/api/index.php`:

```php
<?php
// Set the working directory to the backend root
chdir(__DIR__ . '/../../');

// Include the backend index.php file
require 'public/index.php';
```

## 4. Deploy via FTP

1. **Connect to your web hosting via FTP**:
   - Open your FTP client
   - Connect using your FTP credentials
   - Navigate to your web root directory (often `public_html` or `www`)

2. **Upload backend files**:
   - Upload all files from `/Users/mpogue/squarehead/deploy/` to the root directory on your server
   - Make sure to preserve directory structure
   - Skip uploading the `public_html` directory from your local deploy folder

3. **Upload frontend files**:
   - Upload all files from `/Users/mpogue/squarehead/deploy/public_html/` to your web root directory
   - Ensure `.htaccess` files are uploaded (they may be hidden)

4. **Set file permissions**:
   - Set directories to `755` (drwxr-xr-x)
   - Set files to `644` (rw-r--r--)
   - Set the `logs` directory to `775` (drwxrwxr-x) to make it writable
   - Set the `.env` file to `600` (rw-------) for security

## 5. Setup Cron Job for Reminders

1. **Create a shell script wrapper**:
   Create file `/Users/mpogue/squarehead/deploy/send_reminders.sh`:

```bash
#!/bin/bash
cd /path/to/your/app/on/server
php -f public/index.php cron/reminders
```

2. **In cPanel**:
   - Navigate to "Cron Jobs"
   - Add a new cron job to run daily (recommended time: early morning)
   - Set the command to: `/bin/bash /path/to/your/app/on/server/send_reminders.sh`
   - Select the appropriate schedule (e.g., "Once a day at 5:00 AM")
   - Click "Add New Cron Job"

## 6. Post-Deployment Configuration

1. **Create an admin user**:
   - Visit your new site's URL
   - Register a new account with your admin email
   - In phpMyAdmin, find your user in the `users` table
   - Set `is_admin` to `1` and `role` to `"admin"`

2. **Configure application settings**:
   - Log in as admin
   - Go to the Admin page
   - Configure all required settings:
     - Club information (name, address, etc.)
     - Email settings
     - Google Maps API key
     - Email templates

3. **Test key functionality**:
   - Member import
   - Schedule creation
   - Map view
   - Email sending

## 7. Security Considerations

1. **SSL Certificate**:
   - Enable HTTPS for your domain through your hosting provider
   - Many hosts offer free Let's Encrypt certificates

2. **Database Backups**:
   - Set up automated database backups in cPanel
   - Configure the backup frequency in the Admin settings

3. **Update JWT Secret**:
   - Generate a secure random string for JWT_SECRET in your .env file
   - You can use a service like https://generate-random.org/api-key-generator or run:
     ```bash
     openssl rand -hex 32
     ```

4. **Hide Sensitive Files**:
   - Ensure `.env` and other configuration files are not accessible via web
   - Test by trying to access https://your-domain.com/.env

## 8. Production Settings

Make sure these settings are configured for production:

1. **In `.env`**:
   - `APP_ENV=production`
   - `APP_DEBUG=false`
   - Secure JWT secret
   - Proper database credentials
   - Correct SMTP settings

2. **PHP Settings** (if you have access):
   - Set appropriate memory limits
   - Enable opcache for better performance
   - Disable error display (but keep error logging)

## Troubleshooting

### Common Issues

1. **500 Internal Server Error**:
   - Check server error logs in cPanel
   - Ensure file permissions are correct
   - Verify `.htaccess` files are uploaded and formatted correctly

2. **API Connection Errors**:
   - Check that backend paths are correct in `api/index.php`
   - Verify database connection settings
   - Ensure CORS headers are properly set for your domain

3. **Blank Page**:
   - Check for JavaScript errors in browser console
   - Verify all frontend assets were uploaded
   - Check PHP error logs for backend issues

4. **Email Sending Failures**:
   - Verify SMTP settings in the Admin page
   - Test email configuration using the test button
   - Check if your hosting allows outgoing SMTP connections

### Getting Help

For additional assistance:
- Check the application logs in the `logs` directory
- Review PHP error logs in cPanel
- Contact your hosting provider for server-specific issues

## Maintenance

1. **Regular Updates**:
   - When you need to update the application:
     - Build a new frontend distribution
     - Deploy changes following the same process
     - Update database schema if necessary

2. **Database Maintenance**:
   - Periodically check database size and performance
   - Run database optimizations through phpMyAdmin

3. **Monitoring**:
   - Check email delivery reports
   - Monitor disk space usage
   - Review error logs periodically
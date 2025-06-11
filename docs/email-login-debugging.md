# Email Login Debugging Guide

This document provides detailed information on debugging the email login functionality in the Square Dance Club application.

## Recent Fixes

We've made several key improvements to the email login system:

1. **Fixed SQL Syntax**: Updated LoginToken.php to automatically detect database type (SQLite vs MariaDB) and use the appropriate date function (NOW() vs datetime('now'))

2. **Disabled Auto-Login**: Removed development auto-login functionality in authStore.js that was preventing token-based login from working

3. **Enhanced Error Handling**: Added detailed error logging throughout the authentication flow

4. **Improved Token Validation**: Added better debugging for login token validation 

5. **Added Testing Tools**: Created token-test.html and db-test.php for easier debugging

## Debugging Tools

### 1. Token Testing Page

A convenient web interface for testing the login token system is available at:
```
http://localhost:8000/token-test.html
```

This page provides tools to:
- Test the database connection and configuration
- List all active login tokens
- Generate new login tokens for testing
- Validate tokens directly

### 2. Database Testing

To check your database configuration:
```
http://localhost:8000/db-test.php
```

This will return a JSON response with:
- Database type (SQLite or MySQL/MariaDB)
- Current date function being used
- Sample query result
- Connection information

### 3. Token API Endpoints

These development endpoints can help with debugging:

- **List all active tokens**:  
  `GET /api/auth/dev-tokens`

- **Generate a token for an email**:  
  `GET /api/auth/dev-token?email=user@example.com`

- **Validate a token**:  
  `POST /api/auth/validate-token` with body `{"token": "your-token-here"}`

## Common Issues and Solutions

### 1. Token Validation Fails

If token validation fails, check:

- **Database Type**: Ensure the system correctly detects your database type. Check the `/db-test.php` endpoint.
- **Token Expiry**: Tokens expire after 1 hour. Check if the token has expired.
- **Token Already Used**: Each token can only be used once. Check if it's already been used.
- **Database Connection**: Verify the database connection is working.

### 2. Login With Token Doesn't Work

If clicking "Login with token" doesn't work:

- **Check Console**: Look for API errors in your browser console
- **Verify Token**: Use the token test page to verify the token is valid
- **Clear Auth State**: Try clearing your browser's localStorage
- **Disable Auto-Login**: Make sure auto-login is disabled in authStore.js

### 3. Email Sending Fails

If email sending fails:

- **Check SMTP Settings**: Verify your SMTP configuration in the Admin page
- **Check Server Logs**: Look for detailed error messages in the server logs
- **Try Test Script**: Run `php test-email.php your.email@example.com` from backend directory

## How the Login Flow Works

1. **Token Generation**:
   - User enters email address on login page
   - Backend validates email and generates a secure token
   - Token is stored in `login_tokens` table with expiry
   - Email is sent with login link containing token

2. **Token Validation**:
   - User clicks link in email
   - Frontend extracts token from URL
   - Token is sent to backend for validation
   - Backend checks token validity, marks it as used
   - Backend generates JWT token if valid
   - Frontend stores JWT token and user data
   - User is redirected to dashboard

## Technical Details

### Token Storage

Tokens are stored in the `login_tokens` table with these fields:
- `id`: Unique identifier
- `token`: The actual token (64 character random string)
- `user_id`: The ID of the user this token is for
- `expires_at`: When this token expires
- `used_at`: When this token was used (NULL if not used)

### Date Functions

The system automatically detects which date function to use:
- **MySQL/MariaDB**: Uses `NOW()` function
- **SQLite**: Uses `datetime('now')` function

The database type detection is handled in the `BaseModel` class.

## Testing Flows

### Full Email Login Flow

1. Enter your email on the login page
2. Check your email for login link
3. Click the login link
4. You should be logged in and redirected to dashboard

### Direct Token Testing Flow

1. Go to http://localhost:8000/token-test.html
2. Enter an email address to generate a token
3. Use "Validate Token" to test the token directly
4. Use "Open Login URL" to test the full login flow
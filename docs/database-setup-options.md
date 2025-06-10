# Database Setup Options

Since MariaDB setup is proving complex, let's use **SQLite for development** which requires no server setup and is perfect for testing our application structure.

## Option 1: SQLite (Recommended for Development)

### Advantages:
- ✅ No server setup required
- ✅ File-based database (portable)
- ✅ Perfect for development and testing
- ✅ Supported by PHP PDO
- ✅ Easy to reset and recreate

### How to proceed:
1. Update `.env` to use SQLite
2. Convert schema to SQLite format
3. Test database connection
4. Can switch to MySQL/MariaDB later for production

## Option 2: Continue with MariaDB

Would you prefer to:

**A)** Continue with SQLite setup (recommended for now)
**B)** Keep troubleshooting MariaDB setup
**C)** Skip database for now and continue with frontend

SQLite will let us complete the full application development and testing, then we can easily switch to MariaDB for production deployment.

The application code will be identical - only the DSN string changes.

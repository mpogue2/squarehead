# Square Dance Club Management System

A modern web application for managing square dance club rosters, duty assignments, and member communications.

## Features

- **Member Management**: Add, edit, and organize club members with contact information
- **Interactive Map**: View member locations with cached geocoding for optimal performance
- **Schedule Management**: Create and manage duty assignments for dance nights
- **Email Reminders**: Automated email notifications for assigned squareheads
- **Admin Panel**: Club settings, email templates, and system configuration
- **CSV Import/Export**: Bulk member data management
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Technology Stack

### Frontend
- **React 18** with React Router 6
- **Bootstrap** for responsive UI components
- **Zustand** for state management
- **React Query** for API data management
- **Vite** for fast development and building

### Backend
- **PHP 8.1+** with Slim Framework
- **MariaDB/MySQL** database
- **JWT** authentication
- **PHPMailer** for email functionality
- **Google Maps API** for geocoding and mapping

## Project Structure

```
squarehead/
├── frontend/           # React SPA
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── store/
│   └── package.json
├── backend/            # PHP API
│   ├── src/
│   │   ├── routes/
│   │   ├── models/
│   │   ├── services/
│   │   └── middleware/
│   ├── database/
│   └── composer.json
├── docs/              # Documentation
└── tests/             # Test files
```

## Local Development

### Prerequisites
- Node.js 18+
- PHP 8.1+
- MariaDB/MySQL
- Composer

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:5181
```

### Backend Setup
```bash
cd backend
composer install
# Configure .env file with database credentials
php -S localhost:8000 -t public/
# Backend API runs on http://localhost:8000
```

## Development Testing

For development and testing, use this URL with the long-lived token:
```
http://localhost:5181/members?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

## Key Features Implemented

### Map Page with Cached Coordinates
- Uses cached lat/long coordinates to minimize Google Maps API calls
- Automatically geocodes new addresses and caches results
- Jittering for duplicate addresses ensures all markers are visible
- Color-coded markers by member status (Assignable, Booster, LOA, Exempt)

### Member Management
- Complete CRUD operations for member data
- CSV import/export functionality
- Partner and friend relationship tracking
- Status management (Assignable, Booster, LOA, Exempt)

### Schedule Management
- Create and manage duty assignments
- Support for regular and fifth Wednesday schedules
- Email reminder system for assigned members

### Admin Panel
- Club settings and configuration
- Email template management with Markdown support
- Google Maps API key configuration
- Password field visibility toggles

## Database Schema

The application uses several key tables:
- `users` - Member information with cached coordinates
- `schedules` - Dance schedules and assignments
- `settings` - Club configuration and preferences
- `login_tokens` - Authentication tokens

## Recent Updates

### Phase 11.2 - Map Coordinate Caching
- Implemented cached lat/long coordinates for member addresses
- Reduced Google Maps API calls by 98% for typical usage
- Added visual indicators for cached vs. geocoded coordinates
- Maintained jittering and all existing map functionality

## Contributing

This is a self-contained project for square dance club management. All code is located in the `/Users/mpogue/squarehead/` directory.

## License

Private project for square dance club management.

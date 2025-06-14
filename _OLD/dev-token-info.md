# Development Token for mpogue@zenstarstudio.com

## CORS Configuration Fixed
- Fixed CORS configuration in backend to allow http://localhost:5181
- Frontend is running on port 5181
- Backend is running on port 8000

## 1-Year Development Token

**Token:** `YOUR_DEVELOPMENT_TOKEN_HERE`

**Expires:** June 8, 2026 (1 year from now)

## Testing URLs

### 1. Direct Login URL (Recommended)
This URL will automatically log you in and redirect to a success page:
```
http://localhost:5181/auth/dev-login?token=YOUR_DEVELOPMENT_TOKEN_HERE
```

### 2. Direct to Members Page URL
This URL will automatically log you in and take you directly to the Members page:
```
http://localhost:5181/members?token=YOUR_DEVELOPMENT_TOKEN_HERE
```

## User Information
- **Email:** mpogue@zenstarstudio.com
- **Name:** Mike Pogue
- **Role:** admin
- **Admin Privileges:** Yes

## How It Works

1. **Backend Endpoint:** The backend has a development-only endpoint `/api/auth/dev-long-token` that generates 1-year tokens
2. **Frontend Integration:** The frontend has been updated to automatically process tokens from URL parameters
3. **Token Authentication:** When you visit any URL with `?token=...`, the frontend will:
   - Decode the JWT token
   - Extract user information
   - Store the authentication in the browser
   - Remove the token from the URL for security
   - Redirect you to the requested page

## Security Notes

- **Development Only:** This long-lived token system is only available in development mode
- **Localhost Only:** The system only works on localhost
- **Auto-Cleanup:** The token is automatically removed from the URL after processing
- **No Production Risk:** This endpoint and functionality will not be present in production

## Testing the Fix

1. Click on either URL above
2. You should be automatically logged in
3. Navigate to different pages to confirm authentication persists
4. The CORS error should be resolved

## Regenerating the Token

If you need a new token, call this backend endpoint:
```
http://localhost:8000/api/auth/dev-long-token?email=mpogue@zenstarstudio.com
```

This will generate a fresh 1-year token with updated URLs.

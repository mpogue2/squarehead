# Frontend Authentication Testing Instructions

## 🧪 Testing the Authentication Flow:

### 1. **Access Login Page**:
- Open: http://localhost:5174/login
- Should show login form asking for email

### 2. **Test Login Link Request**:
- Enter email: `mpogue@zenstarstudio.com`
- Click "Send Login Link"
- Should show success message

### 3. **Check Backend Log**:
The login token will be logged to the backend console. Look for:
```
LOGIN LINK for mpogue@zenstarstudio.com: http://localhost:8000/auth/login?token=...
```

### 4. **Test Token Validation**:
- Copy the token from the log
- Visit: http://localhost:5174/login?token=e97a8118b58be985badf5010eafef34394d36bfe23d21f4db5f63903deda687f
- Should automatically log you in and redirect to dashboard

### 5. **Verify Authentication State**:
- Should see user info in sidebar: "Mike Pogue" with "Admin" badge
- Should see logout option in sidebar
- Admin-only routes should be accessible

### 6. **Test Route Protection**:
- Try accessing: http://localhost:5174/dashboard (should work when logged in)
- Log out and try same URL (should redirect to login)

### 7. **Test Admin Protection**:
- Admin routes should show "Admin" badge requirement
- Non-admin users should be redirected to dashboard

## 🔧 Current Test Token:
```
e97a8118b58be985badf5010eafef34394d36bfe23d21f4db5f63903deda687f
```

## 📋 Expected Behavior:
- ✅ Login form submission works
- ✅ Token validation and JWT generation
- ✅ Automatic redirect after login
- ✅ User info displayed in sidebar
- ✅ Route protection working
- ✅ Admin-only route protection
- ✅ Logout functionality

This completes the frontend authentication integration!

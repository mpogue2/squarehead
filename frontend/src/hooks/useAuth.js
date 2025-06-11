import { useMutation } from '@tanstack/react-query'
import { apiService } from '../services/api'
import useAuthStore from '../store/authStore'

// Hook for sending login link
export const useSendLoginLink = () => {
  return useMutation({
    mutationFn: (email) => {
      console.log('Sending login link to:', email);
      return apiService.sendLoginLink(email);
    },
    onSuccess: (data) => {
      // Login link sent successfully
      console.log('Login link sent successfully, response:', data);
      
      // For development: If token is included in the response, log it prominently
      if (data.data?.development_only?.token) {
        console.log('%c DEVELOPMENT LOGIN TOKEN', 'background: #222; color: #bada55; font-size: 16px; padding: 5px;');
        console.log('%c ' + data.data.development_only.token, 'background: #222; color: #bada55; font-size: 12px; padding: 5px;');
        console.log('%c LOGIN URL', 'background: #222; color: #bada55; font-size: 16px; padding: 5px;');
        console.log('%c ' + data.data.development_only.login_url, 'background: #222; color: #bada55; font-size: 12px; padding: 5px;');
        
        // Also log as a regular message for environments where styling doesn't work
        console.log('DEVELOPMENT LOGIN TOKEN:', data.data.development_only.token);
        console.log('LOGIN URL:', data.data.development_only.login_url);
      }
    },
    onError: (error) => {
      console.error('Failed to send login link:', error);
      
      // Log more details about the error
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Status:', error.response.status);
        
        // For development: If token is included in the error response, log it prominently
        if (error.response.data?.data?.development_only?.token) {
          console.log('%c DEVELOPMENT LOGIN TOKEN (FROM ERROR RESPONSE)', 'background: #222; color: #FF6347; font-size: 16px; padding: 5px;');
          console.log('%c ' + error.response.data.data.development_only.token, 'background: #222; color: #FF6347; font-size: 12px; padding: 5px;');
          console.log('%c LOGIN URL', 'background: #222; color: #FF6347; font-size: 16px; padding: 5px;');
          console.log('%c ' + error.response.data.data.development_only.login_url, 'background: #222; color: #FF6347; font-size: 12px; padding: 5px;');
        }
      } else if (error.request) {
        console.error('No response received:', error.request);
      } else {
        console.error('Error message:', error.message);
      }
    }
  })
}

// Hook for validating login token
export const useValidateToken = () => {
  const login = useAuthStore((state) => state.login)
  
  return useMutation({
    mutationFn: (token) => {
      console.log('Calling validateToken API with token:', token)
      return apiService.validateToken(token)
    },
    onSuccess: (data) => {
      console.log('Token validation API response:', data)
      
      // Store the JWT token and user data
      if (data.status === 'success') {
        console.log('Login successful, user data:', data.data.user)
        console.log('JWT token received:', data.data.token)
        
        // Log the state before login
        const beforeState = useAuthStore.getState()
        console.log('Auth state before login:', {
          isAuthenticated: beforeState.isAuthenticated,
          hasUser: !!beforeState.user,
          hasToken: !!beforeState.token
        })
        
        // Perform login
        login(data.data.token, data.data.user)
        
        // Log the state after login
        const afterState = useAuthStore.getState()
        console.log('Auth state after login:', {
          isAuthenticated: afterState.isAuthenticated,
          hasUser: !!afterState.user,
          hasToken: !!afterState.token
        })
      } else {
        console.error('Token validation API returned success but status is not "success":', data)
      }
    },
    onError: (error) => {
      console.error('Failed to validate token:', error)
      
      // Log more details about the error
      if (error.response) {
        console.error('Error response data:', error.response.data)
        console.error('Error status:', error.response.status)
      } else if (error.request) {
        console.error('No response received:', error.request)
      } else {
        console.error('Error message:', error.message)
      }
    },
    retry: false // Don't retry failed token validation
  })
}

// Hook for logout
export const useLogout = () => {
  const logout = useAuthStore((state) => state.logout)
  
  const handleLogout = () => {
    logout()
    // Redirect to login or home page
    window.location.href = '/login'
  }
  
  return { logout: handleLogout }
}

// Hook to get current user
export const useCurrentUser = () => {
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isAdmin = useAuthStore((state) => state.isAdmin())
  
  return {
    user,
    isAuthenticated,
    isAdmin
  }
}

// Combined auth hook for convenience
export const useAuth = () => {
  return {
    ...useCurrentUser(),
    ...useLogout(),
    sendLoginLink: useSendLoginLink(),
    validateToken: useValidateToken()
  }
}

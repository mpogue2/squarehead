import { useMutation } from '@tanstack/react-query'
import { apiService } from '../services/api'
import useAuthStore from '../store/authStore'

// Hook for sending login link
export const useSendLoginLink = () => {
  return useMutation({
    mutationFn: (email) => apiService.sendLoginLink(email),
    onSuccess: (data) => {
      // Login link sent successfully
      console.log('Login link sent:', data)
    },
    onError: (error) => {
      console.error('Failed to send login link:', error)
    }
  })
}

// Hook for validating login token
export const useValidateToken = () => {
  const login = useAuthStore((state) => state.login)
  
  return useMutation({
    mutationFn: (token) => apiService.validateToken(token),
    onSuccess: (data) => {
      // Store the JWT token and user data
      if (data.status === 'success') {
        console.log('Login successful:', data.data.user)
        login(data.data.token, data.data.user)
      }
    },
    onError: (error) => {
      console.error('Failed to validate token:', error)
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

import { useEffect } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import useAuthStore from '../store/authStore'

/**
 * Hook to handle authentication token from URL parameters
 * This is useful for development testing and direct login links
 */
export function useTokenAuth() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const { login, isAuthenticated } = useAuthStore()

  useEffect(() => {
    const token = searchParams.get('token')
    
    // Only process token if we're not already authenticated and have a token
    if (!isAuthenticated && token) {
      try {
        // Decode the JWT token to get user info
        const payload = JSON.parse(atob(token.split('.')[1]))
        
        // Create user object from token payload
        const user = {
          id: payload.user_id,
          email: payload.email,
          first_name: payload.first_name || 'Dev',
          last_name: payload.last_name || 'User',
          role: payload.role,
          is_admin: payload.is_admin
        }

        // Set the token in auth store
        login(token, user)
        
        // Remove token from URL for security
        searchParams.delete('token')
        setSearchParams(searchParams, { replace: true })
        
        console.log('Token authentication successful for:', user.email)
        
      } catch (error) {
        console.error('Failed to process token from URL:', error)
        // Remove invalid token from URL
        searchParams.delete('token')
        setSearchParams(searchParams, { replace: true })
      }
    }
  }, [searchParams, setSearchParams, login, isAuthenticated, location.pathname])

  return {
    isProcessingToken: !isAuthenticated && searchParams.has('token')
  }
}

export default useTokenAuth
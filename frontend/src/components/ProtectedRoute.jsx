import React, { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spinner, Container, Alert, Button } from 'react-bootstrap'
import useAuthStore from '../store/authStore'
import useTokenAuth from '../hooks/useTokenAuth'

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isAdmin = useAuthStore((state) => state.isAdmin())
  const initialize = useAuthStore((state) => state.initialize)
  const isTokenValid = useAuthStore((state) => state.isTokenValid)
  const user = useAuthStore((state) => state.user)
  const _hasHydrated = useAuthStore((state) => state._hasHydrated)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const location = useLocation()
  
  // Handle token authentication from URL
  const { isProcessingToken } = useTokenAuth()
  
  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setError(null)
        
        // Development bypass for admin user
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('dev_auth') === 'admin') {
            console.log('Development authentication bypass activated');
            const { login } = useAuthStore.getState();
            login('dev-token-valid', {
              id: 1,
              email: "mpogue@zenstarstudio.com",
              first_name: "Mike",
              last_name: "Pogue",
              role: "admin",
              is_admin: true
            });
            setIsLoading(false);
            return;
          }
        }
        
        // Wait for Zustand to hydrate from localStorage
        const maxWait = 50 // Maximum 5 seconds
        let attempts = 0
        while (!_hasHydrated && attempts < maxWait) {
          await new Promise(resolve => setTimeout(resolve, 100))
          attempts++
        }
        
        console.log('ProtectedRoute: Store hydrated, initializing auth')
        initialize()
        
      } catch (err) {
        setError('Failed to verify authentication status')
        console.error('Auth initialization error:', err)
      } finally {
        setIsLoading(false)
      }
    }
    
    initializeAuth()
  }, [initialize, _hasHydrated])
  
  // Show loading while checking auth state or processing token
  if (isLoading || isProcessingToken) {
    return (
      <Container className="text-center py-5">
        <div className="d-flex flex-column align-items-center">
          <Spinner animation="border" role="status" className="mb-3" />
          <h5>{isProcessingToken ? 'Processing login token...' : 'Checking authentication...'}</h5>
          <p className="text-muted">Please wait while we verify your access.</p>
        </div>
      </Container>
    )
  }
  
  // Show error state
  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger" className="text-center">
          <Alert.Heading>Authentication Error</Alert.Heading>
          <p>{error}</p>
          <Button 
            variant="outline-danger" 
            onClick={() => window.location.reload()}
          >
            <i className="bi bi-arrow-clockwise me-2"></i>
            Retry
          </Button>
        </Alert>
      </Container>
    )
  }
  
  // Check if user is authenticated and token is valid
  if (!isAuthenticated || !isTokenValid()) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  
  // Check admin access if required
  if (adminOnly && !isAdmin) {
    return (
      <Container className="py-5">
        <Alert variant="warning" className="text-center">
          <Alert.Heading>
            <i className="bi bi-shield-exclamation me-2"></i>
            Access Denied
          </Alert.Heading>
          <p>You need administrator privileges to access this page.</p>
          <p className="mb-0">
            <small className="text-muted">
              Logged in as: <strong>{user?.first_name} {user?.last_name}</strong> ({user?.role})
            </small>
          </p>
          <hr />
          <Button variant="outline-warning" as="a" href="/dashboard">
            <i className="bi bi-arrow-left me-2"></i>
            Back to Dashboard
          </Button>
        </Alert>
      </Container>
    )
  }
  
  return children
}

export default ProtectedRoute

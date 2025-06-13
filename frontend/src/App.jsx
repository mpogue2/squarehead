import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'

// Import components
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import ToastProvider from './components/ToastProvider'
import Dashboard from './pages/Dashboard'
import Members from './pages/Members'
import Map from './pages/Map'
import CurrentSchedule from './pages/CurrentSchedule'
import NextSchedule from './pages/NextSchedule'
import Admin from './pages/Admin'
import Login from './pages/Login'
import AuthTest from './pages/AuthTest'
import DevLogin from './pages/DevLogin'
import useAuthStore from './store/authStore'

// Create a client for React Query with enhanced defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 401 (authentication) or 403 (authorization) errors
        if (error?.response?.status === 401 || error?.response?.status === 403) {
          return false
        }
        // Retry up to 2 times for other errors
        return failureCount < 2
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 2 * 60 * 1000, // 2 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      onError: (error) => {
        // Global error handling
        if (error?.response?.status === 401) {
          // Clear auth store and redirect to login
          localStorage.removeItem('auth-storage')
          window.location.href = '/login'
        }
      }
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry mutations on client errors (4xx)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false
        }
        // Retry once for server errors (5xx)
        return failureCount < 1
      },
      onError: (error) => {
        // Global mutation error handling
        console.error('Mutation error:', error)
      }
    },
  },
})

function App() {
  const initialize = useAuthStore((state) => state.initialize)
  
  // Initialize auth state on app startup
  useEffect(() => {
    initialize()
  }, [initialize])
  
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <Router>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              {process.env.NODE_ENV === 'development' && (
                <>
                  <Route path="/auth-test" element={<AuthTest />} />
                  <Route path="/auth/dev-login" element={<DevLogin />} />
                </>
              )}
              
              {/* Protected routes with layout */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="members" element={<Members />} />
                <Route path="map" element={<Map />} />
                <Route path="current-schedule" element={<CurrentSchedule />} />
                <Route path="next-schedule" element={<NextSchedule />} />
                
                {/* Admin-only routes */}
                <Route path="admin" element={
                  <ProtectedRoute adminOnly>
                    <Admin />
                  </ProtectedRoute>
                } />
              </Route>
              
              {/* 404 route */}
              <Route path="*" element={
                <div className="container text-center py-5">
                  <div className="row justify-content-center">
                    <div className="col-md-6">
                      <div className="mb-4">
                        <i className="bi bi-compass display-1 text-muted"></i>
                      </div>
                      <h1 className="mb-3">Page Not Found</h1>
                      <p className="text-muted mb-4">
                        The page you're looking for doesn't exist.
                      </p>
                      <a href="/dashboard" className="btn btn-primary">
                        <i className="bi bi-house-door me-2"></i>
                        Go to Dashboard
                      </a>
                    </div>
                  </div>
                </div>
              } />
            </Routes>
          </Router>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App

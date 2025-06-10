import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import api from '../services/api'

function DevLogin() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [status, setStatus] = useState('processing')
  const [message, setMessage] = useState('Processing login token...')

  useEffect(() => {
    const token = searchParams.get('token')
    
    if (!token) {
      setStatus('error')
      setMessage('No token provided')
      return
    }

    // Use the token to validate and get user info
    const processToken = async () => {
      try {
        // Try to decode the JWT token to get user info
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
        
        setStatus('success')
        setMessage('Login successful! Redirecting...')
        
        // Redirect to members page after a short delay
        setTimeout(() => {
          navigate('/members')
        }, 1500)
        
      } catch (error) {
        console.error('Token processing error:', error)
        setStatus('error')
        setMessage('Invalid token format')
      }
    }

    processToken()
  }, [searchParams, login, navigate])

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6">
            <div className="card shadow">
              <div className="card-body text-center p-5">
                <div className="mb-4">
                  {status === 'processing' && (
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  )}
                  {status === 'success' && (
                    <i className="bi bi-check-circle-fill text-success display-4"></i>
                  )}
                  {status === 'error' && (
                    <i className="bi bi-exclamation-triangle-fill text-danger display-4"></i>
                  )}
                </div>
                
                <h2 className="mb-3">
                  {status === 'processing' && 'Processing Login'}
                  {status === 'success' && 'Login Successful'}
                  {status === 'error' && 'Login Failed'}
                </h2>
                
                <p className="text-muted mb-4">{message}</p>
                
                {status === 'error' && (
                  <div className="d-grid gap-2">
                    <button 
                      className="btn btn-primary"
                      onClick={() => navigate('/login')}
                    >
                      Go to Login Page
                    </button>
                    <button 
                      className="btn btn-outline-secondary"
                      onClick={() => navigate('/dashboard')}
                    >
                      Go to Dashboard
                    </button>
                  </div>
                )}
                
                {status === 'success' && (
                  <div className="progress">
                    <div 
                      className="progress-bar progress-bar-striped progress-bar-animated" 
                      role="progressbar" 
                      style={{ width: '100%' }}
                    ></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DevLogin
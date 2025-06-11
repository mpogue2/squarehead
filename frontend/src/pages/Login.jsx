import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap'
import { useSendLoginLink, useValidateToken } from '../hooks/useAuth'
import useAuthStore from '../store/authStore'

const Login = () => {
  const [email, setEmail] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const tokenValidated = useRef(false) // Guard to prevent double validation
  
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const sendLoginLink = useSendLoginLink()
  const validateToken = useValidateToken()
  
  // Check for login token in URL
  useEffect(() => {
    const token = searchParams.get('token')
    if (token && !tokenValidated.current) {
      console.log('Token found in URL:', token)
      console.log('Current auth state:', {
        isAuthenticated,
        tokenValidated: tokenValidated.current
      })
      tokenValidated.current = true // Mark as validated to prevent double calls
      
      // Clear any existing auth before validating new token
      if (isAuthenticated) {
        console.log('Clearing existing authentication before validating new token')
        useAuthStore.getState().logout()
      }
      
      console.log('Validating token...')
      validateToken.mutate(token)
    }
  }, [searchParams, isAuthenticated])
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])
  
  // Redirect after successful token validation
  useEffect(() => {
    if (validateToken.isSuccess) {
      console.log('Token validation successful, redirecting...')
      
      // Log current auth state before redirect
      const authState = useAuthStore.getState()
      console.log('Auth state before redirect:', {
        isAuthenticated: authState.isAuthenticated,
        hasUser: !!authState.user,
        hasToken: !!authState.token,
        user: authState.user
      })
      
      // Ensure we have authenticated state before redirecting
      if (authState.isAuthenticated && authState.token) {
        console.log('Redirecting to dashboard...')
        navigate('/dashboard')
      } else {
        console.error('Token validation successful but auth state is not set correctly')
        
        // Try setting the auth state again
        console.log('Attempting to set auth state again...')
        if (validateToken.data?.status === 'success') {
          authState.login(
            validateToken.data.data.token,
            validateToken.data.data.user
          )
          
          // Log the state again
          setTimeout(() => {
            const newAuthState = useAuthStore.getState()
            console.log('Auth state after manual update:', {
              isAuthenticated: newAuthState.isAuthenticated,
              hasUser: !!newAuthState.user,
              hasToken: !!newAuthState.token
            })
            
            // Now redirect
            navigate('/dashboard')
          }, 100)
        }
      }
    }
  }, [validateToken.isSuccess, navigate])
  
  const handleSubmit = (e) => {
    e.preventDefault()
    if (email) {
      sendLoginLink.mutate(email, {
        onSuccess: () => {
          setShowSuccess(true)
        }
      })
    }
  }
  
  // If validating token from URL
  if (searchParams.get('token')) {
    return (
      <Container className="mt-5">
        <Row className="justify-content-center">
          <Col md={6}>
            <Card>
              <Card.Body className="text-center py-5">
                {validateToken.isPending && (
                  <>
                    <Spinner animation="border" role="status" className="mb-3" />
                    <h4>Logging you in...</h4>
                    <p>Please wait while we verify your login link.</p>
                  </>
                )}
                
                {validateToken.isError && (
                  <>
                    <Alert variant="danger">
                      <Alert.Heading>Login Failed</Alert.Heading>
                      <p>The login link is invalid or has expired.</p>
                      <p>Please request a new login link below.</p>
                    </Alert>
                    <Button 
                      variant="primary" 
                      onClick={() => window.location.href = '/login'}
                    >
                      Request New Login Link
                    </Button>
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    )
  }
  
  return (
    <Container className="mt-5">
      <Row className="justify-content-center">
        <Col md={6}>
          <Card>
            <Card.Header>
              <h3 className="text-center mb-0">Square Dance Club Login</h3>
            </Card.Header>
            <Card.Body>
              {showSuccess ? (
                <Alert variant="success">
                  <Alert.Heading>Login Link Sent!</Alert.Heading>
                  <p>We've sent a login link to <strong>{email}</strong>.</p>
                  <p>Please check your email and click the link to log in.</p>
                  
                  {/* Display development token info if available */}
                  {sendLoginLink.data?.data?.development_only && (
                    <div className="mt-3 p-2 bg-light border rounded">
                      <p className="mb-1"><strong>Development Login Information:</strong></p>
                      <p className="mb-1 text-monospace">
                        <small>Token: {sendLoginLink.data.data.development_only.token}</small>
                      </p>
                      <p className="mb-0">
                        <a href={sendLoginLink.data.data.development_only.login_url} 
                           className="btn btn-sm btn-outline-primary">
                          Login with this token
                        </a>
                      </p>
                    </div>
                  )}
                  
                  <hr />
                  <div className="text-center">
                    <Button 
                      variant="outline-success" 
                      onClick={() => setShowSuccess(false)}
                    >
                      Send Another Link
                    </Button>
                  </div>
                </Alert>
              ) : (
                <>
                  <p className="text-center mb-4">
                    Enter your email address and we'll send you a secure login link.
                  </p>
                  
                  <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                      <Form.Label>Email Address</Form.Label>
                      <Form.Control
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={sendLoginLink.isPending}
                      />
                    </Form.Group>
                    
                    {sendLoginLink.isError && (
                      <Alert variant="danger">
                        <Alert.Heading>Login Link Error</Alert.Heading>
                        <p>Failed to send login link: {sendLoginLink.error?.response?.data?.message || 'Unknown error'}</p>
                        {sendLoginLink.error?.response?.data?.data?.development_only && (
                          <div className="mt-3 p-2 bg-light border rounded">
                            <p className="mb-1"><strong>Development Login Information:</strong></p>
                            <p className="mb-1 text-monospace">
                              <small>Token: {sendLoginLink.error.response.data.data.development_only.token}</small>
                            </p>
                            <p className="mb-0">
                              <a href={sendLoginLink.error.response.data.data.development_only.login_url} 
                                 className="btn btn-sm btn-outline-primary">
                                Login with this token
                              </a>
                            </p>
                          </div>
                        )}
                      </Alert>
                    )}
                    
                    <div className="d-grid">
                      <Button 
                        type="submit" 
                        variant="primary"
                        disabled={sendLoginLink.isPending || !email}
                      >
                        {sendLoginLink.isPending ? (
                          <>
                            <Spinner size="sm" className="me-2" />
                            Sending...
                          </>
                        ) : (
                          'Send Login Link'
                        )}
                      </Button>
                    </div>
                  </Form>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  )
}

export default Login

import React, { useState } from 'react'
import { Container, Card, Button, Form, Alert } from 'react-bootstrap'

const AuthTest = () => {
  const [token, setToken] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const testTokenValidation = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      console.log('Testing token:', token)
      
      const response = await fetch('http://localhost:8000/api/auth/validate-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token })
      })
      
      const data = await response.json()
      console.log('API Response:', data)
      setResult(data)
      
    } catch (error) {
      console.error('Error:', error)
      setResult({ status: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }

  const testCurrentToken = () => {
    setToken('YOUR_TEST_TOKEN_HERE')
    setTimeout(() => testTokenValidation(), 100)
  }

  return (
    <Container className="mt-5">
      <Card>
        <Card.Header>
          <h3>Authentication Debug Tool</h3>
        </Card.Header>
        <Card.Body>
          <Form.Group className="mb-3">
            <Form.Label>Token</Form.Label>
            <Form.Control
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter token to test"
            />
          </Form.Group>
          
          <div className="mb-3">
            <Button 
              variant="primary" 
              onClick={testTokenValidation}
              disabled={loading || !token}
              className="me-2"
            >
              {loading ? 'Testing...' : 'Test Token'}
            </Button>
            
            <Button 
              variant="secondary" 
              onClick={testCurrentToken}
              disabled={loading}
            >
              Test Latest Token
            </Button>
          </div>
          
          {result && (
            <Alert variant={result.status === 'success' ? 'success' : 'danger'}>
              <h5>Result:</h5>
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </Alert>
          )}
          
          <hr />
          
          <div>
            <h5>Current Auth State:</h5>
            <p>Check localStorage for auth-storage:</p>
            <Button 
              variant="info" 
              size="sm"
              onClick={() => {
                const authData = localStorage.getItem('auth-storage')
                console.log('Auth storage:', authData)
                alert('Check console for auth storage data')
              }}
            >
              Check Auth Storage
            </Button>
          </div>
        </Card.Body>
      </Card>
    </Container>
  )
}

export default AuthTest

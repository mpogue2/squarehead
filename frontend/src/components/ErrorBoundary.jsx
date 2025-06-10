import React from 'react'
import { Container, Alert, Button, Card } from 'react-bootstrap'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console and potentially to an error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error: error,
      errorInfo: errorInfo
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container className="py-5">
          <Card className="border-danger">
            <Card.Header className="bg-danger text-white">
              <h4 className="mb-0">
                <i className="bi bi-exclamation-triangle me-2"></i>
                Something went wrong
              </h4>
            </Card.Header>
            <Card.Body>
              <Alert variant="danger" className="mb-3">
                <p className="mb-0">
                  The application encountered an unexpected error. Please try refreshing the page.
                </p>
              </Alert>
              
              <div className="d-flex gap-2 mb-3">
                <Button 
                  variant="primary"
                  onClick={() => window.location.reload()}
                >
                  <i className="bi bi-arrow-clockwise me-2"></i>
                  Refresh Page
                </Button>
                
                <Button 
                  variant="outline-secondary"
                  onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                >
                  <i className="bi bi-arrow-repeat me-2"></i>
                  Try Again
                </Button>
              </div>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-3">
                  <summary className="text-muted" style={{ cursor: 'pointer' }}>
                    <small>Error Details (Development Mode)</small>
                  </summary>
                  <Card className="mt-2 bg-light">
                    <Card.Body>
                      <h6>Error:</h6>
                      <pre className="text-danger small">
                        {this.state.error && this.state.error.toString()}
                      </pre>
                      
                      <h6>Stack Trace:</h6>
                      <pre className="text-muted small" style={{ fontSize: '0.75rem' }}>
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </Card.Body>
                  </Card>
                </details>
              )}
            </Card.Body>
          </Card>
        </Container>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

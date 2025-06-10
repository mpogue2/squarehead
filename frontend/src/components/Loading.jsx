import React from 'react'
import { Spinner, Container, Card } from 'react-bootstrap'

const LoadingSpinner = ({ 
  size = 'md', 
  text = 'Loading...', 
  fullPage = false,
  variant = 'primary' 
}) => {
  const spinnerSize = size === 'sm' ? 'spinner-border-sm' : ''
  
  const content = (
    <div className="text-center">
      <Spinner 
        animation="border" 
        variant={variant}
        className={spinnerSize}
        role="status"
        style={{
          width: size === 'lg' ? '3rem' : size === 'sm' ? '1rem' : '2rem',
          height: size === 'lg' ? '3rem' : size === 'sm' ? '1rem' : '2rem'
        }}
      />
      {text && (
        <div className="mt-3">
          <span className="text-muted">{text}</span>
        </div>
      )}
    </div>
  )

  if (fullPage) {
    return (
      <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '50vh' }}>
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-5">
            {content}
          </Card.Body>
        </Card>
      </Container>
    )
  }

  return (
    <div className="py-4">
      {content}
    </div>
  )
}

const LoadingPage = ({ message = 'Loading page...' }) => (
  <LoadingSpinner fullPage size="lg" text={message} />
)

const LoadingButton = ({ 
  loading, 
  children, 
  loadingText = 'Loading...', 
  ...props 
}) => (
  <button {...props} disabled={loading || props.disabled}>
    {loading ? (
      <>
        <Spinner 
          animation="border" 
          size="sm" 
          className="me-2" 
          role="status"
        />
        {loadingText}
      </>
    ) : (
      children
    )}
  </button>
)

export { LoadingSpinner, LoadingPage, LoadingButton }
export default LoadingSpinner

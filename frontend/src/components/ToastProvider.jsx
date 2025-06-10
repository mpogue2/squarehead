import React, { createContext, useContext, useState, useCallback } from 'react'
import { Toast, ToastContainer } from 'react-bootstrap'

const ToastContext = createContext()

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', options = {}) => {
    const id = Date.now() + Math.random()
    const toast = {
      id,
      message,
      type, // 'success', 'error', 'warning', 'info'
      autoHide: options.autoHide !== false,
      delay: options.delay || 5000,
      timestamp: new Date(),
      ...options
    }

    setToasts(prev => [...prev, toast])

    if (toast.autoHide) {
      setTimeout(() => {
        removeToast(id)
      }, toast.delay)
    }

    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const success = useCallback((message, options) => 
    addToast(message, 'success', options), [addToast])
  
  const error = useCallback((message, options) => 
    addToast(message, 'error', options), [addToast])
  
  const warning = useCallback((message, options) => 
    addToast(message, 'warning', options), [addToast])
  
  const info = useCallback((message, options) => 
    addToast(message, 'info', options), [addToast])

  const getVariant = (type) => {
    switch (type) {
      case 'success': return 'success'
      case 'error': return 'danger'
      case 'warning': return 'warning'
      case 'info': 
      default: return 'info'
    }
  }

  const getIcon = (type) => {
    switch (type) {
      case 'success': return 'bi-check-circle-fill'
      case 'error': return 'bi-exclamation-triangle-fill'
      case 'warning': return 'bi-exclamation-circle-fill'
      case 'info':
      default: return 'bi-info-circle-fill'
    }
  }

  const value = {
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
    toasts
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      
      <ToastContainer 
        position="top-end" 
        className="p-3"
        style={{ zIndex: 9999 }}
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            bg={getVariant(toast.type)}
            text={toast.type === 'warning' ? 'dark' : 'white'}
            onClose={() => removeToast(toast.id)}
            show={true}
            autohide={toast.autoHide}
            delay={toast.delay}
          >
            <Toast.Header>
              <i className={`bi ${getIcon(toast.type)} me-2`}></i>
              <strong className="me-auto">
                {toast.title || toast.type.charAt(0).toUpperCase() + toast.type.slice(1)}
              </strong>
              <small className="text-muted">
                {toast.timestamp.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </small>
            </Toast.Header>
            <Toast.Body>
              {toast.message}
            </Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  )
}

export default ToastProvider

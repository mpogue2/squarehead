import { useCallback } from 'react'
import useUIStore from '../store/uiStore'
import { useToast } from '../components/ToastProvider'

// Hook for sidebar management
export const useSidebar = () => {
  const { sidebarOpen, setSidebarOpen, toggleSidebar } = useUIStore()
  
  return {
    isOpen: sidebarOpen,
    open: () => setSidebarOpen(true),
    close: () => setSidebarOpen(false),
    toggle: toggleSidebar
  }
}

// Hook for loading states
export const useLoadingState = () => {
  const { loading, setLoading, setGlobalLoading, isLoading } = useUIStore()
  
  const startLoading = useCallback((key = 'global') => {
    setLoading(key, true)
  }, [setLoading])
  
  const stopLoading = useCallback((key = 'global') => {
    setLoading(key, false)
  }, [setLoading])
  
  const withLoading = useCallback(async (fn, key = 'global') => {
    startLoading(key)
    try {
      return await fn()
    } finally {
      stopLoading(key)
    }
  }, [startLoading, stopLoading])
  
  return {
    loading,
    isLoading,
    startLoading,
    stopLoading,
    withLoading,
    setGlobalLoading
  }
}

// Hook for error handling
export const useErrorHandler = () => {
  const { 
    errors, 
    addError, 
    removeError, 
    clearErrors, 
    hasErrors, 
    getRecentErrors 
  } = useUIStore()
  const { error: showToast } = useToast()
  
  const handleError = useCallback((error, showToastMessage = true) => {
    const errorMessage = error.message || error.toString()
    addError(errorMessage)
    
    if (showToastMessage) {
      showToast(errorMessage)
    }
    
    // Log to console for debugging
    console.error('Application error:', error)
  }, [addError, showToast])
  
  const handleApiError = useCallback((error) => {
    let message = 'An unexpected error occurred'
    
    if (error.response) {
      // API returned error response
      message = error.response.data?.message || `Error ${error.response.status}`
    } else if (error.request) {
      // Network error
      message = 'Network error. Please check your connection.'
    } else {
      // Other error
      message = error.message || message
    }
    
    handleError(message)
  }, [handleError])
  
  return {
    errors,
    hasErrors: hasErrors(),
    recentErrors: getRecentErrors(),
    handleError,
    handleApiError,
    removeError,
    clearErrors
  }
}

// Hook for modal management
export const useModals = () => {
  const {
    modals,
    openModal,
    closeModal,
    closeAllModals,
    isModalOpen,
    getActiveModals
  } = useUIStore()
  
  return {
    modals,
    isOpen: isModalOpen,
    open: openModal,
    close: closeModal,
    closeAll: closeAllModals,
    activeModals: getActiveModals()
  }
}

// Hook for theme management
export const useTheme = () => {
  const { theme, setTheme } = useUIStore()
  
  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }, [theme, setTheme])
  
  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark'
  }
}

// Hook for notifications
export const useNotifications = () => {
  const {
    notifications,
    addNotification,
    removeNotification,
    clearNotifications
  } = useUIStore()
  
  const notify = useCallback((type, message, options = {}) => {
    addNotification({
      type,
      message,
      ...options
    })
  }, [addNotification])
  
  const success = useCallback((message, options) => {
    notify('success', message, options)
  }, [notify])
  
  const error = useCallback((message, options) => {
    notify('error', message, options)
  }, [notify])
  
  const warning = useCallback((message, options) => {
    notify('warning', message, options)
  }, [notify])
  
  const info = useCallback((message, options) => {
    notify('info', message, options)
  }, [notify])
  
  return {
    notifications,
    notify,
    success,
    error,
    warning,
    info,
    remove: removeNotification,
    clear: clearNotifications
  }
}

// Hook for async operations with error handling
export const useAsyncOperation = () => {
  const { startLoading, stopLoading } = useLoadingState()
  const { handleError } = useErrorHandler()
  const { success } = useToast()
  
  const execute = useCallback(async (
    operation,
    {
      loadingKey = 'global',
      successMessage = null,
      errorMessage = null,
      onSuccess = null,
      onError = null
    } = {}
  ) => {
    startLoading(loadingKey)
    
    try {
      const result = await operation()
      
      if (successMessage) {
        success(successMessage)
      }
      
      if (onSuccess) {
        onSuccess(result)
      }
      
      return result
    } catch (error) {
      const message = errorMessage || error.message || 'Operation failed'
      handleError(message)
      
      if (onError) {
        onError(error)
      }
      
      throw error
    } finally {
      stopLoading(loadingKey)
    }
  }, [startLoading, stopLoading, handleError, success])
  
  return { execute }
}

// Combined hook for common UI operations
export const useUI = () => {
  return {
    ...useSidebar(),
    ...useLoadingState(),
    ...useErrorHandler(),
    ...useModals(),
    ...useTheme(),
    ...useNotifications()
  }
}

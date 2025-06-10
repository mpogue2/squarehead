import axios from 'axios'

// Create axios instance with default config
const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for adding auth tokens
api.interceptors.request.use(
  (config) => {
    // Get token from auth store instead of localStorage
    const authStore = JSON.parse(localStorage.getItem('auth-storage') || '{}')
    const token = authStore.state?.token
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => {
    // Don't transform blob responses, as we need the raw data
    if (response.config.responseType === 'blob') {
      return response
    }
    
    return response.data // Return just the data part for JSON responses
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access - clear auth store
      localStorage.removeItem('auth-storage')
      window.location.href = '/login'
    }
    
    // For development, log the error
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

// API endpoints
export const apiService = {
  // System endpoints
  getStatus: () => api.get('/status'),
  getHealth: () => api.get('/health'),
  testDatabase: () => api.get('/db-test'),

  // User endpoints
  getUsers: () => api.get('/users'),
  getUser: (id) => api.get(`/users/${id}`),
  getAssignableUsers: () => api.get('/users/assignable'),
  createUser: (userData) => api.post('/users', userData),
  updateUser: (id, userData) => api.put(`/users/${id}`, userData),
  deleteUser: (id) => api.delete(`/users/${id}`),
  geocodeAllAddresses: () => api.post('/users/geocode-all'),
  importMembersCSV: (file) => {
    console.log('🌐 API importMembersCSV called with file:', file.name, 'size:', file.size)
    
    // Create FormData object and append file
    const formData = new FormData()
    formData.append('file', file)
    
    // Log the FormData contents for debugging
    console.log('FormData created with file:', {
      name: file.name,
      type: file.type,
      size: file.size
    })
    
    // For debugging only - log form data entries
    console.log('FormData entries:')
    for (let pair of formData.entries()) {
      console.log(pair[0], pair[1])
    }
    
    // Use fetch API directly for maximum compatibility with file uploads
    return new Promise((resolve, reject) => {
      fetch('http://localhost:8000/api/users/import', {
        method: 'POST',
        body: formData,
        headers: {
          // Important: DO NOT set Content-Type header for multipart/form-data
          'Authorization': `Bearer ${JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token || 'dev-token-valid'}`
        },
        mode: 'cors',
        credentials: 'same-origin'
      })
      .then(response => {
        console.log('Fetch response status:', response.status)
        
        if (!response.ok) {
          return response.json().then(errorData => {
            throw new Error(JSON.stringify(errorData))
          })
        }
        
        return response.json()
      })
      .then(data => {
        console.log('Import successful:', data)
        resolve({ data }) // Match axios response format
      })
      .catch(error => {
        console.error('Import failed:', error)
        reject(error)
      })
    })
  },
  exportMembersCSV: () => {
    console.log('🌐 API exportMembersCSV called')
    
    // Use the configured API instance with correct baseURL and auth
    return api.get('/users/export/csv', {
      responseType: 'blob',
      headers: {
        'Accept': 'text/csv'
      }
    }).then(response => {
      console.log('📥 Export response received:', {
        status: response.status,
        headers: response.headers
      })
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition']
      let filename = 'members-export.csv'
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '')
        }
      }
      
      // Get the blob data
      const blob = new Blob([response.data], { type: 'text/csv' })
      
      // Check if we got valid CSV data (should be larger than fallback sample)
      if (blob.size < 100) {
        console.error('❌ Export received suspiciously small data:', blob.size, 'bytes')
        throw new Error('Invalid response data')
      }
      
      console.log('✅ Export successful:', {
        filename,
        blobSize: blob.size,
        blobType: blob.type
      })
      
      // Return blob and filename
      return { blob, filename }
    }).catch(error => {
      console.error('❌ Export failed:', error)
      
      // Show more specific error info
      if (error.response) {
        console.error('Error details:', {
          status: error.response.status,
          statusText: error.response.statusText
        })
      }
      
      // Throw the error instead of silently falling back to sample data
      throw error
    })
  },
  exportMembersPDF: () => {
    // For now, we'll just redirect to a simple HTML-to-PDF solution
    // In the future, this could be a dedicated PDF generation endpoint
    throw new Error('PDF export not yet implemented')
  },

  // Settings endpoints
  getSettings: () => api.get('/settings'),
  getSetting: (key) => api.get(`/settings/${key}`),
  updateSettings: (settings) => api.put('/settings', settings),
  updateSetting: (key, value) => api.put(`/settings/${key}`, { value }),

  // Auth endpoints
  sendLoginLink: (email) => api.post('/auth/send-login-link', { email }),
  validateToken: (token) => api.post('/auth/validate-token', { token }),

  // Schedule endpoints
  getCurrentSchedule: () => api.get('/schedules/current'),
  getNextSchedule: () => api.get('/schedules/next'),
  createNextSchedule: (scheduleData) => api.post('/schedules/next', scheduleData),
  updateAssignment: (assignmentId, assignmentData) => api.put(`/schedules/assignments/${assignmentId}`, assignmentData),
  promoteSchedule: () => api.post('/schedules/promote'),
}

export default api

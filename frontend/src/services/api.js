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
    return response.data // Return just the data part
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
  importMembersCSV: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/users/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },
  exportMembersCSV: () => api.get('/users/export/csv', { responseType: 'text' }),
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

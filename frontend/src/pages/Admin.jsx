import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Form, 
  Button, 
  Row, 
  Col, 
  Alert, 
  Spinner,
  Badge,
  InputGroup,
  Modal
} from 'react-bootstrap'
import { useQueryClient } from '@tanstack/react-query'
import { useSettings, useUpdateSettings } from '../hooks/useSettings'
import { useToast } from '../components/ToastProvider'

// Import maintenance hooks directly from the file
let useClearMembers, useClearNextSchedule, useClearCurrentSchedule
try {
  const maintenanceHooks = require('../hooks/useMaintenance')
  useClearMembers = maintenanceHooks.useClearMembers
  useClearNextSchedule = maintenanceHooks.useClearNextSchedule
  useClearCurrentSchedule = maintenanceHooks.useClearCurrentSchedule
} catch (e) {
  // Fallback implementations if the file doesn't exist
  useClearMembers = () => ({ 
    mutateAsync: async () => ({ data: { deleted_count: 0 } }),
    isLoading: false 
  })
  useClearNextSchedule = () => ({ 
    mutateAsync: async () => ({ data: { deleted_count: 0 } }),
    isLoading: false
  })
  useClearCurrentSchedule = () => ({ 
    mutateAsync: async () => ({ data: { deleted_count: 0 } }),
    isLoading: false
  })
}

const Admin = () => {
  const queryClient = useQueryClient()
  const { data: settings, isLoading, error } = useSettings()
  const updateSettingsMutation = useUpdateSettings()
  const clearMembersMutation = useClearMembers()
  const clearNextScheduleMutation = useClearNextSchedule()
  const clearCurrentScheduleMutation = useClearCurrentSchedule()
  const { success, error: showError } = useToast()
  
  // Custom styles for placeholder text color
  const placeholderStyle = `
    .admin-form input::placeholder,
    .admin-form textarea::placeholder {
      color: #636c72 !important;
      opacity: 1;
    }
    .admin-form input::-webkit-input-placeholder,
    .admin-form textarea::-webkit-input-placeholder {
      color: #636c72 !important;
      opacity: 1;
    }
    .admin-form input::-moz-placeholder,
    .admin-form textarea::-moz-placeholder {
      color: #636c72 !important;
      opacity: 1;
    }
    .admin-form input:-ms-input-placeholder,
    .admin-form textarea:-ms-input-placeholder {
      color: #636c72 !important;
      opacity: 1;
    }
  `
  
  // Form state
  const [formData, setFormData] = useState({
    club_name: '',
    club_subtitle: '',
    club_address: '',
    club_lat: '',
    club_lng: '',
    club_color: '#EA3323',
    club_day_of_week: 'Wednesday',
    reminder_days: '14,7,3,1',
    club_logo_url: '',
    google_api_key: '',
    email_from_name: '',
    email_from_address: '',
    email_template_subject: '',
    email_template_body: '',
    smtp_host: '',
    smtp_port: '',
    smtp_username: '',
    smtp_password: '',
    system_timezone: '',
    max_upload_size: '',
    backup_enabled: false,
    backup_frequency: 'weekly'
  })
  
  const [isDirty, setIsDirty] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})
  
  // Password field visibility state
  const [passwordVisibility, setPasswordVisibility] = useState({
    google_api_key: false,
    smtp_password: false
  })
  
  // Maintenance confirmation modal state
  const [maintenanceModal, setMaintenanceModal] = useState({
    show: false,
    type: null,
    title: '',
    message: '',
    confirmHandler: null
  })
  
  // Modal visibility state (separate from content for more reliable control)
  const [isModalVisible, setIsModalVisible] = useState(false)
  
  // Toggle password visibility
  const togglePasswordVisibility = (field) => {
    setPasswordVisibility(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }
  
  // Maintenance operation handlers
  const showMaintenanceConfirmation = (type, title, message, confirmHandler) => {
    // First set the modal content
    setMaintenanceModal({
      show: true,
      type,
      title,
      message,
      confirmHandler
    })
    
    // Then ensure modal is visible
    setIsModalVisible(true)
  }
  
  const hideMaintenanceModal = () => {
    // First hide the modal
    setIsModalVisible(false)
    
    // Then clear the content after a short delay
    setTimeout(() => {
      setMaintenanceModal({
        show: false,
        type: null,
        title: '',
        message: '',
        confirmHandler: null
      })
    }, 300)
  }
  
  const handleClearMembers = () => {
    showMaintenanceConfirmation(
      'clear-members',
      'Clear Members List',
      'This will permanently delete ALL members from the database except the admin account. This action CANNOT be undone. Are you absolutely sure you want to proceed?',
      async () => {
        try {
          console.log('Starting direct SQL clear members')
          
          // Force close the modal first
          setIsModalVisible(false)
          
          // Use the direct SQL approach instead of the regular API
          const response = await fetch('http://localhost:8000/api/maintenance/direct-clear-members')
          const result = await response.json()
          console.log('Direct SQL clear completed:', result)
          
          // Complete the modal hiding process
          setTimeout(() => {
            setMaintenanceModal({
              show: false,
              type: null,
              title: '',
              message: '',
              confirmHandler: null
            })
            
            // Show success message
            success(`Successfully cleared ${result.data.deleted_count} members from the database`)
            
            // Force refresh the members data
            queryClient.invalidateQueries({ queryKey: ['members'] })
            queryClient.invalidateQueries({ queryKey: ['users'] })
            
            // Force reload the page after 1 second to ensure UI is updated
            setTimeout(() => {
              window.location.reload()
            }, 1000)
          }, 300)
        } catch (error) {
          // Also force close the modal on error
          setIsModalVisible(false)
          
          console.error('Error in direct SQL clear members:', error)
          showError(`Failed to clear members: ${error.message}`)
          
          // Complete the modal hiding process
          setTimeout(() => {
            setMaintenanceModal({
              show: false,
              type: null,
              title: '',
              message: '',
              confirmHandler: null
            })
          }, 300)
        }
      }
    )
  }
  
  const handleClearNextSchedule = () => {
    showMaintenanceConfirmation(
      'clear-next-schedule',
      'Clear Next Schedule',
      'This will permanently delete the Next Schedule and all its assignments. This action CANNOT be undone. Are you absolutely sure you want to proceed?',
      async () => {
        try {
          console.log('Starting clearNextScheduleMutation.mutateAsync()')
          const result = await clearNextScheduleMutation.mutateAsync()
          console.log('Completed clearNextScheduleMutation.mutateAsync()', result)
          
          // Make sure to properly close the modal before showing success
          hideMaintenanceModal()
          
          // Show success message after modal is closed
          setTimeout(() => {
            if (result.data.schedule_deleted) {
              success(`Successfully cleared next schedule "${result.data.schedule_name}" and ${result.data.assignments_deleted} assignments`)
            } else {
              success('No next schedule found to clear')
            }
          }, 100)
        } catch (error) {
          console.error('Error in clearNextScheduleMutation:', error)
          showError(`Failed to clear next schedule: ${error.response?.data?.message || error.message}`)
        }
      }
    )
  }
  
  const handleClearCurrentSchedule = () => {
    showMaintenanceConfirmation(
      'clear-current-schedule',
      'Clear Current Schedule',
      'This will permanently delete the Current Schedule and all its assignments. This action CANNOT be undone. Are you absolutely sure you want to proceed?',
      async () => {
        try {
          console.log('Starting clearCurrentScheduleMutation.mutateAsync()')
          const result = await clearCurrentScheduleMutation.mutateAsync()
          console.log('Completed clearCurrentScheduleMutation.mutateAsync()', result)
          
          // Make sure to properly close the modal before showing success
          hideMaintenanceModal()
          
          // Show success message after modal is closed
          setTimeout(() => {
            if (result.data.schedule_deleted) {
              success(`Successfully cleared current schedule "${result.data.schedule_name}" and ${result.data.assignments_deleted} assignments`)
            } else {
              success('No current schedule found to clear')
            }
          }, 100)
        } catch (error) {
          console.error('Error in clearCurrentScheduleMutation:', error)
          showError(`Failed to clear current schedule: ${error.response?.data?.message || error.message}`)
        }
      }
    )
  }
  
  // Update form data when settings are loaded
  useEffect(() => {
    if (settings) {
      // Handle both possible formats
      const settingsData = settings.data || settings;
      setFormData({
        club_name: settingsData.club_name || 'Rockin\' Jokers',
        club_subtitle: settingsData.club_subtitle || 'SSD/Plus/Round dance club',
        club_address: settingsData.club_address || '191 Gunston Way, San Jose, CA',
        club_color: settingsData.club_color || '#EA3323',
        club_day_of_week: settingsData.club_day_of_week || 'Wednesday',
        reminder_days: settingsData.reminder_days || '14,7,3,1',
        club_logo_url: settingsData.club_logo_url || '',
        google_api_key: settingsData.google_api_key || '',
        email_from_name: settingsData.email_from_name || 'Rockin\' Jokers',
        email_from_address: settingsData.email_from_address || 'noreply@rockinjokersclub.com',
        email_template_subject: settingsData.email_template_subject || 'Squarehead Reminder - {club_name} Dance on {dance_date}',
        email_template_body: settingsData.email_template_body || `Hello {member_name},

This is a friendly reminder that you are scheduled to be a squarehead for {club_name} on {dance_date}.

Squarehead duties:
• Arrive 15 minutes early to help set up
• Help with tear down after the dance
• Assist with greeting dancers and collecting fees

Duty square instructions are online [here](https://rockinjokers.com/Documents/202503%20Rockin%20Jokers%20Duty%20Square%20Instructions.pdf)

If you cannot make it, please arrange for a substitute and notify the club officers.

Thank you for your service to {club_name}!

Best regards,
{club_name} Officers`,
        smtp_host: settingsData.smtp_host || '',
        smtp_port: settingsData.smtp_port || '587',
        smtp_username: settingsData.smtp_username || '',
        smtp_password: settingsData.smtp_password || '',
        system_timezone: settingsData.system_timezone || 'America/Los_Angeles',
        max_upload_size: settingsData.max_upload_size || '10',
        backup_enabled: settingsData.backup_enabled || false,
        backup_frequency: settingsData.backup_frequency || 'weekly'
      })
    }
  }, [settings])
  
  // Handle form field changes
  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    setIsDirty(true)
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: null
      }))
    }
  }
  
  // Validate form data
  const validateForm = () => {
    const errors = {}
    
    // Club name validation
    if (!formData.club_name.trim()) {
      errors.club_name = 'Club name is required'
    } else if (formData.club_name.length > 100) {
      errors.club_name = 'Club name must be 100 characters or less'
    }
    
    // Club subtitle validation
    if (formData.club_subtitle.length > 200) {
      errors.club_subtitle = 'Club subtitle must be 200 characters or less'
    }
    
    // Club address validation
    if (formData.club_address.length > 255) {
      errors.club_address = 'Club address must be 255 characters or less'
    }
    
    // Club color validation
    const colorRegex = /^#[0-9A-Fa-f]{6}$/
    if (formData.club_color && !colorRegex.test(formData.club_color)) {
      errors.club_color = 'Club color must be a valid hex color (e.g., #EA3323)'
    }
    
    // Reminder days validation
    if (formData.reminder_days) {
      const cleanValue = formData.reminder_days.replace(/\s+/g, '')
      if (!/^[0-9]+(,[0-9]+)*$/.test(cleanValue)) {
        errors.reminder_days = 'Reminder days must be comma-separated numbers (e.g., 14,7,3,1)'
      }
    }
    
    // Club logo URL validation
    if (formData.club_logo_url && formData.club_logo_url.length > 500) {
      errors.club_logo_url = 'Logo URL must be 500 characters or less'
    }
    
    // Google API key validation
    if (formData.google_api_key && formData.google_api_key.length > 100) {
      errors.google_api_key = 'Google API key must be 100 characters or less'
    }
    
    // Email template validation
    if (formData.email_template_subject && formData.email_template_subject.length > 200) {
      errors.email_template_subject = 'Email subject must be 200 characters or less'
    }
    
    if (formData.email_template_body && formData.email_template_body.length > 5000) {
      errors.email_template_body = 'Email template must be 5000 characters or less'
    }
    
    // Email address validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (formData.email_from_address && !emailRegex.test(formData.email_from_address)) {
      errors.email_from_address = 'Please enter a valid email address'
    }
    
    // Max upload size validation
    if (formData.max_upload_size && (isNaN(formData.max_upload_size) || formData.max_upload_size < 1 || formData.max_upload_size > 100)) {
      errors.max_upload_size = 'Upload size must be a number between 1 and 100 MB'
    }
    
    // SMTP configuration validation
    if (formData.smtp_host && formData.smtp_host.length > 255) {
      errors.smtp_host = 'SMTP host must be 255 characters or less'
    }
    
    if (formData.smtp_port && (isNaN(formData.smtp_port) || formData.smtp_port < 1 || formData.smtp_port > 65535)) {
      errors.smtp_port = 'SMTP port must be a number between 1 and 65535'
    }
    
    if (formData.smtp_username && formData.smtp_username.length > 255) {
      errors.smtp_username = 'SMTP username must be 255 characters or less'
    }
    
    if (formData.smtp_password && formData.smtp_password.length > 255) {
      errors.smtp_password = 'SMTP password must be 255 characters or less'
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      showError('Please fix the validation errors before saving')
      return
    }
    
    try {
      await updateSettingsMutation.mutateAsync(formData)
      setIsDirty(false)
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }
  
  // Reset form to original values
  const handleReset = () => {
    if (settings) {
      const settingsData = settings.data || settings;
      setFormData({
        club_name: settingsData.club_name || 'Rockin\' Jokers',
        club_subtitle: settingsData.club_subtitle || 'SSD/Plus/Round dance club',
        club_address: settingsData.club_address || '191 Gunston Way, San Jose, CA',
        club_lat: settingsData.club_lat || '',
        club_lng: settingsData.club_lng || '',
        club_color: settingsData.club_color || '#EA3323',
        club_day_of_week: settingsData.club_day_of_week || 'Wednesday',
        reminder_days: settingsData.reminder_days || '14,7,3,1',
        club_logo_url: settingsData.club_logo_url || '',
        google_api_key: settingsData.google_api_key || '',
        email_from_name: settingsData.email_from_name || 'Rockin\' Jokers',
        email_from_address: settingsData.email_from_address || 'noreply@rockinjokersclub.com',
        email_template_subject: settingsData.email_template_subject || 'Squarehead Reminder - {club_name} Dance on {dance_date}',
        email_template_body: settingsData.email_template_body || `Hello {member_name},

This is a friendly reminder that you are scheduled to be a squarehead for {club_name} on {dance_date}.

Squarehead duties:
• Arrive 15 minutes early to help set up
• Help with tear down after the dance
• Assist with greeting dancers and collecting fees

Duty square instructions are online [here](https://rockinjokers.com/Documents/202503%20Rockin%20Jokers%20Duty%20Square%20Instructions.pdf)

If you cannot make it, please arrange for a substitute and notify the club officers.

Thank you for your service to {club_name}!

Best regards,
{club_name} Officers`,
        smtp_host: settingsData.smtp_host || '',
        smtp_port: settingsData.smtp_port || '587',
        smtp_username: settingsData.smtp_username || '',
        smtp_password: settingsData.smtp_password || '',
        system_timezone: settingsData.system_timezone || 'America/Los_Angeles',
        max_upload_size: settingsData.max_upload_size || '10',
        backup_enabled: settingsData.backup_enabled || false,
        backup_frequency: settingsData.backup_frequency || 'weekly'
      })
      setIsDirty(false)
      setValidationErrors({})
    }
  }
  
  if (isLoading) {
    return (
      <div>
        <h1>Admin Settings</h1>
        <Card>
          <Card.Body className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3">Loading settings...</p>
          </Card.Body>
        </Card>
      </div>
    )
  }
  
  if (error) {
    return (
      <div>
        <h1>Admin Settings</h1>
        <Alert variant="danger">
          <Alert.Heading>Error Loading Settings</Alert.Heading>
          <p>Unable to load admin settings. Please refresh the page and try again.</p>
        </Alert>
      </div>
    )
  }
  
  return (
    <div className="admin-form">
      <style>{placeholderStyle}</style>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Admin Settings</h1>
        {isDirty && (
          <Badge bg="warning" text="dark">
            Unsaved Changes
          </Badge>
        )}
      </div>
      
      <Form onSubmit={handleSubmit}>
        {/* Club Information Card */}
        <Card className="mb-4">
          <Card.Header>
            <h4 className="mb-0">Club Information</h4>
          </Card.Header>
          <Card.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Club Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.club_name}
                    onChange={(e) => handleChange('club_name', e.target.value)}
                    isInvalid={!!validationErrors.club_name}
                    placeholder="e.g., Rockin' Jokers"
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.club_name}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Club Subtitle</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.club_subtitle}
                    onChange={(e) => handleChange('club_subtitle', e.target.value)}
                    isInvalid={!!validationErrors.club_subtitle}
                    placeholder="e.g., SSD/Plus/Round dance club"
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.club_subtitle}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>
            
            <Form.Group className="mb-3">
              <Form.Label>Club Address</Form.Label>
              <Form.Control
                type="text"
                value={formData.club_address}
                onChange={(e) => handleChange('club_address', e.target.value)}
                isInvalid={!!validationErrors.club_address}
                placeholder="e.g., 191 Gunston Way, San Jose, CA"
              />
              <Form.Control.Feedback type="invalid">
                {validationErrors.club_address}
              </Form.Control.Feedback>
              <Form.Text className="text-muted">
                This address will be used for the map view and email footers
              </Form.Text>
            </Form.Group>
            
            {/* Display cached coordinates when available */}
            {(formData.club_lat && formData.club_lng) && (
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Cached Latitude</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.club_lat}
                      readOnly
                      className="bg-light"
                    />
                    <Form.Text className="text-muted">
                      Automatically geocoded from club address
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Cached Longitude</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.club_lng}
                      readOnly
                      className="bg-light"
                    />
                    <Form.Text className="text-muted">
                      Automatically geocoded from club address
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>
            )}
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Club Day of Week</Form.Label>
                  <Form.Select
                    value={formData.club_day_of_week}
                    onChange={(e) => handleChange('club_day_of_week', e.target.value)}
                  >
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Club Logo URL</Form.Label>
                  <Form.Control
                    type="url"
                    value={formData.club_logo_url}
                    onChange={(e) => handleChange('club_logo_url', e.target.value)}
                    isInvalid={!!validationErrors.club_logo_url}
                    placeholder="https://example.com/logo.png"
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.club_logo_url}
                  </Form.Control.Feedback>
                  <Form.Text className="text-muted">
                    Optional: URL to a small square logo image
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>
        
        {/* Theme & Appearance Card */}
        <Card className="mb-4">
          <Card.Header>
            <h4 className="mb-0">Theme & Appearance</h4>
          </Card.Header>
          <Card.Body>
            <Form.Group className="mb-3">
              <Form.Label>Club Color</Form.Label>
              <InputGroup>
                <Form.Control
                  type="color"
                  value={formData.club_color}
                  onChange={(e) => handleChange('club_color', e.target.value)}
                  style={{ maxWidth: '60px' }}
                />
                <Form.Control
                  type="text"
                  value={formData.club_color}
                  onChange={(e) => handleChange('club_color', e.target.value)}
                  isInvalid={!!validationErrors.club_color}
                  placeholder="#EA3323"
                />
                <Form.Control.Feedback type="invalid">
                  {validationErrors.club_color}
                </Form.Control.Feedback>
              </InputGroup>
              <Form.Text className="text-muted">
                This color will be used throughout the website theme
              </Form.Text>
            </Form.Group>
            
            {/* Color Preview */}
            <div className="mb-3">
              <Form.Label>Color Preview</Form.Label>
              <div className="d-flex gap-2 align-items-center">
                <div 
                  className="border rounded"
                  style={{ 
                    width: '40px', 
                    height: '40px', 
                    backgroundColor: formData.club_color 
                  }}
                />
                <div 
                  className="btn btn-sm px-3"
                  style={{ 
                    backgroundColor: formData.club_color,
                    borderColor: formData.club_color,
                    color: '#fff'
                  }}
                >
                  Sample Button
                </div>
                <Badge 
                  style={{ 
                    backgroundColor: formData.club_color 
                  }}
                >
                  Sample Badge
                </Badge>
              </div>
            </div>
          </Card.Body>
        </Card>
        
        {/* Email Settings Card */}
        <Card className="mb-4">
          <Card.Header>
            <h4 className="mb-0">Email Reminder Settings</h4>
          </Card.Header>
          <Card.Body>
            <Form.Group className="mb-3">
              <Form.Label>Reminder Days</Form.Label>
              <Form.Control
                type="text"
                value={formData.reminder_days}
                onChange={(e) => handleChange('reminder_days', e.target.value)}
                isInvalid={!!validationErrors.reminder_days}
                placeholder="14,7,3,1"
              />
              <Form.Control.Feedback type="invalid">
                {validationErrors.reminder_days}
              </Form.Control.Feedback>
              <Form.Text className="text-muted">
                Comma-separated numbers indicating how many days before a dance to send reminder emails.
                For example: "14,7,3,1" sends reminders 14 days, 7 days, 3 days, and 1 day before each dance.
              </Form.Text>
            </Form.Group>
          </Card.Body>
        </Card>

        {/* Google Maps Integration Card */}
        <Card className="mb-4">
          <Card.Header>
            <h4 className="mb-0">Google Maps Integration</h4>
          </Card.Header>
          <Card.Body>
            <Form.Group className="mb-3">
              <Form.Label>Google API Key</Form.Label>
              <InputGroup>
                <Form.Control
                  type={passwordVisibility.google_api_key ? "text" : "password"}
                  value={formData.google_api_key}
                  onChange={(e) => handleChange('google_api_key', e.target.value)}
                  isInvalid={!!validationErrors.google_api_key}
                  placeholder="Enter your Google Maps JavaScript API key"
                />
                <InputGroup.Text 
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => togglePasswordVisibility('google_api_key')}
                  title={passwordVisibility.google_api_key ? "Hide API key" : "Show API key"}
                >
                  {passwordVisibility.google_api_key ? '👁️' : '👁️‍🗨️'}
                </InputGroup.Text>
              </InputGroup>
              <Form.Control.Feedback type="invalid">
                {validationErrors.google_api_key}
              </Form.Control.Feedback>
              <Form.Text className="text-muted">
                Required for the Map view to display member locations. Get your API key from the{' '}
                <a href="https://console.developers.google.com/" target="_blank" rel="noopener noreferrer">
                  Google Cloud Console
                </a>
              </Form.Text>
            </Form.Group>
          </Card.Body>
        </Card>
        
        {/* Email Template Customization Card */}
        <Card className="mb-4">
          <Card.Header>
            <h4 className="mb-0">Email Template Customization</h4>
          </Card.Header>
          <Card.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>From Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.email_from_name}
                    onChange={(e) => handleChange('email_from_name', e.target.value)}
                    placeholder="Rockin' Jokers"
                  />
                  <Form.Text className="text-muted">
                    Name that will appear in the "From" field of reminder emails
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>From Email Address</Form.Label>
                  <Form.Control
                    type="email"
                    value={formData.email_from_address}
                    onChange={(e) => handleChange('email_from_address', e.target.value)}
                    isInvalid={!!validationErrors.email_from_address}
                    placeholder="noreply@rockinjokersclub.com"
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.email_from_address}
                  </Form.Control.Feedback>
                  <Form.Text className="text-muted">
                    Email address that reminder emails will be sent from
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
            
            <Form.Group className="mb-3">
              <Form.Label>Email Subject Template</Form.Label>
              <Form.Control
                type="text"
                value={formData.email_template_subject}
                onChange={(e) => handleChange('email_template_subject', e.target.value)}
                isInvalid={!!validationErrors.email_template_subject}
                placeholder="Squarehead Reminder - {club_name} Dance on {dance_date}"
              />
              <Form.Control.Feedback type="invalid">
                {validationErrors.email_template_subject}
              </Form.Control.Feedback>
              <Form.Text className="text-muted">
                Available variables: {'{club_name}'}, {'{dance_date}'}, {'{member_name}'}
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Email Body Template</Form.Label>
              <Form.Control
                as="textarea"
                rows={8}
                value={formData.email_template_body}
                onChange={(e) => handleChange('email_template_body', e.target.value)}
                isInvalid={!!validationErrors.email_template_body}
                placeholder="Enter your email template..."
              />
              <Form.Control.Feedback type="invalid">
                {validationErrors.email_template_body}
              </Form.Control.Feedback>
              <Form.Text className="text-muted">
                Available variables: {'{club_name}'}, {'{dance_date}'}, {'{member_name}'}, {'{club_address}'}<br/>
                Markdown links: [Link text](https://example.com) - Example: [here](https://rockinjokers.com/documents.pdf)
              </Form.Text>
            </Form.Group>
          </Card.Body>
        </Card>
        
        {/* SMTP Configuration Card */}
        <Card className="mb-4">
          <Card.Header>
            <h4 className="mb-0">SMTP Email Configuration</h4>
          </Card.Header>
          <Card.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>SMTP Host</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.smtp_host}
                    onChange={(e) => handleChange('smtp_host', e.target.value)}
                    isInvalid={!!validationErrors.smtp_host}
                    placeholder="mail.example.com"
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.smtp_host}
                  </Form.Control.Feedback>
                  <Form.Text className="text-muted">
                    SMTP server hostname for sending emails
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>SMTP Port</Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    max="65535"
                    value={formData.smtp_port}
                    onChange={(e) => handleChange('smtp_port', e.target.value)}
                    isInvalid={!!validationErrors.smtp_port}
                    placeholder="587"
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.smtp_port}
                  </Form.Control.Feedback>
                  <Form.Text className="text-muted">
                    SMTP server port (typically 587 for TLS or 465 for SSL)
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>SMTP Username</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.smtp_username}
                    onChange={(e) => handleChange('smtp_username', e.target.value)}
                    isInvalid={!!validationErrors.smtp_username}
                    placeholder="username@example.com"
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.smtp_username}
                  </Form.Control.Feedback>
                  <Form.Text className="text-muted">
                    Username for SMTP authentication
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>SMTP Password</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={passwordVisibility.smtp_password ? "text" : "password"}
                      value={formData.smtp_password}
                      onChange={(e) => handleChange('smtp_password', e.target.value)}
                      isInvalid={!!validationErrors.smtp_password}
                      placeholder="Enter SMTP password"
                    />
                    <InputGroup.Text 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => togglePasswordVisibility('smtp_password')}
                      title={passwordVisibility.smtp_password ? "Hide password" : "Show password"}
                    >
                      {passwordVisibility.smtp_password ? '👁️' : '👁️‍🗨️'}
                    </InputGroup.Text>
                  </InputGroup>
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.smtp_password}
                  </Form.Control.Feedback>
                  <Form.Text className="text-muted">
                    Password for SMTP authentication
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>
        
        {/* System Settings Card */}
        <Card className="mb-4">
          <Card.Header>
            <h4 className="mb-0">System Settings</h4>
          </Card.Header>
          <Card.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>System Timezone</Form.Label>
                  <Form.Select
                    value={formData.system_timezone}
                    onChange={(e) => handleChange('system_timezone', e.target.value)}
                  >
                    <option value="America/New_York">Eastern Time (EST/EDT)</option>
                    <option value="America/Chicago">Central Time (CST/CDT)</option>
                    <option value="America/Denver">Mountain Time (MST/MDT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PST/PDT)</option>
                    <option value="America/Anchorage">Alaska Time (AKST/AKDT)</option>
                    <option value="Pacific/Honolulu">Hawaii Time (HST)</option>
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Timezone used for scheduling and email reminders
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Max Upload Size (MB)</Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    max="100"
                    value={formData.max_upload_size}
                    onChange={(e) => handleChange('max_upload_size', e.target.value)}
                    isInvalid={!!validationErrors.max_upload_size}
                    placeholder="10"
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.max_upload_size}
                  </Form.Control.Feedback>
                  <Form.Text className="text-muted">
                    Maximum file size for CSV uploads and logo images
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    id="backup_enabled"
                    label="Enable Automatic Backups"
                    checked={formData.backup_enabled}
                    onChange={(e) => handleChange('backup_enabled', e.target.checked)}
                  />
                  <Form.Text className="text-muted">
                    Automatically backup member data and schedules
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Backup Frequency</Form.Label>
                  <Form.Select
                    value={formData.backup_frequency}
                    onChange={(e) => handleChange('backup_frequency', e.target.value)}
                    disabled={!formData.backup_enabled}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </Form.Select>
                  <Form.Text className="text-muted">
                    How often to create automatic backups
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>
        
        {/* Maintenance Section Card */}
        <Card className="mb-4">
          <Card.Header className="bg-warning text-dark">
            <h4 className="mb-0">⚠️ Maintenance Operations</h4>
          </Card.Header>
          <Card.Body>
            <Alert variant="danger" className="mb-3">
              <Alert.Heading>⚠️ DANGER ZONE</Alert.Heading>
              <p className="mb-0">
                These operations permanently delete data and <strong>CANNOT BE UNDONE</strong>. 
                Use these functions for testing purposes only.
              </p>
            </Alert>
            
            <Row>
              <Col md={4} className="mb-3">
                <Card className="h-100 border-danger">
                  <Card.Body className="text-center">
                    <h6 className="text-danger">Clear Members List</h6>
                    <p className="small text-muted mb-3">
                      Remove all members from the database (preserves admin account)
                    </p>
                    <Button 
                      variant="outline-danger" 
                      size="sm"
                      onClick={handleClearMembers}
                      disabled={clearMembersMutation.isLoading}
                    >
                      {clearMembersMutation.isLoading ? (
                        <>
                          <Spinner size="sm" className="me-1" />
                          Clearing...
                        </>
                      ) : (
                        'Clear Members'
                      )}
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
              
              <Col md={4} className="mb-3">
                <Card className="h-100 border-warning">
                  <Card.Body className="text-center">
                    <h6 className="text-warning">Clear Next Schedule</h6>
                    <p className="small text-muted mb-3">
                      Remove the Next Schedule and all its assignments
                    </p>
                    <Button 
                      variant="outline-warning" 
                      size="sm"
                      onClick={handleClearNextSchedule}
                      disabled={clearNextScheduleMutation.isLoading}
                    >
                      {clearNextScheduleMutation.isLoading ? (
                        <>
                          <Spinner size="sm" className="me-1" />
                          Clearing...
                        </>
                      ) : (
                        'Clear Next Schedule'
                      )}
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
              
              <Col md={4} className="mb-3">
                <Card className="h-100 border-danger">
                  <Card.Body className="text-center">
                    <h6 className="text-danger">Clear Current Schedule</h6>
                    <p className="small text-muted mb-3">
                      Remove the Current Schedule and all its assignments
                    </p>
                    <Button 
                      variant="outline-danger" 
                      size="sm"
                      onClick={handleClearCurrentSchedule}
                      disabled={clearCurrentScheduleMutation.isLoading}
                    >
                      {clearCurrentScheduleMutation.isLoading ? (
                        <>
                          <Spinner size="sm" className="me-1" />
                          Clearing...
                        </>
                      ) : (
                        'Clear Current Schedule'
                      )}
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Card.Body>
        </Card>
        
        {/* Action Buttons */}
        <div className="d-flex gap-2 justify-content-end">
          <Button 
            variant="outline-secondary" 
            onClick={handleReset}
            disabled={!isDirty || updateSettingsMutation.isLoading}
          >
            Reset Changes
          </Button>
          <Button 
            type="submit" 
            variant="primary"
            disabled={!isDirty || updateSettingsMutation.isLoading}
          >
            {updateSettingsMutation.isLoading ? (
              <>
                <Spinner size="sm" className="me-2" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </div>
      </Form>
      
      {/* Maintenance Confirmation Modal */}
      <Modal 
        show={isModalVisible} 
        onHide={hideMaintenanceModal}
        backdrop="static"
        keyboard={false}
        centered
      >
        <Modal.Header className="bg-danger text-white">
          <Modal.Title>
            ⚠️ {maintenanceModal.title}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="danger" className="mb-3">
            <Alert.Heading>🚨 CRITICAL WARNING</Alert.Heading>
            <p className="mb-0">
              This operation will permanently delete data and <strong>CANNOT BE UNDONE</strong>.
            </p>
          </Alert>
          <p className="mb-0">{maintenanceModal.message}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={hideMaintenanceModal}
            disabled={clearMembersMutation.isLoading || clearNextScheduleMutation.isLoading || clearCurrentScheduleMutation.isLoading}
          >
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={() => {
              console.log('Delete button clicked, executing handler');
              if (maintenanceModal.confirmHandler) {
                maintenanceModal.confirmHandler();
              }
            }}
            disabled={clearMembersMutation.isLoading || clearNextScheduleMutation.isLoading || clearCurrentScheduleMutation.isLoading}
          >
            {(clearMembersMutation.isLoading || clearNextScheduleMutation.isLoading || clearCurrentScheduleMutation.isLoading) ? (
              <>
                <Spinner size="sm" className="me-2" />
                Processing...
              </>
            ) : (
              'Yes, Delete Permanently'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default Admin

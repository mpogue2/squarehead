import React, { useState } from 'react'
import { 
  Modal, 
  Form, 
  Button, 
  Table,
  Alert,
  Spinner
} from 'react-bootstrap'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'

const TestRemindersModal = ({ show, onHide }) => {
  // Set default to today's date
  const today = new Date().toISOString().split('T')[0]
  const [testDate, setTestDate] = useState(today)
  const [isValidDate, setIsValidDate] = useState(true)
  
  // Debug logging
  React.useEffect(() => {
    console.log('TestRemindersModal state:', { show, testDate, isValidDate })
  }, [show, testDate, isValidDate])
  
  // Format date for API (YYYY-MM-DD)
  const formatDateForAPI = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ''
    return date.toISOString().split('T')[0]
  }
  
  // Format date for display (M/D/YYYY)
  const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleDateString('en-US')
  }
  
  const handleDateChange = (value) => {
    setTestDate(value)
    // Validate date
    const date = new Date(value)
    setIsValidDate(!isNaN(date.getTime()) && value !== '')
  }
  
  // Query to get test reminder data
  const { data: reminderData, isLoading, error, refetch } = useQuery({
    queryKey: ['testReminders', formatDateForAPI(testDate)],
    queryFn: async () => {
      if (!isValidDate) return null
      console.log('Making API call to test reminders with date:', formatDateForAPI(testDate))
      try {
        const response = await api.post('/email/test-reminders', {
          test_date: formatDateForAPI(testDate)
        })
        console.log('API response:', response)
        return response // API interceptor already returns response.data
      } catch (error) {
        console.error('API error:', error)
        console.error('Error response:', error.response)
        throw error
      }
    },
    enabled: false, // Don't auto-run, only run when explicitly called
    retry: false
  })
  
  const handleClose = () => {
    setTestDate('')
    setIsValidDate(false)
    onHide()
  }
  
  const handleTestReminders = () => {
    if (isValidDate) {
      console.log('Manual refetch triggered for date:', formatDateForAPI(testDate))
      refetch()
    }
  }
  
  // Auto-trigger when date changes and is valid
  React.useEffect(() => {
    if (isValidDate && testDate) {
      console.log('Auto-triggering query for valid date:', formatDateForAPI(testDate))
      refetch()
    }
  }, [isValidDate, testDate, refetch])
  
  return (
    <Modal show={show} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Test Reminder System</Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        <Form.Group className="mb-4">
          <Form.Label>Test Date</Form.Label>
          <Form.Control
            type="date"
            value={testDate}
            onChange={(e) => handleDateChange(e.target.value)}
            placeholder="Select a date to test"
          />
          <Form.Text className="text-muted">
            Choose a date to see what reminder emails would be sent on that day
          </Form.Text>
        </Form.Group>
        
        {isLoading && (
          <div className="text-center my-4">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
            <div className="mt-2">Checking reminders for {formatDateForDisplay(testDate)}...</div>
          </div>
        )}
        
        {error && (
          <Alert variant="danger">
            <strong>Error loading reminder data:</strong>
            <br />
            {error.message}
            {error.response && (
              <div className="mt-2">
                <small>
                  Status: {error.response.status}
                  {error.response.data && (
                    <div>Response: {JSON.stringify(error.response.data, null, 2)}</div>
                  )}
                </small>
              </div>
            )}
          </Alert>
        )}
        
        {reminderData && !isLoading && (
          <div>
            <h5 className="mb-3">
              Reminders to be sent on {formatDateForDisplay(testDate)}
            </h5>
            
            {reminderData.data && reminderData.data.reminders && reminderData.data.reminders.length > 0 ? (
              <div>
                <div className="mb-3">
                  <strong>Reminder Settings:</strong> {reminderData.data.reminder_days || 'Not configured'}
                </div>
                
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>Member Name</th>
                      <th>Dance Date</th>
                      <th>Days Until Dance</th>
                      <th>Club Night Type</th>
                      <th>Partner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reminderData.data.reminders.map((reminder, index) => (
                      <tr key={index}>
                        <td>{reminder.member_name}</td>
                        <td>{formatDateForDisplay(reminder.dance_date)}</td>
                        <td>{reminder.days_until} days</td>
                        <td className="text-capitalize">{reminder.club_night_type}</td>
                        <td>{reminder.partner_name || 'None'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                
                <Alert variant="info">
                  <strong>Summary:</strong> {reminderData.data.reminders.length} reminder email(s) would be sent on {formatDateForDisplay(testDate)}.
                </Alert>
              </div>
            ) : (
              <Alert variant="warning">
                No reminder emails would be sent on {formatDateForDisplay(testDate)}.
                {reminderData.data && reminderData.data.reminder_days && (
                  <div className="mt-2">
                    <strong>Current reminder settings:</strong> {reminderData.data.reminder_days} days before dances
                  </div>
                )}
              </Alert>
            )}
          </div>
        )}
        
        {!isValidDate && testDate && (
          <Alert variant="warning">
            Please enter a valid date
          </Alert>
        )}
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
        {isValidDate && !isLoading && (
          <Button variant="primary" onClick={handleTestReminders}>
            Refresh Test Results
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  )
}

export default TestRemindersModal
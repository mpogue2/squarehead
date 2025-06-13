import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Container, 
  Row, 
  Col, 
  Table, 
  Button, 
  Alert, 
  Spinner,
  Modal
} from 'react-bootstrap'
import { FaExclamationTriangle, FaFileImport, FaSync, FaTrashAlt } from 'react-icons/fa'
import { apiService } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/ToastProvider'
import { useClearImportLogs } from '../hooks/useMaintenance'

const ImportLogs = () => {
  const { user } = useAuth()
  const { success, error: showError } = useToast()
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState([])
  const [skippedUsers, setSkippedUsers] = useState([])
  const [logPath, setLogPath] = useState('')
  const [logsFound, setLogsFound] = useState(false)
  const [error, setError] = useState(null)
  const [showConfirmClear, setShowConfirmClear] = useState(false)
  const clearLogsAction = useClearImportLogs()

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiService.getMaintenanceImportLogs()
      
      console.log('Import logs response:', response)
      
      if (response.status === 'success' && response.data) {
        setLogsFound(response.data.logs_found)
        setLogPath(response.data.error_log_path)
        setSkippedUsers(response.data.skipped_users || [])
        
        // If we have actual logs, set them
        if (response.data.import_logs_count > 0) {
          setLogs(response.data.import_logs || [])
        }
      } else {
        setError('Failed to retrieve import logs. Response format is invalid.')
      }
    } catch (err) {
      console.error('Error fetching import logs:', err)
      setError('Failed to retrieve import logs: ' + (err.message || 'Unknown error'))
      showError('Failed to retrieve import logs. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  
  const handleClearLogs = () => {
    setShowConfirmClear(true)
  }
  
  const confirmClearLogs = async () => {
    try {
      setLoading(true)
      await clearLogsAction.mutateAsync()
      // Refresh the logs after clearing
      await fetchLogs()
      success('Import logs cleared successfully')
    } catch (err) {
      console.error('Error clearing logs:', err)
      showError('Failed to clear import logs: ' + (err.message || 'Unknown error'))
    } finally {
      setShowConfirmClear(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  if (!user?.is_admin) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Access Denied</Alert.Heading>
        <p>You must be an administrator to view this page.</p>
      </Alert>
    )
  }

  return (
    <Container>
      <Row className="mb-4">
        <Col>
          <h1 className="mb-1">CSV Import Logs</h1>
          <p className="text-muted">View details about recently skipped users during CSV imports</p>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" className="mb-4">
          <Alert.Heading>Error Loading Logs</Alert.Heading>
          <p>{error}</p>
        </Alert>
      )}

      <Row className="mb-4">
        <Col>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <FaFileImport className="me-2" /> 
                Skipped Users
              </h5>
              <div className="d-flex">
                <Button 
                  variant="outline-danger" 
                  size="sm" 
                  onClick={handleClearLogs} 
                  disabled={loading || !logsFound || skippedUsers.length === 0}
                  className="me-2 d-flex align-items-center"
                >
                  <FaTrashAlt className="me-2" /> Clear Logs
                </Button>
                <Button 
                  variant="outline-primary" 
                  size="sm" 
                  onClick={fetchLogs} 
                  disabled={loading}
                  className="d-flex align-items-center"
                >
                  {loading ? (
                    <><Spinner size="sm" className="me-2" /> Refreshing...</>
                  ) : (
                    <><FaSync className="me-2" /> Refresh</>
                  )}
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" role="status" />
                  <p className="mt-3">Loading import logs...</p>
                </div>
              ) : !logsFound ? (
                <Alert variant="info">
                  <Alert.Heading>No Import Logs Found</Alert.Heading>
                  <p>
                    No recent import logs were found in the error log path: 
                    <code className="ms-2">{logPath || 'Unknown'}</code>
                  </p>
                  <p className="mb-0">
                    This could happen if logs are stored in a different location or 
                    have been rotated. Try a new CSV import and check this page again.
                  </p>
                </Alert>
              ) : (
                <>
                  {skippedUsers.length > 0 ? (
                    <>
                      <Alert variant="info" className="mb-3">
                        <Alert.Heading>Why were users skipped?</Alert.Heading>
                        <p>
                          Users are skipped during import when their email address already exists in the database.
                          This prevents creating duplicate user accounts.
                        </p>
                        <p className="mb-0">
                          <strong>Total skipped users: {skippedUsers.length}</strong>
                        </p>
                      </Alert>
                    
                      <div className="table-responsive">
                        <Table striped bordered hover>
                          <thead>
                            <tr>
                              <th>Row in CSV</th>
                              <th>Email</th>
                              <th>First Name</th>
                              <th>Last Name</th>
                              <th>File</th>
                              <th>Time</th>
                              <th>Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {skippedUsers.map((user, index) => (
                              <tr key={index}>
                                <td>{user.row || 'Unknown'}</td>
                                <td>
                                  <code>{user.email}</code>
                                </td>
                                <td>{user.first_name}</td>
                                <td>{user.last_name}</td>
                                <td>
                                  <small className="text-muted">
                                    {user.file || 'Unknown'}
                                  </small>
                                </td>
                                <td>
                                  <small className="text-muted">
                                    {user.timestamp ? new Date(user.timestamp).toLocaleString() : 'Unknown'}
                                  </small>
                                </td>
                                <td>
                                  {user.note || 'User already exists in database'}
                                  {user.note ? (
                                    <FaExclamationTriangle className="ms-2 text-warning" />
                                  ) : null}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    </>
                  ) : (
                    <Alert variant="success">
                      No users were skipped in the most recent import.
                    </Alert>
                  )}
                  
                  <div className="mt-4">
                    <h6>Diagnostic Information</h6>
                    <p className="small text-muted mb-0">
                      Log path: <code>{logPath || 'Unknown'}</code><br />
                      Logs found: {logsFound ? 'Yes' : 'No'}<br />
                      Skipped users found: {skippedUsers.length}
                    </p>
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      {/* Confirmation Modal for Clearing Logs */}
      <Modal show={showConfirmClear} onHide={() => setShowConfirmClear(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Clear Logs</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning">
            <Alert.Heading>Warning!</Alert.Heading>
            <p>
              You are about to clear all import logs. This action cannot be undone.
            </p>
            <p className="mb-0">
              Do you want to continue?
            </p>
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmClear(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmClearLogs} disabled={clearLogsAction.isPending}>
            {clearLogsAction.isPending ? (
              <><Spinner size="sm" className="me-2" /> Clearing...</>
            ) : (
              <>Clear Logs</>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  )
}

export default ImportLogs
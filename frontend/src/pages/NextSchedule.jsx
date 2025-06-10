import React, { useState } from 'react'
import { Container, Row, Col, Card, Table, Badge, Alert, Spinner, Button, Form, Modal } from 'react-bootstrap'
import { FaCalendarAlt, FaUsers, FaInfoCircle, FaExclamationTriangle, FaPlus, FaEdit, FaArrowUp, FaCheck } from 'react-icons/fa'
import { useNextSchedule, useCreateNextSchedule, useUpdateAssignment, usePromoteSchedule } from '../hooks/useSchedules'
import AssignmentEditModal from '../components/schedules/AssignmentEditModal'
import useAuthStore from '../store/authStore'
import { formatDate, formatTableDate } from '../utils/dateUtils'

const NextSchedule = () => {
  const { user } = useAuthStore()
  const { data: scheduleData, isLoading, isError, error } = useNextSchedule()
  const createSchedule = useCreateNextSchedule()
  const updateAssignment = useUpdateAssignment()
  const promoteSchedule = usePromoteSchedule()
  
  // State for create schedule modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    start_date: '',
    end_date: ''
  })
  const [createErrors, setCreateErrors] = useState({})
  const [createWarnings, setCreateWarnings] = useState({})

  // State for assignment edit modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState(null)

  // State for promote confirmation modal
  const [showPromoteModal, setShowPromoteModal] = useState(false)

  // Get club night type badge variant
  const getClubNightVariant = (type) => {
    switch (type) {
      case 'FIFTH WED':
        return 'warning'
      case 'NORMAL':
        return 'primary'
      default:
        return 'secondary'
    }
  }

  // Get status badge for assignment
  const getAssignmentStatus = (assignment) => {
    const hasSquarehead1 = assignment.squarehead1_name
    const hasSquarehead2 = assignment.squarehead2_name
    
    if (hasSquarehead1 && hasSquarehead2) {
      return { variant: 'success', text: 'Complete' }
    } else if (hasSquarehead1 || hasSquarehead2) {
      return { variant: 'warning', text: 'Partial' }
    } else {
      return { variant: 'secondary', text: 'Unassigned' }
    }
  }

  // Handle create form changes
  const handleCreateFormChange = (field, value) => {
    setCreateForm(prev => ({ ...prev, [field]: value }))
    // Clear error and warning when user starts typing
    if (createErrors[field]) {
      setCreateErrors(prev => ({ ...prev, [field]: null }))
    }
    if (createWarnings[field]) {
      setCreateWarnings(prev => ({ ...prev, [field]: null }))
    }
  }

  // Validate create form
  const validateCreateForm = () => {
    const errors = {}
    const warnings = {}
    
    if (!createForm.name.trim()) {
      errors.name = 'Schedule name is required'
    }
    
    if (!createForm.start_date) {
      errors.start_date = 'Start date is required'
    }
    
    if (!createForm.end_date) {
      errors.end_date = 'End date is required'
    }
    
    if (createForm.start_date && createForm.end_date) {
      const startDate = new Date(createForm.start_date)
      const endDate = new Date(createForm.end_date)
      
      if (endDate <= startDate) {
        errors.end_date = 'End date must be after start date'
      }
      
      // Check if start date is in the past - show warning instead of error
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (startDate < today) {
        warnings.start_date = 'Start date is in the past - this schedule will contain historical dates'
      }
    }
    
    return { errors, warnings }
  }

  // Handle create schedule
  const handleCreateSchedule = async () => {
    const { errors, warnings } = validateCreateForm()
    
    setCreateErrors(errors)
    setCreateWarnings(warnings)
    
    if (Object.keys(errors).length > 0) {
      return
    }
    
    try {
      await createSchedule.mutateAsync(createForm)
      setShowCreateModal(false)
      setCreateForm({ name: '', start_date: '', end_date: '' })
      setCreateErrors({})
      setCreateWarnings({})
    } catch (err) {
      console.error('Failed to create schedule:', err)
    }
  }

  // Generate suggested schedule name
  const generateScheduleName = () => {
    if (createForm.start_date) {
      const date = new Date(createForm.start_date)
      const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      return `${monthYear} Schedule`
    }
    return ''
  }

  // Auto-generate schedule name when start date changes
  const handleStartDateChange = (date) => {
    handleCreateFormChange('start_date', date)
    if (date && !createForm.name) {
      const suggested = generateScheduleName()
      if (suggested) {
        handleCreateFormChange('name', suggested)
      }
    }
  }

  // Handle assignment edit
  const handleEditAssignment = (assignment) => {
    setEditingAssignment(assignment)
    setShowEditModal(true)
  }

  // Handle assignment save
  const handleSaveAssignment = async (assignmentId, updateData) => {
    try {
      await updateAssignment.mutateAsync({ id: assignmentId, ...updateData })
      setShowEditModal(false)
      setEditingAssignment(null)
    } catch (err) {
      console.error('Failed to update assignment:', err)
    }
  }

  // Handle promote schedule
  const handlePromoteSchedule = async () => {
    try {
      await promoteSchedule.mutateAsync()
      setShowPromoteModal(false)
    } catch (err) {
      console.error('Failed to promote schedule:', err)
    }
  }

  // Check if schedule is ready for promotion
  const canPromoteSchedule = () => {
    if (!schedule || !assignments.length) return false
    
    // Allow promotion regardless of assignment completion status
    return true
  }

  // Loading state
  if (isLoading) {
    return (
      <Container>
        <div className="d-flex justify-content-center align-items-center" style={{ height: '300px' }}>
          <div className="text-center">
            <Spinner animation="border" role="status" className="mb-3">
              <span className="visually-hidden">Loading next schedule...</span>
            </Spinner>
            <h5>Loading Next Schedule</h5>
            <p className="text-muted">Please wait while we retrieve the schedule data...</p>
          </div>
        </div>
      </Container>
    )
  }

  // Error state
  if (isError) {
    return (
      <Container>
        <Alert variant="danger" className="mt-4">
          <FaExclamationTriangle className="me-2" />
          <strong>Error Loading Schedule</strong>
          <p className="mb-0 mt-2">
            {error?.response?.data?.message || error?.message || 'Failed to load next schedule'}
          </p>
        </Alert>
      </Container>
    )
  }

  const schedule = scheduleData?.schedule
  const assignments = scheduleData?.assignments || []
  const assignmentCount = scheduleData?.count || 0

  // No next schedule state
  if (!schedule) {
    return (
      <Container>
        <Row>
          <Col>
            <div className="d-flex align-items-center mb-4">
              <FaCalendarAlt className="me-3 text-primary" size={24} />
              <h1>Next Squarehead Schedule</h1>
            </div>
            
            <Alert variant="info">
              <FaInfoCircle className="me-2" />
              <strong>No Next Schedule</strong>
              <p className="mb-3 mt-2">
                There is currently no next schedule being planned.
                {user?.is_admin && (
                  <span> You can create a new schedule using the date range picker below.</span>
                )}
              </p>
              
              {user?.is_admin && (
                <Button 
                  variant="primary" 
                  onClick={() => setShowCreateModal(true)}
                  className="mt-2"
                >
                  <FaPlus className="me-2" />
                  Create New Schedule
                </Button>
              )}
            </Alert>

            {/* Create Schedule Modal */}
            <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="lg">
              <Modal.Header closeButton>
                <Modal.Title>
                  <FaCalendarAlt className="me-2" />
                  Create New Schedule
                </Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <Form>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Start Date *</Form.Label>
                        <Form.Control
                          type="date"
                          value={createForm.start_date}
                          onChange={(e) => handleStartDateChange(e.target.value)}
                          isInvalid={!!createErrors.start_date}
                        />
                        <Form.Control.Feedback type="invalid">
                          {createErrors.start_date}
                        </Form.Control.Feedback>
                        {createWarnings.start_date && (
                          <div className="text-warning small mt-1">
                            <FaExclamationTriangle className="me-1" />
                            {createWarnings.start_date}
                          </div>
                        )}
                        <Form.Text className="text-muted">
                          First dance date of the schedule period
                        </Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>End Date *</Form.Label>
                        <Form.Control
                          type="date"
                          value={createForm.end_date}
                          onChange={(e) => handleCreateFormChange('end_date', e.target.value)}
                          isInvalid={!!createErrors.end_date}
                        />
                        <Form.Control.Feedback type="invalid">
                          {createErrors.end_date}
                        </Form.Control.Feedback>
                        <Form.Text className="text-muted">
                          Last dance date of the schedule period
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Schedule Name *</Form.Label>
                    <Form.Control
                      type="text"
                      value={createForm.name}
                      onChange={(e) => handleCreateFormChange('name', e.target.value)}
                      placeholder="e.g., February 2025 Schedule"
                      isInvalid={!!createErrors.name}
                    />
                    <Form.Control.Feedback type="invalid">
                      {createErrors.name}
                    </Form.Control.Feedback>
                    <Form.Text className="text-muted">
                      A descriptive name for this schedule period
                    </Form.Text>
                  </Form.Group>
                  
                  <Alert variant="info" className="mb-0">
                    <FaInfoCircle className="me-2" />
                    <strong>Schedule Creation:</strong>
                    <ul className="mb-0 mt-2">
                      <li>Dance dates will be automatically generated based on the club's day of the week</li>
                      <li>All assignments will start as unassigned and can be edited after creation</li>
                      <li>Creating a new schedule will replace any existing next schedule</li>
                    </ul>
                  </Alert>
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="primary" 
                  onClick={handleCreateSchedule}
                  disabled={createSchedule.isLoading}
                >
                  {createSchedule.isLoading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <FaPlus className="me-2" />
                      Create Schedule
                    </>
                  )}
                </Button>
              </Modal.Footer>
            </Modal>
          </Col>
        </Row>
      </Container>
    )
  }

  // Calculate statistics
  const completeAssignments = assignments.filter(a => a.squarehead1_name && a.squarehead2_name).length
  const partialAssignments = assignments.filter(a => (a.squarehead1_name || a.squarehead2_name) && !(a.squarehead1_name && a.squarehead2_name)).length
  const unassignedCount = assignments.filter(a => !a.squarehead1_name && !a.squarehead2_name).length

  return (
    <Container>
      <Row>
        <Col>
          {/* Header */}
          <div className="d-flex align-items-center justify-content-between mb-4">
            <div className="d-flex align-items-center">
              <FaCalendarAlt className="me-3 text-primary" size={24} />
              <div>
                <h1 className="mb-1">Next Squarehead Schedule</h1>
                <p className="text-muted mb-0">Create and edit upcoming assignments</p>
              </div>
            </div>
            
            {user?.is_admin && (
              <div className="d-flex gap-2">
                <Button 
                  variant="success" 
                  onClick={() => setShowPromoteModal(true)}
                  disabled={!canPromoteSchedule()}
                  size="sm"
                >
                  <FaArrowUp className="me-2" />
                  Promote to Current
                </Button>
                <Button 
                  variant="outline-primary" 
                  onClick={() => setShowCreateModal(true)}
                  size="sm"
                >
                  <FaPlus className="me-2" />
                  New Schedule
                </Button>
              </div>
            )}
          </div>

          {/* Schedule Info */}
          <Card className="mb-4">
            <Card.Body>
              <Row>
                <Col md={6}>
                  <h5 className="card-title">{schedule.name}</h5>
                  <p className="text-muted mb-2">
                    <strong>Period:</strong> {formatDate(schedule.start_date)} - {formatDate(schedule.end_date)}
                  </p>
                  <p className="text-muted mb-0">
                    <strong>Schedule Type:</strong> <Badge bg="warning">Next</Badge>
                  </p>
                </Col>
                <Col md={6}>
                  <div className="d-flex justify-content-md-end">
                    <div className="text-center">
                      <FaUsers className="text-primary mb-2" size={32} />
                      <h4 className="mb-0">{assignmentCount}</h4>
                      <small className="text-muted">Total Assignments</small>
                    </div>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Statistics */}
          <Row className="mb-4">
            <Col md={4}>
              <Card className="text-center h-100">
                <Card.Body>
                  <Badge bg="success" className="mb-2" style={{ fontSize: '1rem' }}>
                    {completeAssignments}
                  </Badge>
                  <div>Complete Assignments</div>
                  <small className="text-muted">Both squareheads assigned</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="text-center h-100">
                <Card.Body>
                  <Badge bg="warning" className="mb-2" style={{ fontSize: '1rem' }}>
                    {partialAssignments}
                  </Badge>
                  <div>Partial Assignments</div>
                  <small className="text-muted">One squarehead assigned</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="text-center h-100">
                <Card.Body>
                  <Badge bg="secondary" className="mb-2" style={{ fontSize: '1rem' }}>
                    {unassignedCount}
                  </Badge>
                  <div>Unassigned Dates</div>
                  <small className="text-muted">No squareheads assigned</small>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Editable Assignments Table */}
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <FaCalendarAlt className="me-2" />
                Dance Schedule & Assignments
              </h5>
              {user?.is_admin && (
                <small className="text-muted">
                  <FaEdit className="me-1" />
                  Click rows to edit assignments
                </small>
              )}
            </Card.Header>
            <Card.Body className="p-0">
              {assignments.length > 0 ? (
                <div className="table-responsive">
                  <Table className="mb-0" hover>
                    <thead className="table-light">
                      <tr>
                        <th>Date</th>
                        <th>Club Night</th>
                        <th>Squarehead 1</th>
                        <th>Squarehead 2</th>
                        <th>Notes</th>
                        <th>Status</th>
                        {user?.is_admin && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map((assignment) => {
                        const status = getAssignmentStatus(assignment)
                        return (
                          <tr 
                            key={assignment.id}
                            className={user?.is_admin ? "cursor-pointer" : ""}
                            style={{ cursor: user?.is_admin ? 'pointer' : 'default' }}
                            onClick={() => user?.is_admin && handleEditAssignment(assignment)}
                          >
                            <td>
                              <strong>{formatTableDate(assignment.dance_date)}</strong>
                            </td>
                            <td>
                              <Badge bg={getClubNightVariant(assignment.club_night_type)}>
                                {assignment.club_night_type || 'NORMAL'}
                              </Badge>
                            </td>
                            <td>
                              {assignment.squarehead1_name ? (
                                <span className="text-success">
                                  <strong>{assignment.squarehead1_name}</strong>
                                </span>
                              ) : (
                                <span className="text-muted fst-italic">Click to assign</span>
                              )}
                            </td>
                            <td>
                              {assignment.squarehead2_name ? (
                                <span className="text-success">
                                  <strong>{assignment.squarehead2_name}</strong>
                                </span>
                              ) : (
                                <span className="text-muted fst-italic">Click to assign</span>
                              )}
                            </td>
                            <td>
                              {assignment.notes ? (
                                <small>{assignment.notes}</small>
                              ) : (
                                <span className="text-muted fst-italic">—</span>
                              )}
                            </td>
                            <td>
                              <Badge bg={status.variant}>
                                {status.text}
                              </Badge>
                            </td>
                            {user?.is_admin && (
                              <td>
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditAssignment(assignment)
                                  }}
                                >
                                  <FaEdit />
                                </Button>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-5">
                  <FaInfoCircle className="text-muted mb-3" size={48} />
                  <h5>No Assignments Found</h5>
                  <p className="text-muted">
                    This schedule doesn't have any dance assignments yet.
                  </p>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Create Schedule Modal */}
          <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="lg">
            <Modal.Header closeButton>
              <Modal.Title>
                <FaCalendarAlt className="me-2" />
                Create New Schedule
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Start Date *</Form.Label>
                      <Form.Control
                        type="date"
                        value={createForm.start_date}
                        onChange={(e) => handleStartDateChange(e.target.value)}
                        isInvalid={!!createErrors.start_date}
                      />
                      <Form.Control.Feedback type="invalid">
                        {createErrors.start_date}
                      </Form.Control.Feedback>
                      {createWarnings.start_date && (
                        <div className="text-warning small mt-1">
                          <FaExclamationTriangle className="me-1" />
                          {createWarnings.start_date}
                        </div>
                      )}
                      <Form.Text className="text-muted">
                        First dance date of the schedule period
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>End Date *</Form.Label>
                      <Form.Control
                        type="date"
                        value={createForm.end_date}
                        onChange={(e) => handleCreateFormChange('end_date', e.target.value)}
                        isInvalid={!!createErrors.end_date}
                      />
                      <Form.Control.Feedback type="invalid">
                        {createErrors.end_date}
                      </Form.Control.Feedback>
                      <Form.Text className="text-muted">
                        Last dance date of the schedule period
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
                
                <Form.Group className="mb-3">
                  <Form.Label>Schedule Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={createForm.name}
                    onChange={(e) => handleCreateFormChange('name', e.target.value)}
                    placeholder="e.g., February 2025 Schedule"
                    isInvalid={!!createErrors.name}
                  />
                  <Form.Control.Feedback type="invalid">
                    {createErrors.name}
                  </Form.Control.Feedback>
                  <Form.Text className="text-muted">
                    A descriptive name for this schedule period
                  </Form.Text>
                </Form.Group>
                
                <Alert variant="info" className="mb-0">
                  <FaInfoCircle className="me-2" />
                  <strong>Schedule Creation:</strong>
                  <ul className="mb-0 mt-2">
                    <li>Dance dates will be automatically generated based on the club's day of the week</li>
                    <li>All assignments will start as unassigned and can be edited after creation</li>
                    <li>Creating a new schedule will replace any existing next schedule</li>
                  </ul>
                </Alert>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button 
                variant="primary" 
                onClick={handleCreateSchedule}
                disabled={createSchedule.isLoading}
              >
                {createSchedule.isLoading ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FaPlus className="me-2" />
                    Create Schedule
                  </>
                )}
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Assignment Edit Modal */}
          <AssignmentEditModal
            show={showEditModal}
            onHide={() => {
              setShowEditModal(false)
              setEditingAssignment(null)
            }}
            assignment={editingAssignment}
            onSave={handleSaveAssignment}
            isLoading={updateAssignment.isLoading}
          />

          {/* Promote Schedule Confirmation Modal */}
          <Modal show={showPromoteModal} onHide={() => setShowPromoteModal(false)}>
            <Modal.Header closeButton>
              <Modal.Title>
                <FaArrowUp className="me-2" />
                Promote Schedule to Current
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Alert variant="warning" className="mb-3">
                <FaExclamationTriangle className="me-2" />
                <strong>Important:</strong> This action will replace the current schedule with this next schedule.
              </Alert>
              
              <p>Are you sure you want to promote "{schedule?.name}" to be the current schedule?</p>
              
              <div className="mb-3">
                <strong>Schedule Summary:</strong>
                <ul className="mt-2">
                  <li>Period: {formatDate(schedule?.start_date)} - {formatDate(schedule?.end_date)}</li>
                  <li>Total Assignments: {assignmentCount}</li>
                  <li>Complete Assignments: {completeAssignments}</li>
                  <li>Partial Assignments: {partialAssignments}</li>
                  <li>Unassigned Dates: {unassignedCount}</li>
                </ul>
              </div>
              
              {unassignedCount > 0 && (
                <Alert variant="info" className="mb-0">
                  <FaInfoCircle className="me-2" />
                  <strong>Note:</strong> This schedule still has {unassignedCount} unassigned date{unassignedCount > 1 ? 's' : ''}. 
                  You can continue editing assignments after promotion.
                </Alert>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowPromoteModal(false)}>
                Cancel
              </Button>
              <Button 
                variant="success" 
                onClick={handlePromoteSchedule}
                disabled={promoteSchedule.isLoading}
              >
                {promoteSchedule.isLoading ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Promoting...
                  </>
                ) : (
                  <>
                    <FaCheck className="me-2" />
                    Promote to Current
                  </>
                )}
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Footer Info */}
          <div className="mt-4 mb-5">
            <small className="text-muted">
              <FaInfoCircle className="me-1" />
              This schedule is for planning future assignments. 
              {user?.is_admin && (
                <span> Edit assignments by clicking the Edit buttons, then promote to current when ready.</span>
              )}
            </small>
          </div>
        </Col>
      </Row>
    </Container>
  )
}

export default NextSchedule
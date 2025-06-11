import React, { useState } from 'react'
import { Container, Row, Col, Card, Table, Badge, Alert, Spinner, Button, OverlayTrigger, Tooltip } from 'react-bootstrap'
import { FaCalendarAlt, FaUsers, FaInfoCircle, FaExclamationTriangle, FaEdit, FaCopy } from 'react-icons/fa'
import { useCurrentSchedule, useUpdateAssignment } from '../hooks/useSchedules'
import { useMembers } from '../hooks/useMembers'
import AssignmentEditModal from '../components/schedules/AssignmentEditModal'
import useAuthStore from '../store/authStore'
import { formatDate, formatTableDate } from '../utils/dateUtils'
import { formatScheduleForClipboard, copyToClipboard } from '../utils/scheduleUtils'
import { useToast } from '../components/ToastProvider'

const CurrentSchedule = () => {
  const { user } = useAuthStore()
  const { data: scheduleData, isLoading, isError, error } = useCurrentSchedule()
  const { data: membersData } = useMembers()
  const updateAssignment = useUpdateAssignment()
  const { success, error: showError } = useToast()
  
  // State for assignment edit modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState(null)
  const [copySuccess, setCopySuccess] = useState(false)

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
      return { variant: 'danger', text: 'Unassigned' }
    }
  }

  // Handle assignment edit (admin only)
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
  
  // Handle copy schedule to clipboard
  const handleCopySchedule = async () => {
    if (!assignments || assignments.length === 0) {
      showError('No schedule data to copy')
      return
    }
    
    // Create a Map of user IDs to their partner IDs for quick lookup
    const partnerMap = new Map()
    
    if (membersData && Array.isArray(membersData)) {
      console.log('Members data for partner lookup:', membersData.length, 'members');
      
      // Count how many members have partners
      const partnersCount = membersData.filter(m => m.partner_id).length;
      console.log(`Found ${partnersCount} members with partners defined`);
      
      membersData.forEach(member => {
        if (member.partner_id) {
          partnerMap.set(member.id.toString(), member.partner_id.toString())
          console.log(`Added partner relationship: ${member.id} -> ${member.partner_id}`);
        }
      })
    }
    
    console.log(`Partner map contains ${partnerMap.size} relationships`);
    
    // Log the first few assignments to debug
    if (assignments.length > 0) {
      console.log('Sample assignment data:', assignments[0]);
    }
    
    const formattedSchedule = formatScheduleForClipboard(assignments, partnerMap)
    const copied = await copyToClipboard(formattedSchedule)
    
    if (copied) {
      setCopySuccess(true)
      success('Schedule copied to clipboard!')
      setTimeout(() => setCopySuccess(false), 2000)
    } else {
      showError('Failed to copy schedule to clipboard')
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <Container>
        <div className="d-flex justify-content-center align-items-center" style={{ height: '300px' }}>
          <div className="text-center">
            <Spinner animation="border" role="status" className="mb-3">
              <span className="visually-hidden">Loading current schedule...</span>
            </Spinner>
            <h5>Loading Current Schedule</h5>
            <p className="text-muted">Please wait while we retrieve the current assignments...</p>
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
            {error?.response?.data?.message || error?.message || 'Failed to load current schedule'}
          </p>
        </Alert>
      </Container>
    )
  }

  const schedule = scheduleData?.schedule
  const assignments = scheduleData?.assignments || []
  const assignmentCount = scheduleData?.count || 0

  // No current schedule
  if (!schedule) {
    return (
      <Container>
        <Row>
          <Col>
            <div className="d-flex align-items-center mb-4">
              <FaCalendarAlt className="me-3 text-primary" size={24} />
              <h1>Current Squarehead Schedule</h1>
            </div>
            
            <Alert variant="info">
              <FaInfoCircle className="me-2" />
              <strong>No Current Schedule</strong>
              <p className="mb-0 mt-2">
                There is currently no active schedule. 
                {user?.is_admin && (
                  <span> You can create a new schedule from the Next Schedule page and then promote it to current.</span>
                )}
              </p>
            </Alert>
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
          <div className="d-flex align-items-center mb-4">
            <FaCalendarAlt className="me-3 text-primary" size={24} />
            <div>
              <h1 className="mb-1">Current Squarehead Schedule</h1>
              <p className="text-muted mb-0">
                {user?.is_admin ? 'Current assignments - click to edit' : 'Read-only view of current assignments'}
              </p>
            </div>
          </div>

          {/* Schedule Info */}
          <Card className="mb-4">
            <Card.Body>
              <Row>
                <Col md={5}>
                  <h5 className="card-title">{schedule.name}</h5>
                  <p className="text-muted mb-2">
                    <strong>Period:</strong> {formatDate(schedule.start_date)} - {formatDate(schedule.end_date)}
                  </p>
                  <p className="text-muted mb-0">
                    <strong>Schedule Type:</strong> <Badge bg="success">Current</Badge>
                  </p>
                </Col>
                <Col md={4}>
                  <div className="d-flex justify-content-md-end">
                    <div className="text-center">
                      <FaUsers className="text-primary mb-2" size={32} />
                      <h4 className="mb-0">{assignmentCount}</h4>
                      <small className="text-muted">Total Assignments</small>
                    </div>
                  </div>
                </Col>
                <Col md={3} className="d-flex justify-content-md-end align-items-center">
                  <OverlayTrigger
                    placement="top"
                    overlay={
                      <Tooltip id="tooltip-copy">
                        {copySuccess ? 'Copied!' : 'Copy schedule to clipboard'}
                      </Tooltip>
                    }
                  >
                    <Button 
                      variant={copySuccess ? "success" : "outline-secondary"}
                      size="sm"
                      onClick={handleCopySchedule}
                      className="d-flex align-items-center"
                    >
                      <FaCopy className="me-2" />
                      <span>Copy to Clipboard</span>
                    </Button>
                  </OverlayTrigger>
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
                  <Badge bg="danger" className="mb-2" style={{ fontSize: '1rem' }}>
                    {unassignedCount}
                  </Badge>
                  <div>Unassigned Dates</div>
                  <small className="text-muted">No squareheads assigned</small>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Assignments Table */}
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
                                <span className="text-muted fst-italic">
                                  {user?.is_admin ? 'Click to assign' : 'Unassigned'}
                                </span>
                              )}
                            </td>
                            <td>
                              {assignment.squarehead2_name ? (
                                <span className="text-success">
                                  <strong>{assignment.squarehead2_name}</strong>
                                </span>
                              ) : (
                                <span className="text-muted fst-italic">
                                  {user?.is_admin ? 'Click to assign' : 'Unassigned'}
                                </span>
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

          {/* Footer Info */}
          <div className="mt-4 mb-5">
            <small className="text-muted">
              <FaInfoCircle className="me-1" />
              {user?.is_admin ? (
                <span>As an admin, you can edit current schedule assignments directly or use the Next Schedule page to plan future schedules.</span>
              ) : (
                <span>This is a read-only view of the current schedule. Contact an administrator to make changes.</span>
              )}
            </small>
          </div>

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
        </Col>
      </Row>
    </Container>
  )
}

export default CurrentSchedule
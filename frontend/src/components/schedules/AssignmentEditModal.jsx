import React, { useState, useEffect } from 'react'
import { Modal, Form, Button, Alert, Spinner, Row, Col } from 'react-bootstrap'
import { FaEdit, FaSave, FaTimes, FaExclamationTriangle, FaUsers } from 'react-icons/fa'
import { useMembers } from '../../hooks/useMembers'
import { formatDate } from '../../utils/dateUtils'

const AssignmentEditModal = ({ 
  show, 
  onHide, 
  assignment, 
  onSave,
  isLoading = false 
}) => {
  const { data: members = [], isLoading: membersLoading } = useMembers()
  
  // Get assignable members (excluding exempt ones)
  const assignableMembers = members.filter(member => 
    member.status === 'assignable' && member.role !== 'exempt'
  )

  const [formData, setFormData] = useState({
    dance_date: '',
    club_night_type: 'NORMAL',
    squarehead1_id: '',
    squarehead2_id: '',
    notes: ''
  })
  
  const [errors, setErrors] = useState({})
  const [conflicts, setConflicts] = useState([])
  const [warnings, setWarnings] = useState([])

  // Initialize form when assignment changes
  useEffect(() => {
    if (assignment) {
      setFormData({
        dance_date: assignment.dance_date || '',
        club_night_type: assignment.club_night_type || 'NORMAL',
        squarehead1_id: assignment.squarehead1_id || '',
        squarehead2_id: assignment.squarehead2_id || '',
        notes: assignment.notes || ''
      })
      setErrors({})
      setConflicts([])
      setWarnings([])
    }
  }, [assignment])

  // Handle form field changes
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear errors when user starts typing/selecting
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }))
    }
    
    // Check for conflicts when squarehead assignments change
    if (field === 'squarehead1_id' || field === 'squarehead2_id') {
      checkConflicts({ ...formData, [field]: value })
    }
  }

  // Check for assignment conflicts
  const checkConflicts = (data) => {
    const conflicts = []
    const warnings = []
    
    // Check if same person assigned to both positions
    if (data.squarehead1_id && data.squarehead2_id && 
        data.squarehead1_id === data.squarehead2_id) {
      conflicts.push('Cannot assign the same person to both squarehead positions')
    }

    // Check partner preferences
    if (data.squarehead1_id && data.squarehead2_id) {
      const member1 = members.find(m => m.id.toString() === data.squarehead1_id.toString())
      const member2 = members.find(m => m.id.toString() === data.squarehead2_id.toString())
      
      if (member1?.partner_id && member2?.id !== member1.partner_id) {
        const partner = members.find(m => m.id === member1.partner_id)
        if (partner) {
          warnings.push(`${member1.first_name} ${member1.last_name} prefers to be paired with their partner ${partner.first_name} ${partner.last_name}`)
        }
      }
      
      if (member2?.partner_id && member1?.id !== member2.partner_id) {
        const partner = members.find(m => m.id === member2.partner_id)
        if (partner) {
          warnings.push(`${member2.first_name} ${member2.last_name} prefers to be paired with their partner ${partner.first_name} ${partner.last_name}`)
        }
      }
    }

    setConflicts(conflicts)
    setWarnings(warnings)
  }

  // Validate form
  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.dance_date) {
      newErrors.dance_date = 'Dance date is required'
    }
    
    if (!formData.club_night_type) {
      newErrors.club_night_type = 'Club night type is required'
    }

    // At least one squarehead should be assigned
    if (!formData.squarehead1_id && !formData.squarehead2_id) {
      newErrors.assignment = 'At least one squarehead must be assigned'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle save
  const handleSave = () => {
    if (!validateForm()) {
      return
    }

    // Prepare data for API
    const updateData = {
      club_night_type: formData.club_night_type,
      squarehead1_id: formData.squarehead1_id ? parseInt(formData.squarehead1_id) : null,
      squarehead2_id: formData.squarehead2_id ? parseInt(formData.squarehead2_id) : null,
      notes: formData.notes.trim() || null
    }

    onSave(assignment.id, updateData)
  }

  // Get member name by ID
  const getMemberName = (id) => {
    const member = members.find(m => m.id.toString() === id.toString())
    return member ? `${member.first_name} ${member.last_name}` : 'Unknown'
  }

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <FaEdit className="me-2" />
          Edit Assignment
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        {assignment && (
          <Form>
            {/* Dance Date Display */}
            <Form.Group className="mb-3">
              <Form.Label>Dance Date</Form.Label>
              <Form.Control
                type="text"
                value={formatDate(formData.dance_date)}
                disabled
                className="bg-light"
              />
              <Form.Text className="text-muted">
                Dance date cannot be changed after schedule creation
              </Form.Text>
            </Form.Group>

            <Row>
              <Col md={6}>
                {/* Club Night Type */}
                <Form.Group className="mb-3">
                  <Form.Label>Club Night Type *</Form.Label>
                  <Form.Select
                    value={formData.club_night_type}
                    onChange={(e) => handleChange('club_night_type', e.target.value)}
                    isInvalid={!!errors.club_night_type}
                  >
                    <option value="NORMAL">Normal Dance</option>
                    <option value="FIFTH WED">Fifth Wednesday</option>
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">
                    {errors.club_night_type}
                  </Form.Control.Feedback>
                  <Form.Text className="text-muted">
                    Type of club night for this dance
                  </Form.Text>
                </Form.Group>
              </Col>
              
              <Col md={6}>
                {/* Assignment Status */}
                <Form.Group className="mb-3">
                  <Form.Label>Assignment Status</Form.Label>
                  <Form.Control
                    type="text"
                    value={
                      formData.squarehead1_id && formData.squarehead2_id ? 'Complete' :
                      formData.squarehead1_id || formData.squarehead2_id ? 'Partial' :
                      'Unassigned'
                    }
                    disabled
                    className="bg-light"
                  />
                  <Form.Text className="text-muted">
                    Status updates automatically based on assignments
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                {/* Squarehead 1 */}
                <Form.Group className="mb-3">
                  <Form.Label>Squarehead 1</Form.Label>
                  <Form.Select
                    value={formData.squarehead1_id}
                    onChange={(e) => handleChange('squarehead1_id', e.target.value)}
                    isInvalid={!!errors.squarehead1_id}
                    disabled={membersLoading}
                  >
                    <option value="">
                      {membersLoading ? 'Loading members...' : 'Select member...'}
                    </option>
                    {assignableMembers.map(member => {
                      const memberName = `${member.first_name} ${member.last_name}`
                      const partner = member.partner_id ? members.find(m => m.id === member.partner_id) : null
                      const partnerName = partner ? `${partner.first_name} ${partner.last_name}` : null
                      
                      return (
                        <option key={member.id} value={member.id}>
                          {memberName}
                          {partnerName && ` (Partner: ${partnerName})`}
                        </option>
                      )
                    })}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">
                    {errors.squarehead1_id}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              
              <Col md={6}>
                {/* Squarehead 2 */}
                <Form.Group className="mb-3">
                  <Form.Label>Squarehead 2</Form.Label>
                  <Form.Select
                    value={formData.squarehead2_id}
                    onChange={(e) => handleChange('squarehead2_id', e.target.value)}
                    isInvalid={!!errors.squarehead2_id}
                    disabled={membersLoading}
                  >
                    <option value="">
                      {membersLoading ? 'Loading members...' : 'Select member...'}
                    </option>
                    {assignableMembers.map(member => {
                      const memberName = `${member.first_name} ${member.last_name}`
                      const partner = member.partner_id ? members.find(m => m.id === member.partner_id) : null
                      const partnerName = partner ? `${partner.first_name} ${partner.last_name}` : null
                      
                      return (
                        <option key={member.id} value={member.id}>
                          {memberName}
                          {partnerName && ` (Partner: ${partnerName})`}
                        </option>
                      )
                    })}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">
                    {errors.squarehead2_id}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>

            {/* Assignment Error */}
            {errors.assignment && (
              <Alert variant="danger" className="mb-3">
                <FaExclamationTriangle className="me-2" />
                {errors.assignment}
              </Alert>
            )}

            {/* Conflict Errors */}
            {conflicts.length > 0 && (
              <Alert variant="danger" className="mb-3">
                <FaExclamationTriangle className="me-2" />
                <strong>Assignment Conflicts:</strong>
                <ul className="mb-0 mt-2">
                  {conflicts.map((conflict, index) => (
                    <li key={index}>{conflict}</li>
                  ))}
                </ul>
              </Alert>
            )}
            
            {/* Partner Preference Warnings */}
            {warnings.length > 0 && (
              <Alert variant="warning" className="mb-3">
                <FaExclamationTriangle className="me-2" />
                <strong>Partner Preferences:</strong>
                <ul className="mb-0 mt-2">
                  {warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </Alert>
            )}

            {/* Notes */}
            <Form.Group className="mb-3">
              <Form.Label>Notes</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Optional notes for this dance (e.g., special setup required, theme night, etc.)"
                isInvalid={!!errors.notes}
              />
              <Form.Control.Feedback type="invalid">
                {errors.notes}
              </Form.Control.Feedback>
            </Form.Group>

            {/* Assignment Summary */}
            {(formData.squarehead1_id || formData.squarehead2_id) && (
              <Alert variant="info" className="mb-0">
                <FaUsers className="me-2" />
                <strong>Assignment Summary:</strong>
                <div className="mt-2">
                  {formData.squarehead1_id && (
                    <div>Squarehead 1: {getMemberName(formData.squarehead1_id)}</div>
                  )}
                  {formData.squarehead2_id && (
                    <div>Squarehead 2: {getMemberName(formData.squarehead2_id)}</div>
                  )}
                  {formData.club_night_type !== 'NORMAL' && (
                    <div>Club Night: {formData.club_night_type}</div>
                  )}
                </div>
              </Alert>
            )}
          </Form>
        )}
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={isLoading}>
          <FaTimes className="me-2" />
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Saving...
            </>
          ) : (
            <>
              <FaSave className="me-2" />
              Save Assignment
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default AssignmentEditModal
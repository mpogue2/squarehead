import React from 'react'
import { Modal, Button, Alert, Row, Col } from 'react-bootstrap'
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa'

const ImportResultsModal = ({ show, onHide, results }) => {
  if (!results) return null

  console.log('Import Results Modal received:', results);
  
  // The Members component now gives us a clean, flat structure
  // Extract values with fallbacks to handle different response formats
  // The backend response structure can be:
  // 1. {imported: N, updated: N, skipped: N, shared_emails: N, errors: []} (newest format)
  // 2. {imported: N, updated: N, skipped: N, errors: []} (new format)
  // 3. {imported: N, skipped: N, duplicates_handled: N, errors: []} (older format)
  // 4. {imported: N, skipped: N, errors: []} (oldest format)
  const { 
    imported = 0, 
    updated = 0,
    skipped = 0, 
    shared_emails = 0,
    duplicates_handled = 0,
    auto_partnerships = 0,
    errors = [] 
  } = results;
  
  // For backward compatibility, handle all possible formats:
  // - shared_emails is the newest format for users with shared email addresses
  // - duplicates_handled was the old format for modified emails
  // - skipped in old format was used for duplicate emails that were modified
  const duplicates = shared_emails || duplicates_handled || (updated > 0 ? 0 : skipped);
  const partnerships = auto_partnerships || 0;
  
  console.log('Using values:', { imported, updated, skipped, duplicates, partnerships, errors });
  
  const hasErrors = errors.length > 0
  const hasWarnings = duplicates > 0 
  const hasSuccess = imported > 0 || updated > 0
  const hasUpdates = updated > 0

  const getOverallStatus = () => {
    if (hasErrors && !hasSuccess) return 'danger'
    if (hasErrors) return 'warning'
    if (hasWarnings) return 'info'
    if (hasUpdates) return 'primary'
    return 'success'
  }

  const getOverallMessage = () => {
    if (hasErrors && !hasSuccess) return 'Import Failed'
    if (hasErrors) return 'Import Completed with Errors'
    if (hasWarnings && shared_emails > 0) return 'Import Completed with Shared Emails'
    if (hasWarnings) return 'Import Completed with Duplicate Emails Handled'
    if (hasUpdates && imported === 0) return 'Import Completed - Records Updated'
    if (hasUpdates && imported > 0) return 'Import Completed - Records Created and Updated'
    return 'Import Successful'
  }

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <FaInfoCircle className="me-2" />
          CSV Import Results
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        <Alert variant={getOverallStatus()} className="mb-4">
          <Alert.Heading className="h5 mb-3">
            {getOverallMessage()}
          </Alert.Heading>
          
          <Row>
            <Col md={3}>
              <div className="text-center">
                <FaCheckCircle className="text-success mb-2" size={24} />
                <div className="h4 text-success">{imported}</div>
                <small className="text-muted">Members Imported</small>
              </div>
            </Col>
            {updated > 0 && (
              <Col md={3}>
                <div className="text-center">
                  <FaInfoCircle className="text-primary mb-2" size={24} />
                  <div className="h4 text-primary">{updated}</div>
                  <small className="text-muted">Records Updated</small>
                </div>
              </Col>
            )}
            {duplicates > 0 && (
              <Col md={updated > 0 ? 3 : 4}>
                <div className="text-center">
                  <FaInfoCircle className="text-info mb-2" size={24} />
                  <div className="h4 text-info">{duplicates}</div>
                  <small className="text-muted">Duplicates Handled</small>
                </div>
              </Col>
            )}
            {skipped > 0 && updated > 0 && (
              <Col md={3}>
                <div className="text-center">
                  <FaInfoCircle className="text-secondary mb-2" size={24} />
                  <div className="h4 text-secondary">{skipped}</div>
                  <small className="text-muted">Records Skipped</small>
                </div>
              </Col>
            )}
            <Col md={updated > 0 ? 3 : 4}>
              <div className="text-center">
                <FaExclamationTriangle className="text-warning mb-2" size={24} />
                <div className="h4 text-warning">{errors.length}</div>
                <small className="text-muted">Errors</small>
              </div>
            </Col>
          </Row>
        </Alert>

        {updated > 0 && (
          <Alert variant="primary" className="mb-3">
            <Alert.Heading className="h6">
              <FaInfoCircle className="me-2" />
              Existing Records Updated
            </Alert.Heading>
            <p className="mb-0">
              {updated} existing record{updated > 1 ? 's were' : ' was'} updated with the information from the CSV file.
              {skipped > 0 && ` ${skipped} record${skipped > 1 ? 's were' : ' was'} skipped (the admin account is protected from updates).`}
            </p>
          </Alert>
        )}
        
        {duplicates > 0 && (
          <Alert variant="info" className="mb-3">
            <Alert.Heading className="h6">
              <FaInfoCircle className="me-2" />
              {shared_emails > 0 ? 'Shared Email Addresses' : 'Duplicate Email Addresses Handled'}
            </Alert.Heading>
            
            {shared_emails > 0 ? (
              // New format - shared emails are kept the same
              <p className="mb-0">
                {shared_emails} email address{shared_emails > 1 ? 'es are' : ' is'} shared between multiple users.
                These members all share the same email address for login and notifications.
              </p>
            ) : (
              // Old format - modified emails with + suffix
              <p className="mb-0">
                {duplicates} email address{duplicates > 1 ? 'es were' : ' was'} already in use by existing members.
                Unique email addresses were automatically generated for these new members to avoid duplicates.
              </p>
            )}
            
            {!shared_emails && (
              <p className="mt-2 mb-0">
                <small className="text-muted">
                  Note: The original shared email is stored in the member's notes field and can be viewed on the member details page.
                </small>
              </p>
            )}
            
            {partnerships > 0 && (
              <div className="mt-3 pt-2 border-top">
                <p className="mb-0">
                  <strong>{partnerships} automatic partner relationship{partnerships !== 1 ? 's' : ''}</strong> created 
                  between members who share the same email address.
                </p>
              </div>
            )}
          </Alert>
        )}

        {hasErrors && (
          <Alert variant="warning" className="mb-0">
            <Alert.Heading className="h6">
              <FaExclamationTriangle className="me-2" />
              Import Errors ({errors.length})
            </Alert.Heading>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              <ul className="mb-0 small">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
            {errors.length > 10 && (
              <small className="text-muted mt-2 d-block">
                Showing all {errors.length} errors. Fix these issues and try importing again.
              </small>
            )}
          </Alert>
        )}
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default ImportResultsModal
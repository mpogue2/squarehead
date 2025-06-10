import React from 'react'
import { Modal, Button, Alert, Row, Col } from 'react-bootstrap'
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa'

const ImportResultsModal = ({ show, onHide, results }) => {
  if (!results) return null

  const { imported = 0, skipped = 0, errors = [] } = results
  const hasErrors = errors.length > 0
  const hasWarnings = skipped > 0
  const hasSuccess = imported > 0

  const getOverallStatus = () => {
    if (hasErrors && imported === 0) return 'danger'
    if (hasErrors) return 'warning'
    if (hasWarnings) return 'info'
    return 'success'
  }

  const getOverallMessage = () => {
    if (hasErrors && imported === 0) return 'Import Failed'
    if (hasErrors) return 'Import Completed with Errors'
    if (hasWarnings) return 'Import Completed with Warnings'
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
            <Col md={4}>
              <div className="text-center">
                <FaCheckCircle className="text-success mb-2" size={24} />
                <div className="h4 text-success">{imported}</div>
                <small className="text-muted">Members Imported</small>
              </div>
            </Col>
            <Col md={4}>
              <div className="text-center">
                <FaInfoCircle className="text-info mb-2" size={24} />
                <div className="h4 text-info">{skipped}</div>
                <small className="text-muted">Members Skipped</small>
              </div>
            </Col>
            <Col md={4}>
              <div className="text-center">
                <FaExclamationTriangle className="text-warning mb-2" size={24} />
                <div className="h4 text-warning">{errors.length}</div>
                <small className="text-muted">Errors</small>
              </div>
            </Col>
          </Row>
        </Alert>

        {skipped > 0 && (
          <Alert variant="info" className="mb-3">
            <Alert.Heading className="h6">
              <FaInfoCircle className="me-2" />
              Skipped Members
            </Alert.Heading>
            <p className="mb-0">
              {skipped} member{skipped > 1 ? 's were' : ' was'} skipped because {skipped > 1 ? 'they' : 'it'} already exist{skipped === 1 ? 's' : ''} in the database. 
              Existing members are identified by email address.
            </p>
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
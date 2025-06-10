import React, { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Container, Nav, Navbar, Offcanvas, Button, Badge } from 'react-bootstrap'
import { useCurrentUser, useLogout } from '../hooks/useAuth'
import { useSettings } from '../hooks/useSettings'
import { useUI } from '../hooks/useUI'
import MemberEditModal from './members/MemberEditModal'
import MemberDeleteModal from './members/MemberDeleteModal'

const Layout = () => {
  const { user, isAdmin } = useCurrentUser()
  const { logout } = useLogout()
  const { isOpen: isModalOpen, close: closeModal } = useUI()
  const location = useLocation()
  const [showSidebar, setShowSidebar] = useState(false)
  
  // Fetch club settings for branding
  const { data: settings } = useSettings()
  
  const clubName = settings?.club_name || 'Square Dance Club'
  const clubSubtitle = settings?.club_subtitle || 'Dance Management System'
  const clubColor = settings?.club_color || '#0d6efd'
  
  const handleCloseSidebar = () => setShowSidebar(false)
  const handleShowSidebar = () => setShowSidebar(true)
  
  const navigationItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'house-door' },
    { path: '/members', label: 'Members', icon: 'people' },
    { path: '/map', label: 'Map', icon: 'geo-alt' },
    { path: '/current-schedule', label: 'Current Schedule', icon: 'calendar-check' },
    { path: '/next-schedule', label: 'Next Schedule', icon: 'calendar-plus' },
    ...(isAdmin ? [{ path: '/admin', label: 'Admin', icon: 'gear' }] : [])
  ]
  
  const SidebarContent = ({ isMobile = false }) => (
    <>
      {/* Brand with club settings */}
      <div className="mb-4">
        <Navbar.Brand className="text-white">
          <div className="d-flex align-items-center">
            <div 
              className="rounded-circle d-flex align-items-center justify-content-center me-3"
              style={{ 
                width: '40px', 
                height: '40px', 
                backgroundColor: clubColor,
                border: '2px solid rgba(255,255,255,0.3)'
              }}
            >
              <i className="bi bi-music-note text-white"></i>
            </div>
            <div>
              <h5 className="mb-0 text-white">{clubName}</h5>
              {clubSubtitle && (
                <small className="text-white-50" style={{ fontSize: '0.75rem' }}>
                  {clubSubtitle}
                </small>
              )}
            </div>
          </div>
        </Navbar.Brand>
      </div>
      
      {/* User Info with enhanced styling */}
      <div className="mb-4 pb-3 border-bottom border-secondary">
        <div className="d-flex align-items-center mb-2">
          <div 
            className="rounded-circle d-flex align-items-center justify-content-center me-3" 
            style={{ 
              width: '45px', 
              height: '45px',
              background: `linear-gradient(135deg, ${clubColor}, ${clubColor}99)`
            }}
          >
            <i className="bi bi-person-fill text-white" style={{ fontSize: '1.2rem' }}></i>
          </div>
          <div className="flex-grow-1">
            <div className="d-flex align-items-center flex-wrap">
              <span className="text-white fw-bold me-2">
                {user?.first_name} {user?.last_name}
              </span>
              {isAdmin && (
                <Badge 
                  bg="danger" 
                  className="fs-6"
                  style={{ fontSize: '0.7rem !important' }}
                >
                  <i className="bi bi-shield-check me-1"></i>
                  Admin
                </Badge>
              )}
            </div>
            <small className="text-white-50 d-block">{user?.email}</small>
          </div>
        </div>
      </div>
      
      {/* Navigation with enhanced styling */}
      <Nav className="flex-column">
        {navigationItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Nav.Link
              key={item.path}
              as={NavLink}
              to={item.path}
              className={`text-white mb-2 rounded px-3 py-3 d-flex align-items-center position-relative ${
                isActive ? 'active' : ''
              }`}
              onClick={isMobile ? handleCloseSidebar : undefined}
              style={{ 
                textDecoration: 'none',
                backgroundColor: isActive ? clubColor : 'transparent',
                transition: 'all 0.2s ease-in-out',
                boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.target.style.backgroundColor = 'transparent'
                }
              }}
            >
              <i className={`bi bi-${item.icon} me-3`} style={{ fontSize: '1.1rem' }}></i>
              <span className="fw-medium">{item.label}</span>
              {isActive && (
                <div 
                  className="position-absolute top-50 start-0 translate-middle-y"
                  style={{
                    width: '4px',
                    height: '100%',
                    backgroundColor: 'white',
                    borderRadius: '0 2px 2px 0'
                  }}
                />
              )}
            </Nav.Link>
          )
        })}
        
        <hr className="border-secondary my-3" />
        
        <Nav.Link 
          className="text-white rounded px-3 py-3 d-flex align-items-center" 
          onClick={() => {
            if (isMobile) handleCloseSidebar()
            logout()
          }}
          style={{ 
            cursor: 'pointer', 
            textDecoration: 'none',
            transition: 'all 0.2s ease-in-out'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = 'rgba(220, 53, 69, 0.2)'
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = 'transparent'
          }}
        >
          <i className="bi bi-box-arrow-right me-3" style={{ fontSize: '1.1rem' }}></i>
          <span className="fw-medium">Logout</span>
        </Nav.Link>
      </Nav>
    </>
  )
  
  return (
    <>
      {/* Mobile Header with club branding */}
      <div className="d-lg-none">
        <Navbar 
          className="px-3"
          style={{ backgroundColor: clubColor }}
        >
          <Button
            variant="outline-light"
            onClick={handleShowSidebar}
            className="me-3"
          >
            <i className="bi bi-list"></i>
          </Button>
          <Navbar.Brand className="text-white">
            <div className="d-flex align-items-center">
              <i className="bi bi-music-note me-2"></i>
              <span className="fw-bold">{clubName}</span>
            </div>
          </Navbar.Brand>
        </Navbar>
      </div>
      
      {/* Mobile Sidebar */}
      <Offcanvas 
        show={showSidebar} 
        onHide={handleCloseSidebar} 
        className="bg-dark text-white d-lg-none"
        style={{ width: '280px' }}
      >
        <Offcanvas.Header closeButton closeVariant="white">
          <Offcanvas.Title>Navigation</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="p-3">
          <SidebarContent isMobile={true} />
        </Offcanvas.Body>
      </Offcanvas>

      <div className="d-flex">
        {/* Desktop Sidebar with club theme */}
        <div 
          className="d-none d-lg-block text-white p-4" 
          style={{ 
            width: '300px', 
            minHeight: '100vh',
            background: `linear-gradient(180deg, #2c3e50 0%, #34495e 100%)`,
            boxShadow: '2px 0 10px rgba(0,0,0,0.1)'
          }}
        >
          <SidebarContent />
        </div>

        {/* Main Content Area */}
        <div className="flex-grow-1" style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
          <Container fluid className="p-4">
            {/* Enhanced Page Header */}
            <div className="mb-4">
              <div className="d-flex justify-content-between align-items-start">
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center mb-2">
                    <div 
                      className="rounded-circle d-flex align-items-center justify-content-center me-3"
                      style={{ 
                        width: '35px', 
                        height: '35px', 
                        backgroundColor: clubColor,
                        opacity: 0.9
                      }}
                    >
                      <i 
                        className={`bi bi-${navigationItems.find(item => item.path === location.pathname)?.icon || 'house-door'} text-white`}
                        style={{ fontSize: '1rem' }}
                      ></i>
                    </div>
                    <h2 className="mb-0" style={{ color: clubColor }}>
                      {navigationItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
                    </h2>
                  </div>
                  <nav aria-label="breadcrumb">
                    <ol className="breadcrumb mb-0">
                      <li className="breadcrumb-item">
                        <NavLink to="/dashboard" className="text-decoration-none">
                          <i className="bi bi-house-door me-1"></i>
                          Home
                        </NavLink>
                      </li>
                      {location.pathname !== '/dashboard' && (
                        <li className="breadcrumb-item active" aria-current="page">
                          {navigationItems.find(item => item.path === location.pathname)?.label}
                        </li>
                      )}
                    </ol>
                  </nav>
                </div>
                
                <div className="d-flex align-items-center">
                  <div className="text-end me-3">
                    <div className="text-muted small">Welcome back,</div>
                    <div className="fw-bold">{user?.first_name}!</div>
                  </div>
                  {isAdmin && (
                    <Badge 
                      style={{ backgroundColor: clubColor }}
                      className="d-flex align-items-center"
                    >
                      <i className="bi bi-shield-check me-1"></i>
                      Administrator
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            {/* Enhanced Page Content */}
            <div 
              className="bg-white rounded shadow-sm p-4"
              style={{ 
                boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                border: '1px solid rgba(0,0,0,0.05)'
              }}
            >
              <Outlet />
            </div>
          </Container>
        </div>
      </div>
      
      {/* Global Modals */}
      <MemberEditModal 
        show={isModalOpen('editMember')} 
        onHide={() => closeModal('editMember')} 
      />
      <MemberDeleteModal 
        show={isModalOpen('deleteMember')} 
        onHide={() => closeModal('deleteMember')} 
      />
    </>
  )
}

export default Layout

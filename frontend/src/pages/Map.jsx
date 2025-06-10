import React, { useEffect, useRef, useState } from 'react'
import { Card, Alert, Spinner } from 'react-bootstrap'
import { useMembers } from '../hooks/useMembers'
import { useSettings } from '../hooks/useSettings'

const Map = () => {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const { data: members = [] } = useMembers()
  const { data: settings, isLoading: settingsLoading } = useSettings()

  // Default center coordinates for San Jose (fallback)
  const SAN_JOSE_CENTER = { lat: 37.3382, lng: -121.8863 }
  
  // Get settings data (handle both possible formats)
  const settingsData = settings?.data || settings || {}
  const GOOGLE_API_KEY = settingsData.google_api_key || 'AIzaSyBl_FwZaAhv8LPrYH-uT45nIU83ekbjjvA'
  
  // Use cached club location if available, otherwise fall back to hardcoded coordinates
  const CLUB_LOCATION = (settingsData.club_lat && settingsData.club_lng) ? {
    lat: parseFloat(settingsData.club_lat),
    lng: parseFloat(settingsData.club_lng)
  } : { lat: 37.2550845, lng: -121.9231777 } // Fallback to Cambrian United Methodist Church

  useEffect(() => {
    // Wait for settings to load before initializing map
    if (settingsLoading || !settings) {
      return
    }
    
    // Load Google Maps API if not already loaded
    if (!window.google) {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&callback=initMap`
      script.async = true
      script.defer = true
      
      // Define global callback function
      window.initMap = initializeMap
      
      script.onerror = () => {
        setError('Failed to load Google Maps API')
        setIsLoading(false)
      }
      
      document.head.appendChild(script)
    } else {
      // Google Maps API already loaded
      initializeMap()
    }

    return () => {
      // Cleanup callback
      if (window.initMap) {
        delete window.initMap
      }
    }
  }, [settingsLoading, settings, GOOGLE_API_KEY])

  useEffect(() => {
    // Update markers when members data changes
    if (mapInstanceRef.current && members.length > 0) {
      addMemberMarkers()
    }
  }, [members])

  const initializeMap = () => {
    try {
      if (!mapRef.current) return

      // Initialize the map
      const map = new window.google.maps.Map(mapRef.current, {
        zoom: 11,
        center: SAN_JOSE_CENTER,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP
      })

      mapInstanceRef.current = map

      // Add club location marker (red star)
      addClubMarker(map)

      // Add member markers if data is available
      if (members.length > 0) {
        addMemberMarkers()
      }

      setIsLoading(false)
    } catch (err) {
      setError('Failed to initialize map: ' + err.message)
      setIsLoading(false)
    }
  }

  const addClubMarker = (map) => {
    // Create red star icon for club location
    const clubIcon = {
      path: 'M 0,-24 6,-7.2 24,-7.2 9.6,1.44 15.6,19.2 0,7.2 -15.6,19.2 -9.6,1.44 -24,-7.2 -6,-7.2 z',
      fillColor: '#FF0000',
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 1,
      scale: 0.6
    }

    new window.google.maps.Marker({
      position: CLUB_LOCATION,
      map: map,
      icon: clubIcon,
      title: `${settingsData.club_name || 'Club'} Location (${settingsData.club_address || 'Dance Hall'})`,
      zIndex: 1000 // Higher z-index for club marker
    })
  }

  const addMemberMarkers = () => {
    if (!mapInstanceRef.current || !window.google) return

    // Function to get star color based on member status
    const getStarColor = (status) => {
      switch (status) {
        case 'assignable':
          return '#28a745' // Bootstrap success green (light green)
        case 'booster':
          return '#6f42c1' // Bootstrap purple (better contrast with green)
        case 'loa':
          return '#6c757d' // Bootstrap secondary gray (light grey)
        case 'exempt':
          return '#ffc107' // Bootstrap warning yellow (keeping yellow for exempt)
        default:
          return '#28a745' // Default to assignable green
      }
    }

    // Function to create star icon with specific color
    const createStarIcon = (color) => ({
      path: 'M 0,-24 6,-7.2 24,-7.2 9.6,1.44 15.6,19.2 0,7.2 -15.6,19.2 -9.6,1.44 -24,-7.2 -6,-7.2 z',
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 1,
      scale: 0.6
    })

    // Track addresses to implement jittering for duplicates
    const processedAddresses = {}
    
    // Separate members into those with cached coordinates and those needing geocoding
    const membersWithCoords = []
    const membersNeedingGeocoding = []

    members.forEach((member) => {
      if (!member.address || member.address.trim() === '' || member.address === 'Web Host') {
        return // Skip members without valid addresses
      }

      // Check if member has cached coordinates
      if (member.latitude && member.longitude) {
        membersWithCoords.push(member)
      } else {
        membersNeedingGeocoding.push(member)
      }
    })

    // Process members with cached coordinates first (instant)
    membersWithCoords.forEach((member) => {
      const address = member.address.trim()
      let lat = parseFloat(member.latitude)
      let lng = parseFloat(member.longitude)

      // Implement jittering for duplicate addresses
      if (!processedAddresses[address]) {
        processedAddresses[address] = { count: 0, basePos: { lat, lng } }
      }
      
      const addrInfo = processedAddresses[address]
      if (addrInfo.count > 0) {
        // Apply jittering - small random offset to make markers visible
        const jitterRadius = 0.001 // About 100 meters
        const angle = (addrInfo.count * 60) % 360 // Spread markers in a circle
        const radians = (angle * Math.PI) / 180
        
        lat += jitterRadius * Math.cos(radians)
        lng += jitterRadius * Math.sin(radians)
      }
      addrInfo.count++

      // Create marker for this member using cached coordinates
      createMemberMarker(member, lat, lng, address)
    })

    // Only geocode members that don't have cached coordinates
    if (membersNeedingGeocoding.length > 0) {
      console.log(`Geocoding ${membersNeedingGeocoding.length} member addresses that don't have cached coordinates`)
      
      const geocoder = new window.google.maps.Geocoder()

      membersNeedingGeocoding.forEach((member, index) => {
        const address = member.address.trim()
        
        // Add a small delay between geocoding requests to avoid rate limiting
        setTimeout(() => {
          geocoder.geocode({ address: address }, (results, status) => {
            if (status === 'OK' && results[0]) {
              const location = results[0].geometry.location
              let lat = location.lat()
              let lng = location.lng()

              // Implement jittering for duplicate addresses
              if (!processedAddresses[address]) {
                processedAddresses[address] = { count: 0, basePos: { lat, lng } }
              }
              
              const addrInfo = processedAddresses[address]
              if (addrInfo.count > 0) {
                // Apply jittering - small random offset to make markers visible
                const jitterRadius = 0.001 // About 100 meters
                const angle = (addrInfo.count * 60) % 360 // Spread markers in a circle
                const radians = (angle * Math.PI) / 180
                
                lat += jitterRadius * Math.cos(radians)
                lng += jitterRadius * Math.sin(radians)
              }
              addrInfo.count++

              // Create marker for this member
              createMemberMarker(member, lat, lng, address)

            } else {
              console.warn(`Geocoding failed for address: ${address}, status: ${status}`)
            }
          })
        }, index * 100) // Stagger requests by 100ms
      })
    }
  }

  // Helper function to create a member marker
  const createMemberMarker = (member, lat, lng, address) => {
    // Function to get star color based on member status
    const getStarColor = (status) => {
      switch (status) {
        case 'assignable':
          return '#28a745' // Bootstrap success green (light green)
        case 'booster':
          return '#6f42c1' // Bootstrap purple (better contrast with green)
        case 'loa':
          return '#6c757d' // Bootstrap secondary gray (light grey)
        case 'exempt':
          return '#ffc107' // Bootstrap warning yellow (keeping yellow for exempt)
        default:
          return '#28a745' // Default to assignable green
      }
    }

    // Function to create star icon with specific color
    const createStarIcon = (color) => ({
      path: 'M 0,-24 6,-7.2 24,-7.2 9.6,1.44 15.6,19.2 0,7.2 -15.6,19.2 -9.6,1.44 -24,-7.2 -6,-7.2 z',
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 1,
      scale: 0.6
    })

    // Create marker icon with color based on member status
    const memberIcon = createStarIcon(getStarColor(member.status))

    // Create marker for this member
    const marker = new window.google.maps.Marker({
      position: { lat, lng },
      map: mapInstanceRef.current,
      icon: memberIcon,
      title: `${member.first_name} ${member.last_name}\n${address}\nStatus: ${member.status}`,
      zIndex: 100
    })

    // Add info window with member details
    const infoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="max-width: 200px;">
          <h6 style="margin: 0 0 5px 0; color: #333;">
            ${member.first_name} ${member.last_name}
          </h6>
          <p style="margin: 0 0 3px 0; font-size: 12px; color: #666;">
            ${member.email}
          </p>
          ${member.phone ? `<p style="margin: 0 0 3px 0; font-size: 12px; color: #666;">${member.phone}</p>` : ''}
          <p style="margin: 0 0 3px 0; font-size: 11px;">
            Status: <span style="color: ${getStarColor(member.status)}; font-weight: bold;">${member.status.charAt(0).toUpperCase() + member.status.slice(1)}</span>
          </p>
          <p style="margin: 0; font-size: 11px; color: #888;">
            ${address}
          </p>
          ${member.latitude && member.longitude ? '<p style="margin: 0; font-size: 10px; color: #aaa;">(Using cached coordinates)</p>' : '<p style="margin: 0; font-size: 10px; color: #aaa;">(Geocoded on demand)</p>'}
        </div>
      `
    })

    marker.addListener('click', () => {
      infoWindow.open(mapInstanceRef.current, marker)
    })
  }

  if (error) {
    return (
      <div>
        <h1>Member Locations Map</h1>
        <Alert variant="danger">
          <Alert.Heading>Map Error</Alert.Heading>
          <p>{error}</p>
          <p>Please check your internet connection and try refreshing the page.</p>
        </Alert>
      </div>
    )
  }

  return (
    <div>
      <h1>Member Locations Map</h1>
      
      {(isLoading || settingsLoading) && (
        <Card>
          <Card.Body className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3">
              {settingsLoading ? 'Loading settings...' : 'Loading Google Maps...'}
            </p>
          </Card.Body>
        </Card>
      )}

      <Card className={(isLoading || settingsLoading) ? 'd-none' : ''}>
        <Card.Body className="p-0">
          <div 
            ref={mapRef} 
            style={{ 
              height: '600px', 
              width: '100%',
              borderRadius: '0.375rem'
            }}
          />
        </Card.Body>
        <Card.Footer className="bg-light">
          <small className="text-muted">
            <span style={{ color: '#28a745' }}>★</span> Assignable Members &nbsp;&nbsp;
            <span style={{ color: '#6f42c1' }}>★</span> Booster Members &nbsp;&nbsp;
            <span style={{ color: '#6c757d' }}>★</span> LOA Members &nbsp;&nbsp;
            <span style={{ color: '#ffc107' }}>★</span> Exempt Members &nbsp;&nbsp;
            <span className="text-danger">★</span> Club Location
          </small>
        </Card.Footer>
      </Card>
    </div>
  )
}

export default Map

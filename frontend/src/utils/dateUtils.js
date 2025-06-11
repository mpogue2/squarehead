/**
 * Date formatting utilities for the Square Dance Club Management System
 * 
 * These utilities handle date formatting while avoiding timezone conversion issues
 * that occur when using `new Date(dateString)` with YYYY-MM-DD format strings.
 */

/**
 * Parse a date string (YYYY-MM-DD) as a local date without timezone conversion
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {Date|null} - Date object or null if invalid
 */
export const parseLocalDate = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return null
  
  const [year, month, day] = dateString.split('-').map(Number)
  
  // Validate the parts
  if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
    return null
  }
  
  // Create date with local timezone (month is 0-indexed)
  return new Date(year, month - 1, day)
}

/**
 * Format date as "MMM DD" (e.g., "Jun 09")
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} - Formatted date string or empty string if invalid
 */
export const formatClipboardDate = (dateString) => {
  if (!dateString) return ''
  
  const date = parseLocalDate(dateString)
  if (!date) return ''
  
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const day = date.getDate().toString().padStart(2, '0')
  
  return `${month} ${day}`
}

/**
 * Format date for full display (e.g., "Monday, June 9, 2025")
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} - Formatted date string or 'Not set' if invalid
 */
export const formatDate = (dateString) => {
  if (!dateString) return 'Not set'
  
  const date = parseLocalDate(dateString)
  if (!date) return 'Invalid date'
  
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Format date for table display (e.g., "Jun 9, 2025")
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} - Formatted date string or 'Not set' if invalid
 */
export const formatTableDate = (dateString) => {
  if (!dateString) return 'Not set'
  
  const date = parseLocalDate(dateString)
  if (!date) return 'Invalid date'
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

/**
 * Format date for compact display (e.g., "6/9/2025")
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} - Formatted date string or 'Not set' if invalid
 */
export const formatCompactDate = (dateString) => {
  if (!dateString) return 'Not set'
  
  const date = parseLocalDate(dateString)
  if (!date) return 'Invalid date'
  
  return date.toLocaleDateString('en-US')
}

/**
 * Get day of week from date string
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} - Day of week (e.g., "Monday") or empty string if invalid
 */
export const getDayOfWeek = (dateString) => {
  if (!dateString) return ''
  
  const date = parseLocalDate(dateString)
  if (!date) return ''
  
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

/**
 * Check if a date string represents a valid date
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {boolean} - True if valid date
 */
export const isValidDate = (dateString) => {
  return parseLocalDate(dateString) !== null
}

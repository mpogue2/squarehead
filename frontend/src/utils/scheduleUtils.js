/**
 * Utility functions for schedule formatting and processing
 */
import { formatClipboardDate } from './dateUtils';

/**
 * Extracts user ID from an assignment's squarehead fields
 * @param {Object} assignment - Assignment object
 * @param {string} position - Either 'squarehead1' or 'squarehead2'
 * @returns {string|null} - User ID or null if not found
 */
const extractUserId = (assignment, position) => {
  const idField = `${position}_id`;
  if (!assignment[idField]) {
    return null;
  }
  // Ensure the ID is a string for consistent comparison
  return assignment[idField].toString();
};

/**
 * Formats a name for clipboard based on partnership status and last names
 * @param {string} name1 - First person's name
 * @param {string} name2 - Second person's name
 * @param {boolean} arePartners - Whether these two people are partners
 * @returns {string} - Formatted name string
 */
export const formatNamesForClipboard = (name1, name2, arePartners = false) => {
  if (!name1 && !name2) return '';
  if (!name1) return name2;
  if (!name2) return name1;

  // Split names into first and last name components
  const [firstName1, ...lastNameParts1] = name1.split(' ');
  const [firstName2, ...lastNameParts2] = name2.split(' ');
  
  const lastName1 = lastNameParts1.join(' ');
  const lastName2 = lastNameParts2.join(' ');
  
  // Check if both people have the same last name
  const sameSurname = lastName1 && lastName2 && lastName1.toLowerCase() === lastName2.toLowerCase();

  // If they are partners in the database
  if (arePartners) {
    // If partners with same last name, use the combined "First1 & First2 LastName" format
    if (sameSurname) {
      return `${firstName1} & ${firstName2} ${lastName1}`;
    }
    // Partners with different last names use the full names
    return `${name1} & ${name2}`;
  }
  
  // If not partners, return comma-separated
  return `${name1}, ${name2}`;
};

/**
 * Extract last name from a full name string
 * @param {string} name - Full name
 * @returns {string} - Last name or empty string
 */
const getLastName = (name) => {
  if (!name) return '';
  const parts = name.split(' ');
  return parts.length > 1 ? parts[parts.length - 1] : '';
};

/**
 * Format schedule assignments for clipboard
 * @param {Array} assignments - Array of assignment objects
 * @param {Map} partnerMap - Map of user IDs to their partner IDs
 * @returns {string} - Formatted schedule text for clipboard
 */
export const formatScheduleForClipboard = (assignments, partnerMap = new Map()) => {
  if (!assignments || !assignments.length) return '';
  
  // Sort assignments by date
  const sortedAssignments = [...assignments].sort((a, b) => 
    new Date(a.dance_date) - new Date(b.dance_date)
  );
  
  return sortedAssignments.map(assignment => {
    const dateStr = formatClipboardDate(assignment.dance_date);
    
    // Handle fifth Wednesdays
    if (assignment.club_night_type === 'FIFTH WED') {
      return `${dateStr}: The RJ Board for 5TH Wednesday!`;
    }
    
    // Get names or empty strings if not assigned
    let name1 = assignment.squarehead1_name || '';
    let name2 = assignment.squarehead2_name || '';
    
    // If no squareheads assigned
    if (!name1 && !name2) {
      return `${dateStr}: Unassigned`;
    }
    
    // Extract user IDs for checking partnership
    const id1 = extractUserId(assignment, 'squarehead1');
    const id2 = extractUserId(assignment, 'squarehead2');
    
    // Check if these two people are partners in the database
    let arePartners = false;
    if (id1 && id2 && partnerMap.size > 0) {
      // Check both directions since partnership is bidirectional
      arePartners = 
        (partnerMap.get(id1) === id2) || 
        (partnerMap.get(id2) === id1);
      
      // Debug log for partnership detection
      if (arePartners) {
        console.log(`Detected partners: ${name1} and ${name2} (IDs: ${id1}, ${id2})`);
      }
    }
    
    // Sort names alphabetically by last name if both are present and they're not partners
    if (name1 && name2 && !arePartners) {
      const lastName1 = getLastName(name1).toLowerCase();
      const lastName2 = getLastName(name2).toLowerCase();
      
      if (lastName1 > lastName2) {
        [name1, name2] = [name2, name1]; // Swap to maintain alphabetical order
      }
    }
    
    // Format squarehead names, handling same last name case or partners
    let formattedNames = formatNamesForClipboard(name1, name2, arePartners);
    
    return `${dateStr}: ${formattedNames}`;
  }).join('\n');
};

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} - Success status
 */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
};
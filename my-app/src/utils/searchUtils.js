import axios from 'axios';
import { message } from 'antd';
import { debounce } from 'lodash';

/**
 * Utility functions for file search operations
 * These functions can be used across all dashboards (research, training, operation, filemanager)
 *
 * Search behavior:
 * - In FileManager: When at root, search all files. When in a folder, search only within that folder.
 * - In dashboards (Operation, Training, Research): Search only within the current dashboard and/or subfolder.
 */

/**
 * Format file size in human-readable form
 * @param {number} size - File size in bytes
 * @returns {string} - Formatted file size
 */
export const formatFileSize = (size) => {
  if (size === undefined || size === null) return 'Unknown';
  if (size === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(size) / Math.log(1024));
  return (size / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
};

/**
 * Perform a search for files across all subfolders or within a specific main folder
 * @param {string} query - The search query
 * @param {string} mainFolder - Optional main folder to restrict search to (e.g., 'Research', 'Training', 'Operation')
 * @param {string} baseUrl - Base URL for API calls (optional, defaults to server on same host)
 * @param {Function} onSuccess - Callback function with search results
 * @param {Function} onError - Callback function for error handling
 * @param {Function} onLoadingChange - Callback function to update loading state
 * @returns {Promise} - Promise that resolves with search results
 */
export const performSearch = async (
  query,
  mainFolder = null,
  baseUrl = null,
  onSuccess,
  onError,
  onLoadingChange
) => {
  if (!query.trim()) {
    if (onSuccess) onSuccess([]);
    return [];
  }

  if (onLoadingChange) onLoadingChange(true);

  try {
    // Use the provided baseUrl or construct a default one
    const BASE_URL = baseUrl || `${window.location.protocol}//${window.location.hostname}:8080`;

    // Build the search URL with the main folder parameter if specified
    const searchUrl = mainFolder
      ? `${BASE_URL}/search?q=${encodeURIComponent(query)}&main_folder=${encodeURIComponent(mainFolder)}`
      : `${BASE_URL}/search?q=${encodeURIComponent(query)}`;

    const response = await axios.get(searchUrl, { withCredentials: true });

    // Format the search results
    const formattedResults = (response.data || []).map(item => {
      // Ensure size is a valid number
      const fileSize = typeof item.size === 'number' ? item.size :
                      (item.size ? parseInt(item.size, 10) : null);

      return {
        ...item,
        size: fileSize,
        formattedSize: formatFileSize(fileSize),
      };
    });

    // Sort the results: directories first (in ascending order), then files (in ascending order)
    const sortedResults = [...formattedResults].sort((a, b) => {
      // If types are different (directory vs file)
      if (a.type !== b.type) {
        // Directories come before files
        return a.type === 'directory' ? -1 : 1;
      }
      // If types are the same, sort alphabetically by name
      return a.name.localeCompare(b.name);
    });

    console.log(`🔍 Search found ${sortedResults.length} results`);

    if (onSuccess) onSuccess(sortedResults);
    if (onLoadingChange) onLoadingChange(false);

    return sortedResults;
  } catch (error) {
    console.error('Search error:', error);
    message.error('Error performing search');

    if (onError) onError(error);
    if (onLoadingChange) onLoadingChange(false);

    return [];
  }
};

/**
 * Create a debounced search function
 * @param {Function} searchFn - The search function to debounce
 * @param {number} delay - Debounce delay in milliseconds (default: 500ms)
 * @returns {Function} - Debounced search function
 */
export const createDebouncedSearch = (searchFn, delay = 500) => {
  return debounce(searchFn, delay);
};

/**
 * Context-aware search function that behaves differently based on the component and current path
 *
 * @param {string} query - The search query
 * @param {string} componentType - The type of component ('filemanager', 'operation', 'training', 'research')
 * @param {string} currentPath - The current path/directory being viewed
 * @param {string} baseUrl - Base URL for API calls
 * @param {Function} onSuccess - Callback function with search results
 * @param {Function} onError - Callback function for error handling
 * @param {Function} onLoadingChange - Callback function to update loading state
 * @returns {Promise} - Promise that resolves with search results
 */
export const contextAwareSearch = async (
  query,
  componentType,
  currentPath,
  baseUrl = null,
  onSuccess,
  onError,
  onLoadingChange
) => {
  if (!query.trim()) {
    if (onSuccess) onSuccess([]);
    return [];
  }

  // Determine search scope based on component type and current path
  let mainFolder = null;
  let searchDirectory = null;

  console.log(`🔍 contextAwareSearch called with query: "${query}", componentType: "${componentType}", currentPath: "${currentPath}"`);

  switch (componentType.toLowerCase()) {
    case 'filemanager':
      // In FileManager: When at root, search all files. When in a folder, search only within that folder.
      if (currentPath) {
        // If we're in a subfolder, search only within that folder
        searchDirectory = currentPath;

        // Extract main folder from path if it exists
        const pathParts = currentPath.split('/');
        if (pathParts.length > 0) {
          mainFolder = pathParts[0];
        }
      }
      // If at root (no currentPath), search everywhere (mainFolder remains null)
      break;

    case 'operation':
    case 'training':
    case 'research':
      // In dashboards: Always limit to the specific dashboard
      mainFolder = componentType.charAt(0).toUpperCase() + componentType.slice(1);
      console.log(`🔍 Setting mainFolder to: "${mainFolder}"`);

      // If currentPath is null, we want to search all files in this dashboard
      if (currentPath === null) {
        console.log(`🔍 currentPath is null, searching all files in ${mainFolder}`);
        // Don't set searchDirectory, so we search all files in this dashboard
      }
      // If in a subfolder, further limit to that subfolder
      else if (currentPath && currentPath !== mainFolder) {
        searchDirectory = currentPath;
        console.log(`🔍 Setting searchDirectory to: "${searchDirectory}"`);
      } else {
        // If at root level of the dashboard, search all files in this dashboard
        console.log(`🔍 At root level of ${mainFolder}, searching all files in this dashboard`);
      }
      break;

    default:
      // Default behavior: search everywhere
      console.log(`🔍 Using default search behavior (search everywhere)`);
      break;
  }

  console.log(`🔍 Final search parameters - mainFolder: "${mainFolder}", searchDirectory: "${searchDirectory || 'null'}"`);

  if (onLoadingChange) onLoadingChange(true);

  try {
    // Use the provided baseUrl or construct a default one
    const BASE_URL = baseUrl || `${window.location.protocol}//${window.location.hostname}:8080`;

    // Build the search URL with appropriate parameters
    let searchUrl = `${BASE_URL}/search?q=${encodeURIComponent(query)}`;

    // Add main folder parameter if specified
    if (mainFolder) {
      searchUrl += `&main_folder=${encodeURIComponent(mainFolder)}`;
    }

    // Add directory parameter if specified (for more specific subfolder search)
    if (searchDirectory) {
      searchUrl += `&directory=${encodeURIComponent(searchDirectory)}`;
    }

    console.log(`🔍 Making search request to: ${searchUrl}`);

    const response = await axios.get(searchUrl, { withCredentials: true });
    console.log(`🔍 Search response received:`, response.data);

    // Format the search results
    const formattedResults = (response.data || []).map(item => {
      // Ensure size is a valid number
      const fileSize = typeof item.size === 'number' ? item.size :
                      (item.size ? parseInt(item.size, 10) : null);

      return {
        ...item,
        size: fileSize,
        formattedSize: formatFileSize(fileSize),
      };
    });

    // Sort the results: directories first (in ascending order), then files (in ascending order)
    const sortedResults = [...formattedResults].sort((a, b) => {
      // If types are different (directory vs file)
      if (a.type !== b.type) {
        // Directories come before files
        return a.type === 'directory' ? -1 : 1;
      }
      // If types are the same, sort alphabetically by name
      return a.name.localeCompare(b.name);
    });

    console.log(`🔍 Context-aware search found ${sortedResults.length} results`);

    if (onSuccess) onSuccess(sortedResults);
    if (onLoadingChange) onLoadingChange(false);

    return sortedResults;
  } catch (error) {
    console.error('Search error:', error);
    message.error('Error performing search');

    if (onError) onError(error);
    if (onLoadingChange) onLoadingChange(false);

    return [];
  }
};

/**
 * Generate search suggestions based on a query and recent searches
 *
 * @param {string} query - The search query
 * @param {Array} recentSearches - Array of recent search terms
 * @param {Array} fileNames - Array of file names to suggest from
 * @param {number} maxSuggestions - Maximum number of suggestions to return
 * @returns {Array} - Array of suggestion strings
 */
export const generateSearchSuggestions = (
  query,
  recentSearches = [],
  fileNames = [],
  maxSuggestions = 8
) => {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();

  // Create arrays to store different types of matches with priority
  const exactMatches = [];
  const startsWithMatches = [];
  const containsMatches = [];

  // First prioritize file names that match the query
  fileNames.forEach(name => {
    const lowerName = name.toLowerCase();

    // Exact match (highest priority)
    if (lowerName === lowerQuery) {
      exactMatches.push(name);
    }
    // Starts with match (second priority)
    else if (lowerName.startsWith(lowerQuery)) {
      startsWithMatches.push(name);
    }
    // Contains match (lowest priority)
    else if (lowerName.includes(lowerQuery)) {
      containsMatches.push(name);
    }
  });

  // Then add recent searches with the same priority system
  recentSearches.forEach(term => {
    const lowerTerm = term.toLowerCase();

    // Skip if already in one of our match arrays
    if (
      exactMatches.some(m => m.toLowerCase() === lowerTerm) ||
      startsWithMatches.some(m => m.toLowerCase() === lowerTerm) ||
      containsMatches.some(m => m.toLowerCase() === lowerTerm)
    ) {
      return;
    }

    // Exact match
    if (lowerTerm === lowerQuery) {
      exactMatches.push(term);
    }
    // Starts with match
    else if (lowerTerm.startsWith(lowerQuery)) {
      startsWithMatches.push(term);
    }
    // Contains match
    else if (lowerTerm.includes(lowerQuery)) {
      containsMatches.push(term);
    }
  });

  // Combine all matches in priority order
  const allSuggestions = [
    ...exactMatches,
    ...startsWithMatches,
    ...containsMatches
  ];

  // Return unique suggestions up to the maximum limit
  return [...new Set(allSuggestions)].slice(0, maxSuggestions);
};

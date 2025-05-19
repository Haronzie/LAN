import React, { useState, useEffect, useRef, useMemo } from 'react';
import { List, Spin, Space, Button } from 'antd';
import { SearchOutlined, FolderOutlined, FileOutlined, ArrowRightOutlined } from '@ant-design/icons';
import './SearchSuggestions.css';

/**
 * A Google-like search suggestions dropdown component
 *
 * @param {Object} props Component props
 * @param {Array} props.suggestions Array of suggestion objects with name and directory
 * @param {Function} props.onSelectSuggestion Callback when a suggestion is selected
 * @param {Function} props.onNavigateToFile Callback to navigate to a file's location
 * @param {boolean} props.loading Whether suggestions are loading
 * @param {string} props.searchTerm Current search term
 * @param {boolean} props.visible Whether the suggestions dropdown is visible
 */
const SearchSuggestions = ({
  suggestions = [],
  onSelectSuggestion,
  onNavigateToFile,
  loading = false,
  searchTerm = '',
  visible = false
}) => {
  const dropdownRef = useRef(null);
  const visibilityTimeoutRef = useRef(null);
  const [isVisible, setIsVisible] = useState(visible);

  // Use memo to prevent unnecessary re-renders of suggestions
  const memoizedSuggestions = useMemo(() => {
    console.log('🔍 SearchSuggestions - suggestions:', suggestions);
    return suggestions;
  }, [JSON.stringify(suggestions)]);

  // Update visibility state when prop changes, with a longer delay to prevent flickering
  useEffect(() => {
    console.log(`🔍 SearchSuggestions - visibility props changed: visible=${visible}, searchTerm="${searchTerm}", suggestions.length=${suggestions.length}`);

    // Clear any existing timeout to prevent rapid toggling
    if (visibilityTimeoutRef.current) {
      clearTimeout(visibilityTimeoutRef.current);
      visibilityTimeoutRef.current = null;
    }

    if (visible && searchTerm.trim() && suggestions.length > 0) {
      // Show immediately if we have a search term and suggestions
      console.log('🔍 SearchSuggestions - showing dropdown (has search term and suggestions)');
      setIsVisible(true);
    } else if (visible && searchTerm.trim()) {
      // Show loading state if we have a search term but no suggestions yet
      console.log('🔍 SearchSuggestions - showing dropdown (has search term, waiting for suggestions)');
      setIsVisible(true);
    } else if (!visible || !searchTerm.trim()) {
      // Hide if explicitly set to not visible or if search term is empty
      console.log('🔍 SearchSuggestions - hiding dropdown (no search term or explicitly hidden)');
      visibilityTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 300); // Longer delay to ensure stability
    }

    return () => {
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
    };
  }, [visible, searchTerm, suggestions.length]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        // Only handle outside clicks when dropdown is visible
        if (isVisible && typeof onSelectSuggestion === 'function') {
          onSelectSuggestion(null, true); // Second param indicates "close only"
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onSelectSuggestion]);

  // Always render the container, but control visibility with CSS
  return (
    <div
      className="search-suggestions-dropdown"
      ref={dropdownRef}
      style={{
        display: isVisible ? 'block' : 'none',
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        transition: 'opacity 0.3s ease-in-out', // Smooth transition
        zIndex: 1050 // Ensure it's above other elements
      }}
    >
      {loading ? (
        <div className="suggestions-loading">
          <Spin size="small" />
        </div>
      ) : (
        <List
          size="small"
          dataSource={memoizedSuggestions}
          renderItem={(item) => {
            console.log('🔍 SearchSuggestions - rendering item:', item);

            // Check if item is a string or an object
            const isItemObject = typeof item === 'object' && item !== null;
            const fileName = isItemObject ? item.name : item;
            const directory = isItemObject ? item.directory : '';

            console.log(`🔍 SearchSuggestions - item details: isObject=${isItemObject}, fileName="${fileName}", directory="${directory}"`);

            return (
              <List.Item
                className="suggestion-item"
                onClick={() => {
                  console.log('🔍 SearchSuggestions - item clicked:', isItemObject ? item : fileName);
                  onSelectSuggestion(isItemObject ? item : fileName);
                }}
              >
                {isItemObject && item.type === 'directory' ? (
                  <FolderOutlined className="suggestion-icon folder-icon" />
                ) : (
                  <FileOutlined className="suggestion-icon file-icon" />
                )}

                <div className="suggestion-content">
                  <div
                    className="suggestion-text"
                    dangerouslySetInnerHTML={{
                      __html: highlightMatch(fileName, searchTerm)
                    }}
                  />

                  {isItemObject && directory && (
                    <div className="suggestion-location">
                      <small>{directory}</small>
                      {onNavigateToFile && (
                        <Button
                          type="link"
                          size="small"
                          className="go-to-location-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('🔍 SearchSuggestions - Go to location clicked for item:', item);
                            onNavigateToFile(item);
                          }}
                        >
                          <Space>
                            <span>Go to location</span>
                            <ArrowRightOutlined />
                          </Space>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </List.Item>
            );
          }}
          locale={{ emptyText: 'No suggestions' }}
        />
      )}
    </div>
  );
};

/**
 * Highlights the matching part of the suggestion with the search term
 *
 * @param {string} suggestion The suggestion text
 * @param {string} searchTerm The search term to highlight
 * @returns {string} HTML string with highlighted match
 */
const highlightMatch = (suggestion, searchTerm) => {
  if (!searchTerm || !suggestion) return suggestion;

  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return suggestion.replace(regex, '<strong>$1</strong>');
};

export default SearchSuggestions;

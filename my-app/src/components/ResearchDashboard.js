import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Layout,
  Table,
  Button,
  message,
  Input,
  Row,
  Col,
  Space,
  Tooltip,
  Breadcrumb,
  Select,
  Modal,
  Spin
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  FolderAddOutlined,
  ArrowUpOutlined,
  ArrowLeftOutlined,
  EditOutlined,
  CopyOutlined,
  SwapOutlined,
  FileOutlined,
  ReloadOutlined,
  MoreOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import path from 'path-browserify';
import debounce from 'lodash.debounce';
import CommonModals from './common/CommonModals';
import BatchActionsMenu from './common/BatchActionsMenu';
import ActionButtons from './common/ActionButtons';
import UploadConflictModal from './common/UploadConflictModal';
import { batchDelete, batchDownload } from '../utils/batchOperations';
import { deleteFolder, confirmFolderDelete, copyFolder, fetchSubFolders, moveFolder } from '../utils/folderOperations';
import { contextAwareSearch, createDebouncedSearch, formatFileSize, generateSearchSuggestions } from '../utils/searchUtils';
import SearchSuggestions from './common/SearchSuggestions';

const { Content } = Layout;
const { Option } = Select;
const BASE_URL = `${window.location.protocol}//${window.location.hostname}:8080`;



const ResearchDashboard = () => {
  const navigate = useNavigate();

  // ----------------------------------
  // State Hooks
  // ----------------------------------
  const [currentUser, setCurrentUser] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPath, setCurrentPath] = useState('Research');
  const [items, setItems] = useState([]);
  const [directories, setDirectories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const searchInputRef = useRef(null);
  const [allFilesWithMessages, setAllFilesWithMessages] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);

  // Define fetchItems and fetchDirectories first
  const fetchDirectories = async () => {
    try {
      const res = await axios.get('/directory/tree?container=research', { withCredentials: true });
      setDirectories(res.data || []);
    } catch (error) {
      console.error('Error fetching directories:', error);
    }
  };

  const fetchAllFilesWithMessages = async () => {
    try {
      // First, try to get all files with messages assigned to the current user
      const filesWithMessagesRes = await axios.get('/files-with-messages', { withCredentials: true });
      const filesWithMessages = filesWithMessagesRes.data || [];

      // Filter to only include files in the current directory or its subdirectories
      const filteredFiles = filesWithMessages.filter(file => {
        // Check if the file is in the current directory or a subdirectory
        return file.directory === currentPath ||
               file.directory.startsWith(currentPath + '/');
      });

      setAllFilesWithMessages(filteredFiles);
    } catch (error) {
      console.error('Error fetching files with messages:', error);
      message.error('Failed to load files with instructions');
    }
  };

  const markAsDone = async (messageId, fileId) => {
    try {
      await axios.patch(
        `/file/message/${messageId}/done`,
        {},
        { withCredentials: true }
      );
      message.success('Marked as done');

      // Refresh both the all files view and individual messages
      await Promise.all([
        fetchAllFilesWithMessages(),
        fetchItems()
      ]);
    } catch (err) {
      console.error('Error marking message as done:', err);
      message.error('Failed to mark as done');
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const dirParam = encodeURIComponent(currentPath);

      // 1. Fetch folders
      const dirRes = await axios.get(`/directory/list?directory=${dirParam}`, { withCredentials: true });
      const folders = (dirRes.data || []).map((folder) => ({
        id: `folder-${folder.name}`,
        name: folder.name,
        type: 'directory',
        created_by: folder.created_by || '',
      }));

      // 2. Fetch files
      const fileRes = await axios.get(`/files?directory=${dirParam}`, { withCredentials: true });
      const files = (fileRes.data || []).map((file) => {
        // Ensure size is a valid number
        const fileSize = typeof file.size === 'number' ? file.size :
                        (file.size ? parseInt(file.size, 10) : null);

        return {
          id: file.id,
          name: file.name,
          type: 'file',
          size: fileSize,
          formattedSize: formatFileSize(fileSize),
          uploader: file.uploader,
        };
      });

      // 3. Merge and sort
      const sortedItems = [...folders, ...files].sort((a, b) => a.name.localeCompare(b.name));
      setItems(sortedItems);
    } catch (error) {
      console.error('Error loading items:', error);
      message.error('Failed to fetch files or folders.');
    } finally {
      setLoading(false);
    }
  };

  // State for modals
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [renameNewName, setRenameNewName] = useState('');

  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [copyItem, setCopyItem] = useState(null);
  const [copyNewName, setCopyNewName] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');

  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [moveItem, setMoveItem] = useState(null);
  const [moveDestination, setMoveDestination] = useState('');
  const [selectedMainFolder, setSelectedMainFolder] = useState('');
  const [selectedSubFolder, setSelectedSubFolder] = useState('');
  const [subFolders, setSubFolders] = useState([]);

  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);

  // Handler functions for opening modals
  const handleRename = (record) => {
    const isOwner =
      record.type === 'directory'
        ? record.created_by === currentUser
        : record.uploader === currentUser;
    if (!isOwner) {
      message.error('Only the owner can rename this item.');
      return;
    }
    setSelectedItem(record);
    setRenameNewName(record.name);
    setRenameModalVisible(true);
  };

  const handleCopy = (record) => {
    // condition in naming the copied file
    let baseName = record.name;
    let extension = '';
    const dotIndex = record.name.lastIndexOf('.');
    if (dotIndex !== -1) {
      baseName = record.name.substring(0, dotIndex);
      extension = record.name.substring(dotIndex);
    }

    let suggestedName = record.name;
    const destination = selectedDestination || currentPath;
    const existingNames = items
      .filter(item => item.parent === destination)
      .map(item => item.name);

    if (existingNames.includes(record.name)) {
      let counter = 1;
      let newName;
      do {
        newName = `${baseName}(${counter})${extension}`;
        counter++;
      } while (existingNames.includes(newName));
      suggestedName = newName;
    }
    setCopyItem(record);
    setCopyNewName(suggestedName);
    setSelectedDestination('');
    setSelectedMainFolder('');
    setSelectedSubFolder('');
    setSubFolders([]);
    setCopyModalVisible(true);
  };

  // Use the global fetchSubFolders function
  const handleFetchSubFolders = async (mainFolder) => {
    await fetchSubFolders(mainFolder, setSubFolders);
  };

  const handleMainFolderChange = (value) => {
    setSelectedMainFolder(value);
    setSelectedSubFolder('');
    setMoveDestination(value); // Set the destination to the main folder by default

    if (value) {
      handleFetchSubFolders(value);
    } else {
      setSubFolders([]);
    }
  };

  const handleSubFolderChange = (value) => {
    setSelectedSubFolder(value);
    if (value) {
      // Combine main folder and subfolder for the full path
      setMoveDestination(`${selectedMainFolder}/${value}`);
    } else {
      // If no subfolder is selected, use just the main folder
      setMoveDestination(selectedMainFolder);
    }
  };

  const handleMove = async (record) => {
    const isOwner =
      record.type === 'directory'
        ? record.created_by === currentUser
        : record.uploader === currentUser;
    if (!isOwner) {
      message.error('Only the owner can move this item.');
      return;
    }

    // For files, verify the file still exists before showing the move modal
    if (record.type === 'file') {
      try {
        const checkUrl = `/files?directory=${encodeURIComponent(currentPath)}`;
        const checkRes = await axios.get(checkUrl, { withCredentials: true });

        const fileExists = (checkRes.data || []).some(f =>
          f.name === record.name && (f.directory === currentPath || f.directory === undefined)
        );

        if (!fileExists) {
          message.error('This file no longer exists. Please refresh the page.');
          return;
        }
      } catch (err) {
        console.error('Error checking file existence:', err);
        // Continue anyway, the handleMoveConfirm function will do another check
      }
    }

    setMoveItem(record);
    setMoveDestination('');
    setSelectedMainFolder('');
    setSelectedSubFolder('');
    setSubFolders([]);
    setMoveModalVisible(true);
  };

  const handleOpenUploadModal = () => {
    if (!currentPath) {
      message.error("Please select or create a folder first.");
      return;
    }
    setUploadingFiles([]);
    setUploadModalVisible(true);
  };


  // ----------------------------------
  // Initial Load: set user and fetch directories
  // ----------------------------------
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    const storedRole = localStorage.getItem('role');
    if (storedUsername) setCurrentUser(storedUsername);
    if (storedRole === 'admin') setIsAdmin(true);
    fetchDirectories();
    // eslint-disable-next-line
  }, []);

  // Fetch items when currentPath changes
  useEffect(() => {
    fetchItems();
    fetchAllFilesWithMessages();
    // eslint-disable-next-line
  }, [currentPath]);

  // Auto-refresh items periodically, but only when no modals are open
  useEffect(() => {
    // Refresh the file list every 10 seconds
    const interval = setInterval(() => {
      // Only auto-refresh if we're not in the middle of an operation
      if (!moveModalVisible && !copyModalVisible && !renameModalVisible && !createFolderModal && !uploadModalVisible) {
        fetchItems();
        fetchAllFilesWithMessages();
      }
    }, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [currentPath, moveModalVisible, copyModalVisible, renameModalVisible, createFolderModal, uploadModalVisible]);

  // Load recent searches from localStorage on component mount
  useEffect(() => {
    try {
      const savedSearches = localStorage.getItem('researchRecentSearches');
      if (savedSearches) {
        setRecentSearches(JSON.parse(savedSearches));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  }, []);

  // Save a search term to recent searches
  const saveToRecentSearches = (query) => {
    if (!query.trim()) return;

    try {
      // Add to recent searches, avoid duplicates, and limit to 10 items
      const updatedSearches = [query, ...recentSearches.filter(s => s !== query)].slice(0, 10);
      setRecentSearches(updatedSearches);
      localStorage.setItem('researchRecentSearches', JSON.stringify(updatedSearches));
    } catch (error) {
      console.error('Error saving recent searches:', error);
    }
  };

  // Generate search suggestions based on input and file objects
  const updateSearchSuggestions = useCallback(
    debounce(async (query) => {
      if (!query.trim()) {
        setSearchSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      // First, show local suggestions from current items
      const matchingItems = items.filter(item =>
        item.name.toLowerCase().includes(query.toLowerCase())
      );

      // Sort items: exact matches first, then starts with, then contains
      const sortedItems = matchingItems.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const queryLower = query.toLowerCase();

        // Exact matches first
        if (aName === queryLower && bName !== queryLower) return -1;
        if (bName === queryLower && aName !== queryLower) return 1;

        // Then starts with
        if (aName.startsWith(queryLower) && !bName.startsWith(queryLower)) return -1;
        if (bName.startsWith(queryLower) && !aName.startsWith(queryLower)) return 1;

        // Then alphabetical
        return aName.localeCompare(bName);
      });

      // Limit to top 10 results
      const limitedItems = sortedItems.slice(0, 10);

      // Update with local suggestions first
      if (limitedItems.length > 0) {
        setSearchSuggestions(limitedItems);
        setShowSuggestions(true);
      }

      // Always try to get suggestions from the server if query is at least 2 characters
      // This will search across all files in the Research folder and its subfolders
      if (query.length >= 2) {
        try {
          // Use contextAwareSearch to get suggestions
          // Pass 'Research' as the main folder but null as the current path to search all Research files
          const results = await contextAwareSearch(
            query,
            'research',
            currentPath === 'Research' ? null : currentPath, // If at root, search all Research files
            BASE_URL,
            null, // No success callback
            null, // No error callback
            null  // No loading callback
          );

          // If we got results from the server, update suggestions
          if (results && results.length > 0) {
            // Combine local and server results, remove duplicates
            const combinedResults = [...limitedItems];

            // Add server results that aren't already in local results
            results.forEach(result => {
              if (!combinedResults.some(item =>
                item.name === result.name &&
                (item.directory || '') === (result.directory || '')
              )) {
                combinedResults.push(result);
              }
            });

            // Sort and limit the combined results
            const sortedCombined = combinedResults.sort((a, b) => {
              const aName = a.name.toLowerCase();
              const bName = b.name.toLowerCase();
              const queryLower = query.toLowerCase();

              // Exact matches first
              if (aName === queryLower && bName !== queryLower) return -1;
              if (bName === queryLower && aName !== queryLower) return 1;

              // Then starts with
              if (aName.startsWith(queryLower) && !bName.startsWith(queryLower)) return -1;
              if (bName.startsWith(queryLower) && !aName.startsWith(queryLower)) return 1;

              // Then alphabetical
              return aName.localeCompare(bName);
            }).slice(0, 10);

            setSearchSuggestions(sortedCombined);
            setShowSuggestions(true);
          }
        } catch (error) {
          console.error('Error getting search suggestions:', error);
          // Keep the local suggestions if there was an error
        }
      }
    }, 300), // Reduced debounce time for more responsive suggestions
    [items, currentPath]
  );

  // Modified search function to use contextAwareSearch
  const handleSearch = async (query) => {
    if (!query.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    // Save the search term to recent searches
    saveToRecentSearches(query);
    setSearchLoading(true);

    try {
      // Use contextAwareSearch to search across all files or within current directory
      await contextAwareSearch(
        query,
        'research', // Component type
        currentPath === 'Research' ? null : currentPath, // If at root, search all Research files
        BASE_URL,    // Base URL for API
        (results) => {
          console.log('Search results:', results);
          // Store the results for suggestions, but don't change the table display
          setSearchResults(results);

          // Update search suggestions with the results
          if (results.length > 0) {
            setSearchSuggestions(results);
            setShowSuggestions(true);
          } else {
            setShowSuggestions(false);
          }

          // We're not actually in "searching" mode since we don't want to change the table
          setIsSearching(false);
          setSearchLoading(false);
        },
        (error) => {
          console.error('Search error:', error);
          setSearchResults([]);
          setSearchLoading(false);
          setShowSuggestions(false);
        },
        (loading) => {
          setSearchLoading(loading);
        }
      );
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      setSearchLoading(false);
      setShowSuggestions(false);
    }
  };

  // Handle suggestion selection - navigate to the file instead of filtering
  const handleSelectSuggestion = (suggestion, closeOnly = false) => {
    if (closeOnly) {
      setShowSuggestions(false);
      return;
    }

    if (suggestion) {
      // Find the selected file in search results
      const selectedFile = searchResults.find(item => item.name === suggestion);

      if (selectedFile) {
        // If it's a file with a directory, navigate to that directory
        if (selectedFile.directory) {
          // Navigate to the directory containing the file
          handleNavigateToFile(selectedFile);
        } else {
          // If it's just a name without directory info, just set the search term
          setSearchTerm(suggestion);
        }
      } else {
        // If not found in search results, just set the search term
        setSearchTerm(suggestion);
      }
    }

    setShowSuggestions(false);
  };

  // Navigate to the folder containing a file
  const handleNavigateToFile = (fileItem) => {
    if (!fileItem || !fileItem.directory) return;

    // Navigate to the directory containing the file
    setCurrentPath(fileItem.directory);

    // Clear search
    setSearchTerm('');
    setIsSearching(false);
    setSearchResults([]);
    setShowSuggestions(false);

    // Highlight the file after navigation (optional)
    setTimeout(() => {
      const fileRow = document.querySelector(`tr[data-row-key="${fileItem.type}-${fileItem.id || fileItem.name}"]`);
      if (fileRow) {
        fileRow.classList.add('highlight-row');
        setTimeout(() => {
          fileRow.classList.remove('highlight-row');
        }, 2000);
      }
    }, 500);
  };

  // Debounce the search to avoid too many requests
  const debouncedSearch = useCallback(
    createDebouncedSearch((query) => {
      handleSearch(query);
    }),
    [currentPath] // Recreate when currentPath changes
  );

  // Update search when search term changes
  useEffect(() => {
    if (searchTerm.trim()) {
      // Update suggestions immediately
      updateSearchSuggestions(searchTerm);

      // Perform the actual search with debounce
      debouncedSearch(searchTerm);
    } else {
      setIsSearching(false);
      setSearchResults([]);
      setShowSuggestions(false);
    }
  }, [searchTerm, debouncedSearch, updateSearchSuggestions]);

  // Navigate to the folder containing a search result
  const navigateToFolder = (directory) => {
    setSearchTerm('');
    setIsSearching(false);
    setShowSuggestions(false);
    setCurrentPath(directory);
  };

  // Always show all items in the table, regardless of search
  // This prevents the table from changing when searching
  const displayItems = items;

  // Then sort: directories first (in ascending order), then files (in ascending order)
  const sortedItems = [...displayItems].sort((a, b) => {
    // If types are different (directory vs file)
    if (a.type !== b.type) {
      // Directories come before files
      return a.type === 'directory' ? -1 : 1;
    }
    // If types are the same, sort alphabetically by name
    return a.name.localeCompare(b.name);
  });

  // ----------------------------------
  // Navigation & Breadcrumb
  // ----------------------------------
  const handleFolderClick = (folderName) => {
    const newPath = path.join(currentPath, folderName);
    if (!newPath.startsWith('Research')) return;
    setCurrentPath(newPath);
  };

  const handleGoUp = () => {
    if (currentPath === 'Research') return;
    const parentPath = path.dirname(currentPath);
    setCurrentPath(parentPath === '.' ? 'Research' : parentPath);
  };

  const getPathSegments = (p) => {
    const parts = p.split('/').filter(Boolean);
    return parts.slice(1); // remove the first 'Research' part
  };

  const segments = getPathSegments(currentPath);
  const breadcrumbItems = [
    <Breadcrumb.Item key="research">
      <a onClick={() => setCurrentPath('Research')}>Research</a>
    </Breadcrumb.Item>
  ];
  segments.forEach((seg, index) => {
    const partialPath = ['Research', ...segments.slice(0, index + 1)].join('/');
    const isLast = index === segments.length - 1;
    breadcrumbItems.push(
      <Breadcrumb.Item key={index}>
        {isLast ? seg : <a onClick={() => setCurrentPath(partialPath)}>{seg}</a>}
      </Breadcrumb.Item>
    );
  });

  // ----------------------------------
  // Create Folder
  // ----------------------------------
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      message.error('Folder name cannot be empty');
      return;
    }
    try {
      await axios.post(
        '/directory/create',
        { name: newFolderName, parent: currentPath, container: 'research' },
        { withCredentials: true }
      );
      message.success('Folder created successfully');
      setCreateFolderModal(false);
      setNewFolderName('');
      fetchItems();
      fetchDirectories();
    } catch (error) {
      console.error('Create folder error:', error);
      message.error(error.response?.data?.error || 'Error creating folder');
    }
  };

  // ----------------------------------
  // Upload Modal
  // ----------------------------------
  const handleModalUpload = async () => {
    if (uploadingFiles.length === 0) {
      message.error('Please select one or more files first');
      return;
    }

    // Ensure consistent directory path format - always use forward slashes
    // and lowercase for consistent database storage and retrieval
    const normalizedPath = currentPath.split(/[/\\]/).map(part => part.toLowerCase()).join('/');
    console.log("Uploading to directory:", normalizedPath); // for debugging

    // Check for existing files
    try {
      const existingFilesRes = await axios.get(`/files?directory=${encodeURIComponent(normalizedPath)}`, {
        withCredentials: true
      });
      const existingFiles = existingFilesRes.data || [];
      const existingNames = existingFiles.map(f => f.name);

      if (uploadingFiles.length === 1) {
        const file = uploadingFiles[0];
        const fileExists = existingNames.includes(file.name);

        const uploadSingle = async (overwrite, skip = false) => {
          if (skip) {
            message.info(`Skipped uploading ${file.name}`);
            setUploadModalVisible(false);
            return;
          }

          const formData = new FormData();
          formData.append('file', file);
          formData.append('directory', normalizedPath);
          formData.append('container', 'research');

          // Only one of these should be true at a time
          if (overwrite) formData.append('overwrite', 'true');
          else if (skip) formData.append('skip', 'true');

          try {
            const response = await axios.post('/upload', formData, {
              withCredentials: true,
              headers: { 'Content-Type': 'multipart/form-data' },
            });

            // Get the destination from the response or fallback to the current path
            const destination = response.data?.destination || normalizedPath;

            let successMessage;
            if (overwrite) {
              successMessage = `Overwritten ${file.name} in ${destination}`;
            } else {
              successMessage = `Uploaded ${file.name} to ${destination}`;
            }

            message.success(successMessage);
            setUploadModalVisible(false);
            setUploadingFiles([]);
            fetchItems(); // refresh file list
            fetchAllFilesWithMessages(); // refresh files with messages
          } catch (error) {
            console.error('Upload failed:', error);
            const errorMessage = error.response?.data?.error || `Upload failed for ${file.name}`;
            message.error(errorMessage);
          }
        };

        if (fileExists) {
          // Show conflict resolution modal
          Modal.info({
            title: `A file named '${file.name}' already exists.`,
            icon: <ExclamationCircleOutlined />,
            content: (
              <div>
                <p>Choose an action for this file:</p>
                <div style={{ marginTop: '16px' }}>
                  <Button
                    danger
                    style={{ width: '100%', marginBottom: '8px' }}
                    onClick={() => {
                      Modal.destroyAll();
                      uploadSingle(true);
                    }}
                  >
                    A. Overwrite - Replace the existing file
                  </Button>

                  <Button
                    type="primary"
                    style={{ width: '100%', marginBottom: '8px' }}
                    onClick={() => {
                      Modal.destroyAll();
                      uploadSingle(false);
                    }}
                  >
                    B. Keep Both - Save with a new name
                  </Button>

                  <Button
                    style={{ width: '100%' }}
                    onClick={() => {
                      Modal.destroyAll();
                      uploadSingle(false, true);
                    }}
                  >
                    C. Skip - Cancel this upload
                  </Button>
                </div>
              </div>
            ),
            okButtonProps: { style: { display: 'none' } }, // Hide the default OK button
          });
        } else {
          await uploadSingle(false);
        }
      } else {
        // For multiple files, check if any of them already exist
        const conflictingFiles = uploadingFiles.filter(file => existingNames.includes(file.name));

        const handleBulkUpload = async (overwrite, skip) => {
          const formData = new FormData();
          uploadingFiles.forEach(file => formData.append('files', file));
          formData.append('directory', normalizedPath);
          formData.append('container', 'research');

          // Only one of these should be true at a time
          if (overwrite) {
            formData.append('overwrite', 'true');
            formData.append('skip', 'false');
          } else if (skip) {
            formData.append('overwrite', 'false');
            formData.append('skip', 'true');
          } else {
            formData.append('overwrite', 'false');
            formData.append('skip', 'false');
          }

          try {
            const res = await axios.post('/bulk-upload', formData, {
              withCredentials: true,
              headers: { 'Content-Type': 'multipart/form-data' },
            });

            const results = res.data || [];
            const uploaded = results.filter(r => r.status === 'uploaded' || r.status === 'overwritten').length;
            const skipped = results.filter(r => r.status === 'skipped').length;
            const failed = results.filter(r => r.status.startsWith('error')).length;

            let successMessage;
            if (overwrite && uploaded > 0) {
              successMessage = `${uploaded} file(s) overwritten, ${skipped} skipped, ${failed} failed`;
            } else if (skip && skipped > 0) {
              successMessage = `${uploaded} file(s) uploaded, ${skipped} skipped, ${failed} failed`;
            } else {
              successMessage = `${uploaded} file(s) uploaded, ${skipped} skipped, ${failed} failed`;
            }

            message.success(successMessage);
            setUploadModalVisible(false);
            setUploadingFiles([]);
            fetchItems(); // refresh file list
            fetchAllFilesWithMessages(); // refresh files with messages
          } catch (error) {
            console.error('Bulk upload failed:', error);
            const errorMessage = error.response?.data?.error || 'Bulk upload failed';
            message.error(errorMessage);
          }
        };

        if (conflictingFiles.length > 0) {
          // If there are conflicts, show a modal asking what to do with all conflicting files
          Modal.info({
            title: `${conflictingFiles.length} file(s) already exist`,
            icon: <ExclamationCircleOutlined />,
            content: (
              <div>
                <p>The following files already exist:</p>
                <ul style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #eee', padding: '8px 16px' }}>
                  {conflictingFiles.map(file => (
                    <li key={file.uid}>{file.name}</li>
                  ))}
                </ul>
                <p style={{ marginTop: '16px' }}>Choose an action for these files:</p>
                <div style={{ marginTop: '16px' }}>
                  <Button
                    danger
                    style={{ width: '100%', marginBottom: '8px' }}
                    onClick={() => {
                      Modal.destroyAll();
                      handleBulkUpload(true, false);
                    }}
                  >
                    A. Overwrite All - Replace existing files
                  </Button>

                  <Button
                    type="primary"
                    style={{ width: '100%', marginBottom: '8px' }}
                    onClick={() => {
                      Modal.destroyAll();
                      handleBulkUpload(false, false);
                    }}
                  >
                    B. Keep Both - Save with new names
                  </Button>

                  <Button
                    style={{ width: '100%' }}
                    onClick={() => {
                      Modal.destroyAll();
                      handleBulkUpload(false, true);
                    }}
                  >
                    C. Skip Conflicts - Upload only new files
                  </Button>
                </div>
              </div>
            ),
            okButtonProps: { style: { display: 'none' } }, // Hide the default OK button
          });
        } else {
          // If no conflicts, proceed with upload
          await handleBulkUpload(false, false);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      message.error(error.response?.data?.error || 'Upload failed');
    }
  };


  // ----------------------------------
  // Delete
  // ----------------------------------
  const handleDelete = async (record) => {
    const isOwner =
      record.type === 'directory'
        ? record.created_by === currentUser
        : record.uploader === currentUser;
    if (!isOwner) {
      message.error('Only the owner can delete this item.');
      return;
    }

    try {
      if (record.type === 'directory') {
        // Use the global folder delete function
        await deleteFolder(
          record,
          currentPath,
          'research', // Container for ResearchDashboard
          () => {
            fetchItems();
            fetchDirectories();
          }
        );
      } else {
        await axios.delete('/delete-file', {
          data: { directory: currentPath, filename: record.name, container: 'research' },
          withCredentials: true
        });
        message.success(`${record.name} deleted successfully`);
        fetchItems();
      }
    } catch (error) {
      console.error('Delete error:', error);
      message.error(error.response?.data?.error || 'Error deleting item');
    }
  };

  // ----------------------------------
  // Rename
  // ----------------------------------
  const handleRenameConfirm = async () => {
    if (!renameNewName.trim()) {
      message.error('New name cannot be empty');
      return;
    }
    try {
      if (selectedItem.type === 'directory') {
        await axios.put(
          '/directory/rename',
          {
            old_name: selectedItem.name,
            new_name: renameNewName,
            parent: currentPath,
            container: 'research'
          },
          { withCredentials: true }
        );
      } else {
        await axios.put(
          '/file/rename',
          {
            directory: currentPath,
            old_filename: selectedItem.name,
            new_filename: renameNewName,
            container: 'research'
          },
          { withCredentials: true }
        );
      }
      message.success('Item renamed successfully');
      setRenameModalVisible(false);
      setSelectedItem(null);
      fetchItems();
      fetchDirectories();
    } catch (error) {
      console.error('Rename error:', error);
      message.error(error.response?.data?.error || 'Error renaming item');
    }
  };

  // ----------------------------------
  // Copy
  // ----------------------------------
  const finalizeCopy = async (overwrite = false) => {
    try {
      // Determine the destination path based on main folder and subfolder
      let destinationPath = selectedMainFolder;
      if (selectedSubFolder) {
        destinationPath = `${selectedMainFolder}/${selectedSubFolder}`;
      }

      if (copyItem.type === 'directory') {
        // Use the global copyFolder function
        await copyFolder(
          copyItem,
          currentPath,
          destinationPath,
          'research', // container for ResearchDashboard
          () => {
            message.success(`Copied ${copyItem.name} to ${selectedMainFolder}${selectedSubFolder ? '/' + selectedSubFolder : ''}`);
          },
          null,
          fetchDirectories
        );
      } else {
        await axios.post(
          '/copy-file',
          {
            source_file: copyItem.name,
            new_file_name: copyNewName,
            destination_folder: destinationPath,
            container: 'research',
            overwrite: overwrite
          },
          { withCredentials: true }
        );
      }
      message.success(`Copied ${copyItem.name} to ${selectedMainFolder}${selectedSubFolder ? '/' + selectedSubFolder : ''}`);
      setCopyModalVisible(false);
      setCopyItem(null);
      setCopyNewName('');
      setSelectedDestination('');
      setSelectedMainFolder('');
      setSelectedSubFolder('');
      fetchItems();
    } catch (error) {
      console.error('Copy error:', error);

      // Handle specific error cases
      if (error.response?.data?.error === "Source file not found on disk") {
        message.error('The file no longer exists on the server. Please refresh the page and try again.');
      } else if (error.response?.data?.error === "Permission denied when accessing source file") {
        message.error('Permission denied when accessing the file. Please contact your administrator.');
      } else if (error.response?.data?.error === "Invalid encryption key configuration") {
        message.error('There is an issue with the file encryption system. Please contact your administrator.');
      } else if (error.response?.data?.error && error.response.data.error.includes("Failed to read from source file")) {
        message.error('The file appears to be corrupted or cannot be read. Please try uploading it again.');
      } else if (error.response?.data?.error && error.response.data.error.includes("Failed to open source file")) {
        message.error('The file cannot be accessed. This might be due to a temporary issue. Please try again in a moment.');
      } else {
        message.error(error.response?.data?.error || 'Error copying item');
      }
    }
  };

  const handleCopyConfirm = async () => {
    if (!copyNewName.trim()) {
      message.error('New name cannot be empty');
      return;
    }
    if (!copyItem) {
      message.error('No item selected to copy');
      return;
    }
    if (!selectedMainFolder) {
      message.error('Please select a main folder');
      return;
    }

    try {
      // Determine the destination path based on main folder and subfolder
      let destinationPath = selectedMainFolder;
      if (selectedSubFolder) {
        destinationPath = `${selectedMainFolder}/${selectedSubFolder}`;
      }

      // Check if file with same name exists at destination
      if (copyItem.type === 'file') {
        const res = await axios.get(`/files?directory=${encodeURIComponent(destinationPath)}`, {
          withCredentials: true
        });

        const existingNames = Array.isArray(res.data) ? res.data.map(f => f.name) : [];
        const nameExists = existingNames.includes(copyNewName);

        if (nameExists) {
          // Import dynamically to avoid circular dependencies
          const FileOperationConflictModal = (await import('./common/FileOperationConflictModal')).default;

          FileOperationConflictModal({
            fileName: copyNewName,
            destinationPath: destinationPath,
            operation: 'copy',
            onOverwrite: async () => {
              await finalizeCopy(true);
            },
            onKeepBoth: async () => {
              await finalizeCopy(false);
            },
            onSkip: () => {
              message.info(`Skipped copying ${copyItem.name}`);
              setCopyModalVisible(false);
            }
          });
          return;
        }
      }

      // If no conflict, proceed with copy
      await finalizeCopy(false);
    } catch (error) {
      console.error('Copy error:', error);
      message.error('Error checking for conflict or copying file');
    }
  };

  // ----------------------------------
  // Move
  // ----------------------------------
  const finalizeMove = async (overwrite = false) => {
    try {
      if (moveItem.type === 'directory') {
        // Use the global moveFolder function
        await moveFolder(
          moveItem,
          currentPath,
          moveDestination,
          'research', // container for ResearchDashboard
          () => {
            // Success callback is handled by the moveFolder function
          },
          null,
          fetchDirectories
        );
      } else {
        console.log('Moving file with:', {
          id: moveItem.id.toString(),
          filename: moveItem.name,
          old_parent: currentPath,
          new_parent: moveDestination,
          overwrite: overwrite,
          container: 'research'
        });

        await axios.post(
          '/move-file',
          {
            id: moveItem.id.toString(),
            filename: moveItem.name,
            old_parent: currentPath,
            new_parent: moveDestination,
            overwrite: overwrite,
            container: 'research'
          },
          { withCredentials: true }
        );
      }
      message.success(`Moved '${moveItem.name}' successfully`);
      setMoveModalVisible(false);
      setMoveItem(null);
      setMoveDestination('');
      fetchItems();
      fetchDirectories();
    } catch (error) {
      console.error('Move error:', error);

      // Handle specific error cases
      if (error.response?.data?.error === "Source file does not exist on disk") {
        message.error('The file no longer exists on the server. Please refresh the page.');
      } else {
        message.error(error.response?.data?.error || 'Error moving item');
      }

      setMoveModalVisible(false);
    }
  };

  const handleMoveConfirm = async () => {
    if (!moveDestination.trim()) {
      message.error('Please select a destination folder');
      return;
    }
    if (!moveItem) {
      message.error('No item selected to move');
      return;
    }

    try {
      if (moveItem.type === 'file') {
        // First, verify the file exists by trying to get its metadata
        try {
          const checkUrl = `/files?directory=${encodeURIComponent(currentPath)}`;
          const checkRes = await axios.get(checkUrl, { withCredentials: true });

          const fileExists = (checkRes.data || []).some(f =>
            f.name === moveItem.name && (f.directory === currentPath || f.directory === undefined)
          );

          if (!fileExists) {
            throw new Error("Source file not found. It may have been deleted or moved.");
          }

          // Check if file with same name exists at destination
          const destRes = await axios.get(`/files?directory=${encodeURIComponent(moveDestination)}`, {
            withCredentials: true
          });

          const existingNames = Array.isArray(destRes.data) ? destRes.data.map(f => f.name) : [];
          const nameExists = existingNames.includes(moveItem.name);

          if (nameExists) {
            // Import dynamically to avoid circular dependencies
            const FileOperationConflictModal = (await import('./common/FileOperationConflictModal')).default;

            FileOperationConflictModal({
              fileName: moveItem.name,
              destinationPath: moveDestination,
              operation: 'move',
              onOverwrite: async () => {
                await finalizeMove(true);
              },
              onKeepBoth: async () => {
                await finalizeMove(false);
              },
              onSkip: () => {
                message.info(`Skipped moving ${moveItem.name}`);
                setMoveModalVisible(false);
              }
            });
            return;
          }

        } catch (checkErr) {
          console.error('File existence check failed:', checkErr);
          message.error('Could not verify file existence. Please refresh and try again.');
          setMoveModalVisible(false);
          return;
        }
      }

      // If no conflict or it's a directory, proceed with move
      await finalizeMove(false);
    } catch (error) {
      console.error('Move error:', error);
      message.error(error.response?.data?.error || 'Error moving item');
      setMoveModalVisible(false);
    }
  };

  // ----------------------------------
  // View File
  // ----------------------------------
  const handleViewFile = async (record) => {
    try {
      if (isSearching) {
        // For search results, verify file exists in its directory
        const dirToCheck = record.directory || '';
        const checkUrl = `/files?directory=${encodeURIComponent(dirToCheck)}`;
        const checkRes = await axios.get(checkUrl, { withCredentials: true });

        const fileExists = (checkRes.data || []).some(f =>
          f.name === record.name && (f.directory === dirToCheck || f.directory === undefined)
        );

        if (!fileExists) {
          message.error('This file no longer exists. Please refresh the page.');
          return;
        }

        // Proceed with preview if file exists
        const encodedDir = encodeURIComponent(dirToCheck);
        const encodedFile = encodeURIComponent(record.name.trim());
        const previewUrl = `${BASE_URL}/preview?directory=${encodedDir}&filename=${encodedFile}`;
        window.open(previewUrl, '_blank');
      } else {
        // For regular file listing, verify file exists in current directory
        const checkUrl = `/files?directory=${encodeURIComponent(currentPath)}`;
        const checkRes = await axios.get(checkUrl, { withCredentials: true });

        const fileExists = (checkRes.data || []).some(f =>
          f.name === record.name && (f.directory === currentPath || f.directory === undefined)
        );

        if (!fileExists) {
          message.error('This file no longer exists. Please refresh the page.');
          return;
        }

        // Proceed with preview if file exists
        const encodedDir = encodeURIComponent(currentPath || '');
        const encodedFile = encodeURIComponent(record.name.trim());
        const previewUrl = `${BASE_URL}/preview?directory=${encodedDir}&filename=${encodedFile}`;
        window.open(previewUrl, '_blank');
      }
    } catch (err) {
      console.error('Error checking file existence before preview:', err);
      message.error('Error verifying file. Please try again or refresh the page.');
    }
  };

  // Handle row click for the entire table row
  const handleRowClick = (record) => {
    // Only respond to directory clicks
    if (record.type === 'directory') {
      handleFolderClick(record.name);
    }
    // Files are handled by their action buttons, not by row clicks
  };

  // ----------------------------------
  // Table columns
  // ----------------------------------
  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',

      // Removed sorting from column as we're handling it in sortedItems

      render: (name, record) => {
        if (record.type === 'directory') {
          return (
            <Space>
              <FolderOpenOutlined />
              <a onClick={() => handleFolderClick(name)}>{name}</a>
            </Space>
          );
        }
        return name;
      }
    },
    // We no longer add a Location column for search results to keep the interface consistent
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (type === 'directory' ? 'Folder' : 'File')
    },
    {
      title: 'Size',
      dataIndex: 'formattedSize',
      key: 'size',
      render: (size, record) => {
        if (record.type === 'directory') return '--';
        return size || formatFileSize(record.size) || 'Unknown';
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record) => (
        <ActionButtons
          record={record}
          currentUser={currentUser}
          isSearching={isSearching}
          onViewFile={handleViewFile}
          onDownload={handleDownload}
          onDownloadFolder={handleDownloadFolder}
          onRename={handleRename}
          onCopy={handleCopy}
          onMove={handleMove}
          onDelete={handleDelete}
          onMoreInfo={(record) => {
            // Add more info functionality if needed
            message.info(`File: ${record.name}`);
          }}
        />
      )
    }
  ];

  // ----------------------------------
  // Download Helpers (open in new tab)
  // ----------------------------------
  const handleDownload = async (fileName, directory) => {
    try {
      // Verify file exists before attempting to download
      const dirToCheck = directory || currentPath;
      const checkUrl = `/files?directory=${encodeURIComponent(dirToCheck)}`;
      const checkRes = await axios.get(checkUrl, { withCredentials: true });

      const fileExists = (checkRes.data || []).some(f =>
        f.name === fileName && (f.directory === dirToCheck || f.directory === undefined)
      );

      if (!fileExists) {
        message.error('This file no longer exists. Please refresh the page.');
        return;
      }

      // Proceed with download if file exists
      const encodedDir = encodeURIComponent(dirToCheck || '');
      const encodedFile = encodeURIComponent(fileName.trim());
      const downloadUrl = `${BASE_URL}/download?directory=${encodedDir}&filename=${encodedFile}`;
      window.open(downloadUrl, '_blank');
    } catch (err) {
      console.error('Error checking file existence before download:', err);
      message.error('Error verifying file. Please try again or refresh the page.');
    }
  };

  const handleDownloadFolder = (folderName) => {
    const folderPath = path.join(currentPath, folderName);
    const encodedPath = encodeURIComponent(folderPath.trim());
    const downloadUrl = `${BASE_URL}/download-folder?directory=${encodedPath}`;
    window.open(downloadUrl, '_blank');
  };

  // Batch operations handlers
  const handleBatchDelete = () => {
    if (selectedRows.length === 0) return;

    Modal.confirm({
      title: 'Delete Multiple Items',
      content: `Are you sure you want to delete ${selectedRows.length} selected item(s)?`,
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        await batchDelete(selectedRows, currentPath, 'research', () => {
          fetchItems();
          fetchDirectories();
          setSelectedRowKeys([]);
          setSelectedRows([]);
        });
      }
    });
  };

  const handleBatchDownload = () => {
    if (selectedRows.length === 0) return;
    batchDownload(selectedRows, currentPath, BASE_URL);
  };

  const handleBatchCopy = () => {
    if (selectedRows.length === 0) return;
    message.info('Multiple copy functionality coming soon');
    // Future implementation for batch copy
  };

  const handleBatchMove = () => {
    if (selectedRows.length === 0) return;
    message.info('Multiple move functionality coming soon');
    // Future implementation for batch move
  };

  // Toggle selection mode
  const handleToggleSelectionMode = () => {
    setSelectionMode(true);
  };

  // Cancel selection mode
  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedRowKeys([]);
    setSelectedRows([]);
  };

  const rowSelection = selectionMode ? {
    selectedRowKeys,
    onChange: (keys, rows) => {
      setSelectedRowKeys(keys);
      setSelectedRows(rows);
    }
  } : null;

  return (
    <Layout style={{ minHeight: '84vh', background: '#f0f2f5' }}>
      <Content style={{ margin: '5px', padding: '10px', background: '#fff' }}>
        {/* Top Bar */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <h2 style={{ margin: 0 }}>Research</h2>
          </Col>
          <Col style={{ display: 'flex', alignItems: 'center' }}>
            <BatchActionsMenu
              selectedItems={selectedRows}
              onDelete={handleBatchDelete}
              onCopy={handleBatchCopy}
              onMove={handleBatchMove}
              onDownload={handleBatchDownload}
              selectionMode={selectionMode}
              onToggleSelectionMode={handleToggleSelectionMode}
              onCancelSelection={handleCancelSelection}
            />
            <Button type="primary" icon={<UploadOutlined />} onClick={handleOpenUploadModal}>
              Upload File
            </Button>
          </Col>
        </Row>
        {/* Navigation Row */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {!isSearching && (
            <Col>
              <Button icon={<ArrowUpOutlined />} onClick={handleGoUp}>
                Go Up
              </Button>
            </Col>
          )}
          {isSearching && (
            <Col>
              <Button
                icon={<ArrowUpOutlined />}
                onClick={() => {
                  setSearchTerm('');
                  setIsSearching(false);
                }}
              >
                Back to Browsing
              </Button>
            </Col>
          )}
          <Col>
            <Button
              icon={<FolderAddOutlined />}
              onClick={() => setCreateFolderModal(true)}
              disabled={isSearching}
            >
              Create Folder
            </Button>
          </Col>
          <Col>
            <Tooltip title="Refresh Files">
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  setLoading(true);
                  fetchItems();
                  message.success('File list refreshed');
                }}
                loading={loading}
              />
            </Tooltip>
          </Col>
          <Col style={{ width: '40%' }}>
            <div style={{ position: 'relative' }}>
              <Input.Search
                ref={searchInputRef}
                placeholder={currentPath
                  ? `Filter files in ${currentPath}...`
                  : "Filter files in Research..."}
                value={searchTerm}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchTerm(value);

                  // If search is cleared, immediately reset search state
                  if (!value.trim()) {
                    setIsSearching(false);
                    setSearchResults([]);
                    setShowSuggestions(false);
                    setSearchSuggestions([]);
                  } else {
                    // Always update suggestions when typing
                    updateSearchSuggestions(value);

                    // Keep suggestions visible as long as there's text in the search bar
                    setShowSuggestions(true);

                    // Only perform the actual search when user presses enter or clicks search button
                    // This prevents too many re-renders while typing
                    if (value.length >= 2) { // Reduced to 2 characters for more responsive search
                      // Use debounced search to avoid too many API calls
                      debouncedSearch(value);
                    }
                  }
                }}
                onFocus={() => {
                  // Show suggestions when input is focused and has value
                  if (searchTerm.trim()) {
                    // Refresh suggestions when input is focused
                    updateSearchSuggestions(searchTerm);
                    setShowSuggestions(true);
                  }
                }}
                onSearch={(value) => {
                  if (value.trim()) {
                    handleSearch(value);
                  } else {
                    setIsSearching(false);
                    setSearchResults([]);
                    setShowSuggestions(false);
                  }
                }}
                loading={searchLoading}
                allowClear
                enterButton
              />
            </div>

            {/* Separate container for search suggestions to prevent affecting table layout */}
            <div style={{
              position: 'absolute',
              width: '70%', // Increased width for better visibility
              zIndex: 1050,
              pointerEvents: showSuggestions ? 'auto' : 'none',
              // Prevent layout shifts
              willChange: 'transform',
              transform: 'translateZ(0)',
              // Ensure proper positioning
              top: '100%',
              left: 0,
              maxHeight: '400px', // Add max height to prevent too large dropdown
              overflow: 'visible' // Allow content to overflow for dropdown
            }}>
              <SearchSuggestions
                suggestions={searchSuggestions}
                onSelectSuggestion={handleSelectSuggestion}
                onNavigateToFile={handleNavigateToFile}
                loading={searchLoading}
                searchTerm={searchTerm}
                visible={showSuggestions}
              />
            </div>
          </Col>
        </Row>



        {!isSearching && (
          <Breadcrumb style={{ marginBottom: 16 }}>{breadcrumbItems}</Breadcrumb>
        )}




        <Table
          columns={columns}
          dataSource={sortedItems}
          rowKey={(record) => record.id || record.name + record.type}
          loading={loading}
          pagination={false}
          scroll={{ y: '49vh' }}  // for content scrolling on table
          rowSelection={rowSelection}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { cursor: record.type === 'directory' ? 'pointer' : 'default' } // Only show pointer cursor for directories
          })}
        />

        {/* Use the CommonModals component */}
        <CommonModals
          // Create Folder Modal props
          createFolderModal={createFolderModal}
          setCreateFolderModal={setCreateFolderModal}
          newFolderName={newFolderName}
          setNewFolderName={setNewFolderName}
          handleCreateFolder={handleCreateFolder}

          // Rename Modal props
          renameModalVisible={renameModalVisible}
          setRenameModalVisible={setRenameModalVisible}
          renameNewName={renameNewName}
          setRenameNewName={setRenameNewName}
          handleRenameConfirm={handleRenameConfirm}

          // Copy Modal props
          copyModalVisible={copyModalVisible}
          setCopyModalVisible={setCopyModalVisible}
          copyNewName={copyNewName}
          setCopyNewName={setCopyNewName}
          selectedDestination={selectedDestination}
          setSelectedDestination={setSelectedDestination}
          handleCopyConfirm={handleCopyConfirm}
          directoryItems={items}
          currentPath={currentPath}
          copySelectedMainFolder={selectedMainFolder}
          copySelectedSubFolder={selectedSubFolder}
          copySubFolders={subFolders}
          handleCopyMainFolderChange={handleMainFolderChange}
          handleCopySubFolderChange={handleSubFolderChange}

          // Move Modal props
          moveModalVisible={moveModalVisible}
          setMoveModalVisible={setMoveModalVisible}
          moveDestination={moveDestination}
          setMoveDestination={setMoveDestination}
          handleMoveConfirm={handleMoveConfirm}
          selectedMainFolder={selectedMainFolder}
          selectedSubFolder={selectedSubFolder}
          subFolders={subFolders}
          handleMainFolderChange={handleMainFolderChange}
          handleSubFolderChange={handleSubFolderChange}

          // Upload Modal props
          uploadModalVisible={uploadModalVisible}
          setUploadModalVisible={setUploadModalVisible}
          uploadingFiles={uploadingFiles}
          setUploadingFiles={setUploadingFiles}
          handleModalUpload={handleModalUpload}
          container="research"
        />
      </Content>
    </Layout>
  );
};

export default ResearchDashboard;

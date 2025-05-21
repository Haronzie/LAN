import React, { useState, useEffect, useCallback } from 'react';
import {
  Layout,
  Table,
  Button,
  message,
  Input,
  Row,
  Col,
  Modal,
  Space,
  Tooltip,
  Form,
  Select,
  Card,
  Breadcrumb,
  Checkbox,
  TreeSelect,
  Badge,
  Spin,

} from 'antd';
import './fix-actions.css';
import './table-fix.css';
import {
  Upload,
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
  FileTextOutlined,
  FolderOutlined,
  ReloadOutlined,
  MoreOutlined
} from '@ant-design/icons';
import Dragger from 'antd/lib/upload/Dragger';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import path from 'path-browserify';
import debounce from 'lodash.debounce';
import CommonModals from './common/CommonModals';
import BatchActionsMenu from './common/BatchActionsMenu';
import ActionButtons from './common/ActionButtons';
import { batchDelete, batchDownload } from '../utils/batchOperations';
import { moveFolder } from '../utils/folderOperations';
import { format } from 'date-fns';

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
const WS_BASE_URL = process.env.REACT_APP_BACKEND_WS || 'ws://localhost:8080';

const { Content } = Layout;
const { Option } = Select;

function formatFileSize(size) {
  if (size === undefined || size === null) return '';
  if (size === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(size) / Math.log(1024));
  return (size / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];

}

const OperationDashboard = () => {
  const [currentPath, setCurrentPath] = useState('Operation');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
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
  const [currentUser, setCurrentUser] = useState('');
  const [directories, setDirectories] = useState([]);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [fileMessages, setFileMessages] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const [allFilesWithMessages, setAllFilesWithMessages] = useState([]);
  const [ws, setWs] = useState(null);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [selectedFileInfo, setSelectedFileInfo] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);

  useEffect(() => {
    const username = localStorage.getItem('username');
    if (!username) return;
    setCurrentUser(username);
    
    // Check if there's a file to open after navigation
    const fileToOpen = localStorage.getItem('openFileAfterNavigation');
    const isNotificationNavigation = localStorage.getItem('notificationNavigation') === 'true';
    const forceOpenFile = localStorage.getItem('forceOpenFile');
    
    if (fileToOpen) {
      try {
        console.log('Found file to open in localStorage:', fileToOpen);
        const fileData = JSON.parse(fileToOpen);
        
        // Only handle if this is the correct dashboard for the file
        if (fileData.directory.startsWith('Operation')) {
          console.log('File belongs to Operation dashboard, directory:', fileData.directory);
          
          // Check if this navigation came from a notification click
          const isFromNotification = fileData.source === 'notification';
          if (isFromNotification) {
            console.log('Navigation request came from notification click');
          }
          
          // Handle file opening differently if forceOpenFile is set
          if (forceOpenFile === 'true') {
            console.log('Force open file flag is set');
            
            // This is a more step-by-step approach to ensure we reach the right directory
            const navigateToFileStepByStep = async () => {
              // Break the path into segments
              const pathParts = fileData.directory.split('/');
              console.log('Path parts:', pathParts);
              
              // Navigate to each directory level
              let currentDir = '';
              
              // Start with the first level (Operation)
              currentDir = pathParts[0];
              console.log(`Setting path to: ${currentDir}`);
              setCurrentPath(currentDir);
              
              // Wait a bit for the navigation to take effect
              await new Promise(resolve => setTimeout(resolve, 300));
              
              // If we have nested directories, navigate through them
              if (pathParts.length > 1) {
                for (let i = 1; i < pathParts.length; i++) {
                  currentDir = `${currentDir}/${pathParts[i]}`;
                  console.log(`Navigating to: ${currentDir}`);
                  setCurrentPath(currentDir);
                  await new Promise(resolve => setTimeout(resolve, 300));
                }
              }
              
              // Once we're at the right directory, fetch files and open the specific one
              const fileRes = await axios.get(
                `${BASE_URL}/files?directory=${encodeURIComponent(fileData.directory)}`,
                { withCredentials: true }
              );
              
              const files = fileRes.data || [];
              console.log('Files in directory:', files);
              const targetFile = files.find(f => f.id.toString() === fileData.id.toString());
              
              if (targetFile) {
                console.log('Found and opening file:', targetFile);
                handleViewFile({
                  id: targetFile.id,
                  name: targetFile.name,
                  directory: fileData.directory,
                  type: 'file'
                });
              } else {
                console.error('File not found in directory');
                message.error('File not found. It may have been moved or deleted.');
              }
            };
            
            // Execute the step-by-step navigation
            navigateToFileStepByStep().catch(err => {
              console.error('Error navigating to file:', err);
              message.error('Error opening file. Please try again.');
            });
          } else {
            // Default behavior (for backward compatibility)
            console.log('Using default file opening behavior');
            setCurrentPath(fileData.directory);
            
            // Open the file after a short delay to ensure path is set
            setTimeout(() => {
              handleViewFile(fileData);
            }, 500);
          }
        } else {
          console.log('File does not belong to Operation dashboard:', fileData.directory);
        }
        
        // Clear the stored file data regardless of which dashboard opened it
        localStorage.removeItem('openFileAfterNavigation');
        localStorage.removeItem('forceOpenFile');
      } catch (e) {
        console.error('Error parsing file data from localStorage:', e);
        localStorage.removeItem('openFileAfterNavigation');
        localStorage.removeItem('forceOpenFile');
      }
    }

    // WebSocket connection with reconnection logic
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectInterval = 3000; // 3 seconds
    let reconnectTimer = null;

    const connectWebSocket = () => {
      console.log(`🔄 Attempting to connect WebSocket for user: ${username}`);

      // Clear any existing WebSocket
      if (ws) {
        ws.close();
      }
      
      const wsInstance = new WebSocket(`${WS_BASE_URL}/ws?username=${username}`);
      setWs(wsInstance);

      wsInstance.onopen = () => {
        console.log('✅ WebSocket connected');
        reconnectAttempts = 0; // Reset reconnect attempts on successful connection

        // Fetch notifications immediately after connection
        fetchItems();
        fetchAllFilesWithMessages();
      };

      wsInstance.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📬 Message received:', data);

          if (data.event === 'new_instruction' && data.receiver === username) {
            // Function to handle file navigation
            const navigateToFile = async () => {
              try {
                console.log('Navigating to file:', data);
                
                // First, determine if this is a nested directory path
                const pathParts = data.file_path.split('/');
                console.log('Path parts:', pathParts);
                
                // Navigate to each part of the path sequentially
                let currentDir = '';
                
                // The first part will be 'Operation' so start with that
                setCurrentPath('Operation');
                currentDir = 'Operation';
                
                // Wait a moment for the first navigation to complete
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // If we have nested directories, navigate to each one
                if (pathParts.length > 1) {
                  for (let i = 1; i < pathParts.length; i++) {
                    currentDir = `${currentDir}/${pathParts[i]}`;
                    console.log(`Navigating to directory: ${currentDir}`);
                    setCurrentPath(currentDir);
                    
                    // Wait for each directory navigation to complete
                    await new Promise(resolve => setTimeout(resolve, 300));
                  }
                }
                
                // Close the notification message
                message.destroy(`instruction-${data.file_id}`);
                
                // Now get files in the final directory
                const fileRes = await axios.get(
                  `${BASE_URL}/files?directory=${encodeURIComponent(data.file_path)}`, 
                  { withCredentials: true }
                );
                
                // Find the file with matching ID
                const files = fileRes.data || [];
                console.log('Files in directory:', files);
                const fileToOpen = files.find(file => file.id.toString() === data.file_id.toString());
                
                if (fileToOpen) {
                  console.log('Opening file:', fileToOpen);
                  // Open the file
                  handleViewFile({
                    id: fileToOpen.id,
                    name: fileToOpen.name,
                    directory: data.file_path,
                    type: 'file'
                  });
                } else {
                  console.error('File not found in directory');
                  message.error('File not found. It may have been moved or deleted.');
                }
              } catch (err) {
                console.error('Error navigating to file:', err);
                message.error('Error opening file. Please try again.');
              }
            };
            
            message.open({
              type: 'info',
              content: (
                <span 
                  onClick={navigateToFile}
                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                >
                  📬 New instruction for you: "{data.message}"
                </span>
              ),
              duration: 0, // 0 = persist until manually closed
              key: `instruction-${data.file_id}`, // key prevents stacking if same file gets multiple instructions
              btn: (
                <Button
                  type="primary"
                  size="small"
                  onClick={navigateToFile}
                >
                  View Now
                </Button>
              ),
            });

            fetchItems();
            fetchAllFilesWithMessages();
          }

          if (data.event === 'file_uploaded' && data.file_name) {
            message.success(`📁 New file uploaded: ${data.file_name}`);
            fetchItems();
            fetchAllFilesWithMessages();
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      wsInstance.onerror = (e) => {
        console.error('❌ WebSocket error:', e);
      };

      wsInstance.onclose = (e) => {
        console.warn(`⚠️ WebSocket closed with code ${e.code}:`, e.reason);

        // Attempt to reconnect if not closing intentionally
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          console.log(`🔄 WebSocket reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts} in ${reconnectInterval}ms`);

          reconnectTimer = setTimeout(() => {
            connectWebSocket();
          }, reconnectInterval);
        } else {
          console.error('❌ Maximum WebSocket reconnect attempts reached');
          // Fetch notifications through HTTP as a fallback
          fetchAllFilesWithMessages();
        }
      };
    };

    // Initial connection
    connectWebSocket();

    // Cleanup function
    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (ws) {
        ws.close();
      }
    };
  }, []);


  const fetchDirectories = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/directory/tree`, { withCredentials: true });
      setDirectories(res.data || []);
    } catch (error) {
      console.error('Error fetching directories:', error);
    }
  };

  const fetchAllFilesWithMessages = async () => {
    try {
      // First, try to get all files with messages assigned to the current user
      const filesWithMessagesRes = await axios.get(`${BASE_URL}/files-with-messages`, { withCredentials: true });
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
        `${BASE_URL}/file/message/${messageId}/done`,
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
      const dirRes = await axios.get(`${BASE_URL}/directory/list?directory=${dirParam}`, { withCredentials: true });
      const folders = (dirRes.data || []).map((folder) => ({
        id: `folder-${folder.name}`,
        name: folder.name,
        type: 'directory',
        created_by: folder.created_by || '',
      }));

      // 2. Fetch files
      const fileRes = await axios.get(`${BASE_URL}/files?directory=${dirParam}`, { withCredentials: true });
      const files = (fileRes.data || []).map((file) => ({
        id: file.id,
        name: file.name,
        type: 'file',
        size: file.size,
        formattedSize: formatFileSize(file.size),
        uploader: file.uploader,
      }));

      // 3. Combine and sort: folders first, then files, both alphabetically
      const combined = [...folders, ...files];
      const sortedItems = combined.sort((a, b) => {
        // Folders first
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        // Then alphabetical
        return a.name.localeCompare(b.name);
      });

      // 4. Set the sorted items
      setItems(sortedItems);
    } catch (error) {
      console.error('Error loading items:', error);
      message.error('Failed to fetch files or folders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [currentPath]);

  // Auto-refresh items periodically, but only when no modals are open
  useEffect(() => {
    // Refresh the file list every 10 seconds
    const interval = setInterval(() => {
      // Only auto-refresh if we're not in the middle of an operation
      if (!moveModalVisible && !copyModalVisible && !renameModalVisible && !createFolderModal && !uploadModalVisible && !infoModalVisible) {
        fetchItems();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [currentPath, moveModalVisible, copyModalVisible, renameModalVisible, createFolderModal, uploadModalVisible, infoModalVisible]);

  // Perform global search across all subfolders
  const performSearch = async (query) => {
    if (!query.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    setIsSearching(true);

    try {
      // Build the search URL with the main folder parameter for Operation
      const searchUrl = `${BASE_URL}/search?q=${encodeURIComponent(query)}&main_folder=Operation`;

      const response = await axios.get(searchUrl, { withCredentials: true });

      // Format the search results
      const formattedResults = (response.data || []).map(item => ({
        ...item,
        formattedSize: formatFileSize(item.size || 0),
      }));

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

      setSearchResults(sortedResults);
      console.log(`🔍 Search found ${sortedResults.length} results`);
    } catch (error) {
      console.error('Search error:', error);
      message.error('Error performing search');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Debounce the search to avoid too many requests
  const debouncedSearch = useCallback(
    debounce((query) => {
      performSearch(query);
    }, 500),
    [currentPath]
  );

  // Update search when search term changes
  useEffect(() => {
    if (searchTerm.trim()) {
      debouncedSearch(searchTerm);
    } else {
      setIsSearching(false);
      setSearchResults([]);
    }
  }, [searchTerm, debouncedSearch]);

  // Navigate to the folder containing a search result
  const navigateToFolder = (directory) => {
    setSearchTerm('');
    setIsSearching(false);
    setCurrentPath(directory);
  };

  // If we're searching, use search results, otherwise show all items or filter by search term
  const displayItems = isSearching
    ? searchResults
    : searchTerm.trim()
      ? items.filter((item) => (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
      : items;

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

  const handleFolderClick = (folderName) => {
    const newPath = path.join(currentPath, folderName);
    if (!newPath.startsWith('Operation')) return;
    setCurrentPath(newPath);
  };

  const handleGoUp = () => {
    if (!currentPath || currentPath === 'Operation') return;
    const parent = path.dirname(currentPath);
    setCurrentPath(parent === '.' ? '' : parent);
  };

  const getPathSegments = (p) => p.split('/').filter(Boolean).slice(1);
  const segments = getPathSegments(currentPath);

  const breadcrumbItems = [
    <Breadcrumb.Item key="operation">
      <a onClick={() => setCurrentPath('Operation')}>Operation</a>
    </Breadcrumb.Item>,
    ...segments.map((seg, index) => {
      const partialPath = ['Operation', ...segments.slice(0, index + 1)].join('/');
      const isLast = index === segments.length - 1;
      return (
        <Breadcrumb.Item key={index}>
          {isLast ? seg : <a onClick={() => setCurrentPath(partialPath)}>{seg}</a>}
        </Breadcrumb.Item>
      );
    })
  ];

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      message.error('Folder name cannot be empty');
      return;
    }
    try {
      await axios.post(`${BASE_URL}/directory/create`, {
        name: newFolderName,
        parent: currentPath,
        container: 'operation'
      }, { withCredentials: true });
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

  const handleOpenUploadModal = () => {
    if (!currentPath) {
      message.error('Please select or create a folder before uploading.');
      return;
    }
    setUploadingFiles([]);
    setUploadModalVisible(true);
  };

  const handleModalUpload = async () => {
    if (uploadingFiles.length === 0) {
      message.error('Please select one or more files first');
      return;
    }

    // Validate file types
    const allowedExtensions = [
      // Word documents
      '.doc', '.docx',
      // Excel spreadsheets
      '.xls', '.xlsx',
      // PowerPoint presentations
      '.ppt', '.pptx',
      // PDF documents
      '.pdf',
      // Image formats
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif'
    ];
  
    const allowedTypes = [
      // Word documents
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Excel spreadsheets
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // PowerPoint presentations
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // PDF documents
      'application/pdf',
      // Image formats
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/bmp',
      'image/tiff'
    ];

    // Check each file type
    for (const file of uploadingFiles) {
      const ext = path.extname(file.name).toLowerCase();
      if (!allowedExtensions.includes(ext) || !allowedTypes.includes(file.type)) {
        message.error(`Unsupported file: ${file.name} (${file.type})`);
        return;
      }
    }

    // Ensure consistent directory path format - always use forward slashes
    // and lowercase for consistent database storage and retrieval
    const normalizedPath = currentPath.split(/[/\\]/).map(part => part.toLowerCase()).join('/');
    console.log("Uploading to directory:", normalizedPath); // for debugging

    try {
      const existingFilesRes = await axios.get(`${BASE_URL}/files?directory=${encodeURIComponent(normalizedPath)}`, {
        withCredentials: true
      });
      const existingFiles = existingFilesRes.data || [];
      const existingNames = existingFiles.map(f => f.name);

      if (uploadingFiles.length === 1) {
        const formData = new FormData();
        formData.append('file', uploadingFiles[0]);
        formData.append('directory', normalizedPath);
        formData.append('container', 'operation');

        await axios.post(`${BASE_URL}/upload`, formData, {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        message.success('File uploaded successfully');
      } else {
        const formData = new FormData();
        uploadingFiles.forEach((file) => formData.append('files', file));
        formData.append('directory', normalizedPath);
        formData.append('container', 'operation');
        formData.append('overwrite', 'false');
        formData.append('skip', 'false');

        const res = await axios.post(`${BASE_URL}/bulk-upload`, formData, {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const results = res.data || [];
        const uploaded = results.filter(r => r.status === 'uploaded' || r.status === 'overwritten').length;
        const skipped = results.filter(r => r.status === 'skipped').length;
        const failed = results.filter(r => r.status.startsWith('error')).length;

        message.success(`${uploaded} uploaded, ${skipped} skipped, ${failed} failed`);
      }

      setUploadModalVisible(false);
      setUploadingFiles([]);
      fetchItems(); // refresh the view
      fetchAllFilesWithMessages();
    } catch (error) {
      console.error('Upload error:', error);
      message.error('Upload failed');
    }
  };


  const handleDelete = async (record) => {
    try {
      setLoading(true);

      if (record.type === 'directory') {
        await axios.delete(`${BASE_URL}/directory/delete`, {
          data: { name: record.name, parent: currentPath },
          withCredentials: true
        });
        setLoading(false);
        message.success(`Directory '${record.name}' deleted successfully`);
      } else {
        // First check if this file has any messages/instructions
        const fileId = record.id;
        const fileWithMessages = allFilesWithMessages.find(file => file.id === fileId);
        
        // Delete the file
        await axios.delete(`${BASE_URL}/delete-file`, {
          data: {
            filename: record.name,
            directory: currentPath
          },
          withCredentials: true
        });
        
        // If the file had messages, also clean them up from the database
        if (fileWithMessages && fileWithMessages.messages && fileWithMessages.messages.length > 0) {
          console.log(`File had ${fileWithMessages.messages.length} task notifications, cleaning up...`);
          try {
            // Delete messages associated with this file
            await axios.delete(`${BASE_URL}/file/${fileId}/messages`, {
              withCredentials: true
            });
            console.log('Task notifications for deleted file were removed successfully');
          } catch (msgError) {
            console.error('Error cleaning up file messages:', msgError);
            // Non-critical error, so we don't show a user message
          }
        }
        
        setLoading(false);
        message.success(`File '${record.name}' deleted successfully`);
      }

      // Refresh the UI
      fetchItems();
      fetchAllFilesWithMessages();
      
      // If we're using the notification dropdown, trigger a refresh there too
      const notificationDropdownRefreshEvent = new CustomEvent('refreshNotifications');
      window.dispatchEvent(notificationDropdownRefreshEvent);
    } catch (error) {
      console.error('Delete error:', error);
      setLoading(false);
      message.error(error.response?.data?.error || 'Error deleting item');
    }
  };

  const handleDownload = async (fileName, directory) => {
    try {
      // Verify file exists before attempting to download
      const dirToCheck = directory || currentPath;
      const checkUrl = `${BASE_URL}/files?directory=${encodeURIComponent(dirToCheck)}`;
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
        await batchDelete(selectedRows, currentPath, 'operation', () => {
          fetchItems();
          fetchDirectories();
          fetchAllFilesWithMessages();
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

  const handleViewFile = async (file) => {
    try {
      if (isSearching) {
        // For search results, verify file exists in its directory
        const dirToCheck = file.directory || '';
        const checkUrl = `${BASE_URL}/files?directory=${encodeURIComponent(dirToCheck)}`;
        const checkRes = await axios.get(checkUrl, { withCredentials: true });

        const filesArray = Array.isArray(checkRes.data) ? checkRes.data : [];
        // More robust check: ignore directory property, just check name (case-insensitive)
        const fileExists = filesArray.some(f =>
          f.name.trim().toLowerCase() === file.name.trim().toLowerCase()
        );

        if (!fileExists) {
          message.error('This file no longer exists. Please refresh the page.');
          return;
        }

        // Proceed with preview if file exists
        const encodedDir = encodeURIComponent(dirToCheck);
        const encodedFile = encodeURIComponent(file.name.trim());
        const previewUrl = `${BASE_URL}/preview?directory=${encodedDir}&filename=${encodedFile}`;
        window.open(previewUrl, '_blank');
      } else {
        // For regular file listing, verify file exists in current directory
        const checkUrl = `${BASE_URL}/files?directory=${encodeURIComponent(currentPath)}`;
        const checkRes = await axios.get(checkUrl, { withCredentials: true });

        const filesArray = Array.isArray(checkRes.data) ? checkRes.data : [];
        // More robust check: ignore directory property, just check name (case-insensitive)
        const fileExists = filesArray.some(f =>
          f.name.trim().toLowerCase() === file.name.trim().toLowerCase()
        );

        if (!fileExists) {
          message.error('This file no longer exists. Please refresh the page.');
          return;
        }

        // Proceed with preview if file exists
        const encodedDir = encodeURIComponent(currentPath || '');
        const encodedFile = encodeURIComponent(file.name.trim());
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

  const handleRename = (record) => {
    const isOwner = record.type === 'directory'
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

  const handleRenameConfirm = async () => {
    if (!renameNewName.trim()) {
      message.error('New name cannot be empty');
      return;
    }
    try {
      if (selectedItem.type === 'directory') {
        await axios.put(
          `${BASE_URL}/directory/rename`,
          {
            old_name: selectedItem.name,
            new_name: renameNewName,
            parent: currentPath,
            container: 'operation',
          },
          { withCredentials: true }
        );
      } else {
        await axios.put(
          `${BASE_URL}/file/rename`,
          {
            old_filename: selectedItem.name,
            new_filename: renameNewName,
            directory: currentPath,
            container: 'operation',
          },
          { withCredentials: true }
        );
      }
      message.success('Item renamed successfully');
      setRenameModalVisible(false);
      setSelectedItem(null);
      fetchItems();
      fetchAllFilesWithMessages();
    } catch (error) {
      console.error('Rename error:', error);
      message.error(error.response?.data?.error || 'Error renaming item');
    }
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
    setCopyModalVisible(true);
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
    try {
      // Determine the destination path based on main folder and subfolder
      let destinationPath = selectedMainFolder;
      if (selectedSubFolder) {
        destinationPath = `${selectedMainFolder}/${selectedSubFolder}`;
      }

      // For files, check if a file with the same name already exists at the destination
      if (copyItem.type === 'file') {
        try {
          const res = await axios.get(`${BASE_URL}/files?directory=${encodeURIComponent(destinationPath)}`, {
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
        } catch (err) {
          console.error('Error checking for existing files:', err);
          // Continue with copy operation if we can't check for conflicts
        }
      }

      // If no conflict or it's a directory, proceed with copy
      await finalizeCopy(false);
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

  const finalizeCopy = async (overwrite) => {
    try {
      // Determine the destination path based on main folder and subfolder
      let destinationPath = selectedMainFolder;
      if (selectedSubFolder) {
        destinationPath = `${selectedMainFolder}/${selectedSubFolder}`;
      }

      if (copyItem.type === 'directory') {
        await axios.post(
          '/directory/copy',
          {
            source_name: copyItem.name,
            source_parent: currentPath,
            new_name: copyNewName,
            destination_parent: selectedDestination || currentPath,
            container: 'operation',
          },
          { withCredentials: true }
        );
      } else {
        await axios.post(
          `${BASE_URL}/copy-file`,
          {
            source_file: copyItem.name,
            new_file_name: copyNewName,
            destination_folder: selectedDestination || currentPath,
            container: 'operation',
          },
          { withCredentials: true }
        );
      }
      message.success(`Copied '${copyItem.name}' to '${copyNewName}' successfully`);
      setCopyModalVisible(false);
      setCopyNewName('');
      setCopyItem(null);
      setSelectedDestination('');
      fetchItems();
    } catch (error) {
      console.error('Copy error:', error);
      message.error(error.response?.data?.error || 'Error copying item');
    }
  };

  const fetchSubFolders = async (mainFolder) => {
    try {
      const res = await axios.get(`${BASE_URL}/directory/list?directory=${encodeURIComponent(mainFolder)}`,
        { withCredentials: true }
      );

      // Filter to only include directories and sort them alphabetically
      const folders = (res.data || [])
        .filter(item => item.type === 'directory')
        .map(folder => ({
          name: folder.name,
          path: `${mainFolder}/${folder.name}`
        }))
        .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically

      setSubFolders(folders);
    } catch (error) {
      console.error('Error fetching subfolders:', error);
      message.error('Failed to load subfolders');
      setSubFolders([]);
    }
  };

  const handleMainFolderChange = (value) => {
    setSelectedMainFolder(value);
    setSelectedSubFolder('');
    setMoveDestination(value); // Set the destination to the main folder by default

    if (value) {
      fetchSubFolders(value);
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
    const isOwner = record.type === 'directory'
      ? record.created_by === currentUser
      : record.uploader === currentUser;
    if (!isOwner) {
      message.error('Only the owner can move this item.');
      return;
    }

    // For files, verify the file still exists before showing the move modal
    if (record.type === 'file') {
      try {
        const checkUrl = `${BASE_URL}/files?directory=${encodeURIComponent(currentPath)}`;
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
          const checkUrl = `${BASE_URL}/files?directory=${encodeURIComponent(currentPath)}`;
          const checkRes = await axios.get(checkUrl, { withCredentials: true });

          const fileExists = (checkRes.data || []).some(f =>
            f.name === moveItem.name && (f.directory === currentPath || f.directory === undefined)
          );

          if (!fileExists) {
            throw new Error("Source file not found. It may have been deleted or moved.");
          }
        } catch (checkErr) {
          console.error('File existence check failed:', checkErr);
          message.error('Could not verify file existence. Please refresh and try again.');
          setMoveModalVisible(false);
          return;
        }

        // Then check if a file with the same name exists at the destination
        try {
          const res = await axios.get(`${BASE_URL}/files?directory=${encodeURIComponent(moveDestination)}`, {
            withCredentials: true
          });

          const existingNames = Array.isArray(res.data) ? res.data.map(f => f.name) : [];
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
        } catch (err) {
          console.error('Error checking for existing files at destination:', err);
          // Continue with move operation if we can't check for conflicts
        }
      }

      if (moveItem.type === 'directory') {
        await axios.post(
          `${BASE_URL}/directory/move`,
          {
            name: moveItem.name,
            old_parent: currentPath,
            new_parent: moveDestination,
            container: 'operation',
          },
          { withCredentials: true }
        );
      } else {
        console.log('Moving file with:', {
          id: moveItem.id.toString(),
          filename: moveItem.name,
          old_parent: currentPath,
          new_parent: moveDestination,
          overwrite: false
        });

        await axios.post(
          `${BASE_URL}/move-file`,
          {
            id: moveItem.id.toString(),
            filename: moveItem.name,
            old_parent: currentPath,
            new_parent: moveDestination,
            overwrite: false
          },
          { withCredentials: true }
        );
      }
      message.success(`Moved '${moveItem.name}' successfully`);
      setMoveModalVisible(false);
      setMoveDestination('');
      setMoveItem(null);
      fetchItems();
      fetchAllFilesWithMessages();
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

  const finalizeMove = async (overwrite) => {
    try {
      if (moveItem.type === 'directory') {
        // Use the global moveFolder function
        await moveFolder(
          moveItem,
          currentPath,
          moveDestination,
          'operation', // container for OperationDashboard
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
          overwrite: overwrite
        });

        await axios.post(
          `${BASE_URL}/move-file`,
          {
            id: moveItem.id.toString(),
            filename: moveItem.name,
            old_parent: currentPath,
            new_parent: moveDestination,
            overwrite: overwrite
          },
          { withCredentials: true }
        );
      }

      message.success(`Moved '${moveItem.name}' successfully`);
      setMoveModalVisible(false);
      setMoveDestination('');
      setMoveItem(null);
      fetchItems();
      fetchAllFilesWithMessages();
    } catch (error) {
      console.error('Move finalization error:', error);
      message.error(error.response?.data?.error || 'Error moving item');
      setMoveModalVisible(false);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',

      // Removed sorting from column as we're handling it in sortedItems

      render: (name, record) => (
        <Space>
          {record.type === 'directory' ? <FolderOutlined /> : <FileTextOutlined />}
          {record.type === 'directory' ? (
            <a onClick={() => handleFolderClick(name)}>{name}</a>
          ) : (
            <span>{name}</span>
          )}
        </Space>
      ),
    },
    // If we're showing search results, add a Location column
    ...(isSearching ? [{
      title: 'Location',
      key: 'location',
      render: (_, record) => {
        const directory = record.directory || '';
        return (
          <Space>
            <span>{directory}</span>
            <Button
              type="link"
              size="small"
              onClick={() => navigateToFolder(directory)}
              icon={<ArrowLeftOutlined />}
            >
              Go to folder
            </Button>
          </Space>
        );
      }
    }] : []),
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: type => type === 'directory' ? 'Folder' : 'File'
    },
    {
      title: 'Size',
      dataIndex: 'formattedSize',
      key: 'size',
      render: (size, record) => record.type === 'directory' ? '--' : size
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 300, // Set a fixed width for the actions column
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
            setSelectedFileInfo(record);
            setInfoModalVisible(true);
          }}
        />
      )
    }
  ];

  return (
    <Layout style={{ minHeight: '84vh', background: '#f0f2f5' }}>
      <Content style={{ margin: '5px', padding: '10px', background: '#fff' }}>
        {/* File Instructions Section */}
        <div style={{ marginBottom: 24 }}>
          <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
            <Col><h3 style={{ margin: 0 }}>📬 File Instructions</h3></Col>
            <Col>
              <Space>
                <Checkbox checked={hideDone} onChange={(e) => setHideDone(e.target.checked)}>
                  Hide Completed
                </Checkbox>
                <Button
                  type="dashed"
                  icon={<DownloadOutlined />}
                  size="small"
                  onClick={fetchAllFilesWithMessages}
                >
                  Refresh
                </Button>
              </Space>
            </Col>
          </Row>

          {allFilesWithMessages.map(file => {
  const filteredMessages = hideDone
    ? file.messages.filter(msg => !msg.is_done)
    : file.messages;

  if (filteredMessages.length === 0) return null;

  return (
    <Card
      key={file.id}
      type="inner"
      size="small"
      title={
        <Space>
          <span style={{ fontWeight: 500 }}>
            🗂 File: <a style={{ textDecoration: 'underline', color: '#1890ff' }}
              onClick={() => handleViewFile({
                id: file.id,
                name: file.name,
                directory: file.directory,
                type: 'file',
              })}
            >{file.name}</a>
          </span>
          <Badge count={filteredMessages.length} />
        </Space>
      }
      extra={<Button type="link" size="small" onClick={() => setCurrentPath(file.directory)}>
        Go to Folder
      </Button>}
      style={{ marginBottom: 12, borderRadius: 8, background: '#fafafa' }}
    >
      {filteredMessages.map(msg => {
        const isNew = !msg.is_done && !msg.seenAt;
        const bgColor = msg.is_done ? '#f6ffed' : isNew ? '#e6f7ff' : '#fffbe6';
        const borderColor = msg.is_done ? '#b7eb8f' : isNew ? '#91d5ff' : '#ffe58f';
        const statusText = msg.is_done ? '✅ Done' : isNew ? '🟦 New' : '🟨 Pending';
        const statusColor = msg.is_done ? 'green' : isNew ? '#1890ff' : '#faad14';
        return (
          <div
            key={msg.id}
            style={{
              background: bgColor,
              borderLeft: `4px solid ${borderColor}`,
              padding: '10px 12px',
              marginBottom: 10,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 13, marginBottom: 4 }}>
                <strong>📝:</strong> <span 
                  style={{ fontStyle: 'italic', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => {
                    setCurrentPath(file.directory);
                    setTimeout(() => {
                      handleViewFile({
                        id: file.id,
                        name: file.name,
                        directory: file.directory,
                        type: 'file',
                      });
                    }, 100);
                  }}
                >{msg.message}</span>
              </div>
              <div style={{ fontSize: 12, color: '#555' }}>
                👤 {msg.admin_name || 'N/A'} · 🕓 {new Date(msg.created_at).toLocaleString()}
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                <strong>Status:</strong>{' '}
                <span style={{ color: statusColor, fontWeight: 500 }}>{statusText}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <Button
                type="link"
                size="small"
                style={{ padding: 0, color: '#1890ff' }}
                onClick={() => {
                  setCurrentPath(file.directory);
                  setTimeout(() => {
                    handleViewFile({
                      id: file.id,
                      name: file.name,
                      directory: file.directory,
                      type: 'file',
                    });
                  }, 300);
                }}
              >Go to File</Button>
              {!msg.is_done && (
                <Button
                  type="primary"
                  size="small"
                  style={{ marginTop: 6 }}
                  onClick={() => markAsDone(msg.id, file.id)}
                >
                  Mark as Done
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </Card>
  );
})}
        </div>

        {/* Dashboard UI */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <h2 style={{ margin: 0 }}>Operation</h2>
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
              Upload File(s)
            </Button>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col>
            <Button icon={<ArrowUpOutlined />} onClick={handleGoUp} disabled={!currentPath}>
              Go Up
            </Button>
          </Col>
          <Col>
            <Button icon={<FolderAddOutlined />} onClick={() => setCreateFolderModal(true)}>
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
            <Input.Search
              placeholder={isSearching
                ? "Search in Operation..."
                : currentPath
                  ? `Search in ${currentPath}...`
                  : "Search in Operation..."}
              value={searchTerm}
              onChange={(e) => {
                const value = e.target.value;
                setSearchTerm(value);
                // If search is cleared, immediately reset search state
                if (!value.trim()) {
                  setIsSearching(false);
                  setSearchResults([]);
                }
              }}
              onSearch={(value) => {
                if (value.trim()) {
                  performSearch(value);
                } else {
                  setIsSearching(false);
                  setSearchResults([]);
                }
              }}
              loading={searchLoading}
              allowClear
              enterButton
            />
          </Col>
        </Row>



        {!isSearching && (
          <Breadcrumb style={{ marginBottom: 16 }}>{breadcrumbItems}</Breadcrumb>
        )}





        <Table
  columns={columns}
  dataSource={sortedItems}
  rowKey={(record) => (record.id ? record.id : record.name + record.type)}
  loading={loading}
  pagination={false}
  scroll={{ y: '49vh', x: '100%' }}  // for content scrolling on table
  rowSelection={rowSelection}
  className="action-buttons-table"
  tableLayout="fixed"
  onRow={(record) => ({
    onClick: () => handleRowClick(record),
    style: { cursor: record.type === 'directory' ? 'pointer' : 'default' }
  })}
/>
        <Modal
          title="File Information"
          visible={infoModalVisible}
          onCancel={() => setInfoModalVisible(false)}
          footer={null}
        >
          {selectedFileInfo ? (
            <div>
              <p><strong>Name:</strong> {selectedFileInfo.name}</p>
              <p><strong>Type:</strong> {selectedFileInfo.type}</p>
              <p><strong>Size:</strong> {selectedFileInfo.formattedSize}</p>
              <p><strong>Uploader:</strong> {selectedFileInfo.uploader || 'N/A'}</p>
              <p><strong>Uploaded On:</strong> {selectedFileInfo.created_at ? new Date(selectedFileInfo.created_at).toLocaleString() : 'N/A'}</p>
              <p><strong>Directory:</strong> {selectedFileInfo.directory}</p>
            </div>
          ) : (
            <p>No file selected</p>
          )}
        </Modal>





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
          directoryItems={displayItems}
          currentPath={currentPath}

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
          container="operation"
        />
      </Content>
    </Layout>
  );
};

export default OperationDashboard;

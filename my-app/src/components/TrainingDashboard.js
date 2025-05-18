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
  Spin,

} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  FolderAddOutlined,
  ArrowUpOutlined,
  EditOutlined,
  CopyOutlined,
  SwapOutlined,
  ArrowLeftOutlined,
  LockOutlined,
  FileOutlined,
  ReloadOutlined,
  MoreOutlined,
  ExclamationCircleOutlined
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
import { deleteFolder, confirmFolderDelete, copyFolder, fetchSubFolders, moveFolder } from '../utils/folderOperations';

const { Content } = Layout;
const { Option } = Select;
const BASE_URL = `${window.location.protocol}//${window.location.hostname}:8080`;

/**
 * Helper to format file sizes in human-readable form.
 */
function formatFileSize(size) {
  if (size === undefined || size === null) return 'Unknown';
  if (size === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(size) / Math.log(1024));
  return (size / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
}

const TrainingDashboard = () => {
  const navigate = useNavigate();

  // ----------------------------------
  // Current user and role states
  // ----------------------------------
  const [currentUser, setCurrentUser] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  // ----------------------------------
  // States: path, items, loading, search, etc.
  // ----------------------------------
  const [currentPath, setCurrentPath] = useState('Training');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [allFilesWithMessages, setAllFilesWithMessages] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);

  // Create folder modal
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Rename
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [renameNewName, setRenameNewName] = useState('');

  // Copy
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [copyItem, setCopyItem] = useState(null);
  const [copyNewName, setCopyNewName] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');

  // Move
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [moveItem, setMoveItem] = useState(null);
  const [moveDestination, setMoveDestination] = useState('');
  const [selectedMainFolder, setSelectedMainFolder] = useState('');
  const [selectedSubFolder, setSelectedSubFolder] = useState('');
  const [subFolders, setSubFolders] = useState([]);

  // Directory tree for moving files/folders
  const [directories, setDirectories] = useState([]);

  // Upload
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);

  // ----------------------------------
  // Initial Load: set user and fetch directories
  // ----------------------------------
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    const storedRole = localStorage.getItem('role');
    if (storedUsername) {
      setCurrentUser(storedUsername);
    }
    if (storedRole === 'admin') {
      setIsAdmin(true);
    }
    fetchDirectories();
    // eslint-disable-next-line
  }, []);

  const fetchDirectories = async () => {
    try {
      const res = await axios.get('/directory/tree?container=training', { withCredentials: true });
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

  // ----------------------------------
  // Fetch items (directories + files)
  // ----------------------------------
  const fetchItems = async () => {
    setLoading(true);
    try {
      const dirParam = encodeURIComponent(currentPath);
      // 1) Fetch directories
      const dirRes = await axios.get(`/directory/list?directory=${dirParam}`, { withCredentials: true });
      const fetchedDirs = Array.isArray(dirRes.data) ? dirRes.data : [];
      // 2) Fetch files (including confidential flag and authorized users if available)
      const fileRes = await axios.get(`/files?directory=${dirParam}`, { withCredentials: true });
      const fetchedFiles = (fileRes.data || []).map((f) => {
        // Ensure size is a valid number
        const fileSize = typeof f.size === 'number' ? f.size :
                        (f.size ? parseInt(f.size, 10) : null);

        return {
          id: f.id,
          name: f.name,
          type: 'file',
          size: fileSize,
          formattedSize: formatFileSize(fileSize),
          uploader: f.uploader
        };
      });

      setItems([...fetchedDirs, ...fetchedFiles]);
    } catch (error) {
      console.error('Error fetching directory contents:', error);
      message.error(error.response?.data?.error || 'Error fetching directory contents');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

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
      // Build the search URL with the main folder parameter for Training
      const searchUrl = `/search?q=${encodeURIComponent(query)}&main_folder=Training`;

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

      setSearchResults(formattedResults);
      console.log(`🔍 Search found ${formattedResults.length} results`);
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



  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      message.error('Folder name cannot be empty');
      return;
    }
    try {
      await axios.post(
        '/directory/create',
        { name: newFolderName, parent: currentPath, container: 'training' },
        { withCredentials: true }
      );
      message.success('Folder created successfully');
      setCreateFolderModal(false);
      setNewFolderName('');
      fetchItems();
    } catch (error) {
      console.error('Create folder error:', error);
      message.error(error.response?.data?.error || 'Error creating folder');
    }
  };

  // ----------------------------------
  // Navigation & Breadcrumb
  // ----------------------------------
  const handleFolderClick = (folderName) => {
    const newPath = path.join(currentPath, folderName);
    if (!newPath.startsWith('Training')) return;
    setCurrentPath(newPath);
  };

  const handleGoUp = () => {
    if (currentPath === 'Training') return;
    const parentPath = path.dirname(currentPath);
    setCurrentPath(parentPath === '.' ? 'Training' : parentPath);
  };

  const getPathSegments = (p) => {
    const parts = p.split('/').filter(Boolean);
    return parts.slice(1); // remove the first 'Training' part
  };

  const segments = getPathSegments(currentPath);
  const breadcrumbItems = [
    <Breadcrumb.Item key="training">
      <a onClick={() => setCurrentPath('Training')}>Training</a>
    </Breadcrumb.Item>
  ];
  segments.forEach((seg, index) => {
    const partialPath = ['Training', ...segments.slice(0, index + 1)].join('/');
    const isLast = index === segments.length - 1;
    breadcrumbItems.push(
      <Breadcrumb.Item key={index}>
        {isLast ? seg : <a onClick={() => setCurrentPath(partialPath)}>{seg}</a>}
      </Breadcrumb.Item>
    );
  });

  // ----------------------------------
  // Upload Modal
  // ----------------------------------
  const handleOpenUploadModal = () => {
    if (!currentPath) {
      message.error('Please select or create a folder before uploading.');
      return;
    }
    setUploadingFiles([]);
    setUploadModalVisible(true);
  };

  const doModalUpload = async () => {
    if (!uploadingFiles) {
      message.error('Please select a file first');
      return;
    }
    if (!currentPath) {
      message.error('Please select or create a folder first');
      return;
    }
    const formData = new FormData();
    formData.append('file', uploadingFiles);
    formData.append('directory', currentPath);
    formData.append('container', 'training');
    try {
      const res = await axios.post('/upload', formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success(res.data.message || 'File uploaded successfully');
      setUploadModalVisible(false);
      setUploadingFiles(null);
      fetchItems();
    } catch (error) {
      console.error('Modal-based upload error:', error);
      message.error(error.response?.data?.error || 'Error uploading file');
    }
  };

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
          formData.append('container', 'training');

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
          formData.append('container', 'training');

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
          'training', // Container for TrainingDashboard
          () => {
            fetchItems();
            fetchDirectories();
          }
        );
      } else {
        await axios.delete('/delete-file', {
          data: { directory: currentPath, filename: record.name, container: 'training' },
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
  // Download
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
        await batchDelete(selectedRows, currentPath, 'training', () => {
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

  // ----------------------------------
  // Rename
  // ----------------------------------
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
            container: 'training'
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
            container: 'training'
          },
          { withCredentials: true }
        );
      }
      message.success('Item renamed successfully');
      setRenameModalVisible(false);
      setSelectedItem(null);
      fetchItems();
    } catch (error) {
      console.error('Rename error:', error);
      message.error(error.response?.data?.error || 'Error renaming item');
    }
  };

  // ----------------------------------
  // Copy
  // ----------------------------------
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
          'training', // container for TrainingDashboard
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
            container: 'training',
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

  const finalizeMove = async (overwrite = false) => {
    try {
      if (moveItem.type === 'directory') {
        // Use the global moveFolder function
        await moveFolder(
          moveItem,
          currentPath,
          moveDestination,
          'training', // container for TrainingDashboard
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
          container: 'training'
        });

        await axios.post(
          '/move-file',
          {
            id: moveItem.id.toString(),
            filename: moveItem.name,
            old_parent: currentPath,
            new_parent: moveDestination,
            overwrite: overwrite,
            container: 'training'
          },
          { withCredentials: true }
        );
      }
      message.success(`Moved '${moveItem.name}' successfully`);
      setMoveModalVisible(false);
      setMoveItem(null);
      setMoveDestination('');
      fetchItems();
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
  // Table Columns
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

  return (
    <Layout style={{ minHeight: '84vh', background: '#f0f2f5' }}>
      <Content style={{ margin: '5px', padding: '10px', background: '#fff' }}>
        {/* Top Bar */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <h2 style={{ margin: 0 }}>Training</h2>
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
          <Col>
            <Button icon={<ArrowUpOutlined />} onClick={handleGoUp}>
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
                ? "Search in Training..."
                : currentPath
                  ? `Search in ${currentPath}...`
                  : "Search in Training..."}
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
          container="training"
        />
      </Content>
    </Layout>
  );
};

export default TrainingDashboard;

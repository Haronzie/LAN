import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Breadcrumb,
  Upload,
  TreeSelect,
  Select,
  Spin
} from 'antd';
import Dragger from 'antd/lib/upload/Dragger';
import {
  UploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  ArrowUpOutlined,
  FolderAddOutlined,
  EditOutlined,
  CopyOutlined,
  SwapOutlined,
  ArrowLeftOutlined,
  FileOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  MoreOutlined
} from '@ant-design/icons';
// import { useNavigate } from 'react-router-dom'; // Uncomment if navigation is needed
import axios from 'axios';
import path from 'path-browserify';
import debounce from 'lodash.debounce';
import BatchActionsMenu from './common/BatchActionsMenu';
import SelectionHeader from './common/SelectionHeader';
import { batchDelete, batchDownload } from '../utils/batchOperations';
import CommonModals from './common/CommonModals';
import './action-buttons-fix.css'; // Import CSS to fix action buttons

const { Content } = Layout;
const { Option } = Select;

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';


const UserSearchSelect = ({ value, onUserSelect, required }) => {
  const [options, setOptions] = useState([]);
  const [fetching, setFetching] = useState(false);

  const fetchUserOptions = useCallback(
    debounce(async (value) => {
      if (!value) {
        setOptions([]);
        setFetching(false);
        return;
      }
      setFetching(true);
      try {
        const response = await axios.get(`/users?search=${value}`, { withCredentials: true });
        const data = response.data || [];

        // ✅ filter out self here too if not done in map stage
        const currentUser = (localStorage.getItem('username') || '').toLowerCase();
        const filtered = data.filter(u => u.username.toLowerCase() !== currentUser);

        setOptions(filtered);

        // ✅ Auto-select the top user if one exists
        if (filtered.length > 0) {
          onUserSelect(filtered[0].username);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setFetching(false);
      }
    }, 500),
    []
  );


  const handleSearch = (inputValue) => {
    fetchUserOptions(inputValue);
  };

  return (
    <Select
      showSearch
      placeholder="Type to search for a user"
      notFoundContent={fetching ? <Spin size="small" /> : null}
      onSearch={handleSearch}
      onChange={(value) => onUserSelect(value)}
      filterOption={(input, option) =>
        option.children.toLowerCase().startsWith(input.toLowerCase())
      }
      style={{ width: '100%' }}
      allowClear
      value={value}
      status={required && !value ? 'error' : ''}
    >
      {options
  .filter(u => u.username.toLowerCase() !== (localStorage.getItem('username') || '').toLowerCase())
  .map((user) => (
    <Option key={user.username} value={user.username}>
      {user.username}
    </Option>
))}

    </Select>
  );
};

function getPathSegments(p) {
  if (!p) return [];
  return p.split('/').filter(Boolean);
}

function formatFileSize(size) {
  if (size === undefined || size === null) return 'Unknown';
  if (size === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(size) / Math.log(1024));
  return (size / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
}

const FileManager = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadingFile, setUploadingFile] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [fileUploadMessage, setFileUploadMessage] = useState('');
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [renameNewName, setRenameNewName] = useState('');
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [copyNewName, setCopyNewName] = useState('');
  const [copyItem, setCopyItem] = useState(null);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [moveDestination, setMoveDestination] = useState('');
  const [moveItem, setMoveItem] = useState(null);
  const [selectedMainFolder, setSelectedMainFolder] = useState('');
  const [selectedSubFolder, setSelectedSubFolder] = useState('');
  const [subFolders, setSubFolders] = useState([]);
  const [folderTreeData, setFolderTreeData] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState('');
  const [targetUsername, setTargetUsername] = useState('');
  const [selectedFileInfo, setSelectedFileInfo] = useState(null);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  // const [selectedFiles, setSelectedFiles] = useState([]); // Uncomment if needed for future enhancements

  // const navigate = useNavigate(); // Uncomment if navigation is needed
  const isRoot = currentPath === '';
  // Check if we're inside a subfolder (not just at the root level or main folder level)
  const isInsideMainFolder = currentPath.includes('/');

  // Get the main folder from the current path (if we're in a folder)
  const mainFolder = currentPath.split('/')[0] || '';

  const generateSuggestedName = async (baseName, extension, destinationPath) => {
    try {
      const res = await axios.get(`${BASE_URL}/files?directory=${encodeURIComponent(destinationPath)}`, {
        withCredentials: true
      });
      const existingNames = res.data.map(f => f.name);
      let attempt = 0;
      let suggested;
      do {
        suggested = attempt === 0
          ? `${baseName}${extension}`
          : `${baseName} (${attempt})${extension}`;
        attempt++;
      } while (existingNames.includes(suggested));
      return suggested;
    } catch (err) {
      console.error('Error generating suggested name:', err);
      return `${baseName}${extension}`;
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      console.log("📂 Fetching files in:", currentPath);
      const directoryParam = encodeURIComponent(currentPath);
      const [filesRes, dirsRes] = await Promise.all([
        axios.get(`${BASE_URL}/files?directory=${directoryParam}`, { withCredentials: true }),
        axios.get(`${BASE_URL}/directory/list?directory=${directoryParam}`, { withCredentials: true })
      ]);

      const files = (filesRes.data || [])
      const normalizePath = path => (path || '').replace(/^\/|\/$/g, '').toLowerCase()

      .filter(f => normalizePath(f.directory) === normalizePath(currentPath))
      .map(f => {
        // Ensure size is a valid number
        const fileSize = typeof f.size === 'number' ? f.size :
                        (f.size ? parseInt(f.size, 10) : null);

        return {
          name: f.name,
          type: 'file',
          size: fileSize,
          formattedSize: formatFileSize(fileSize),
          contentType: f.contentType,
          uploader: f.uploader,
          id: f.id
        };
      });


      let directories = dirsRes.data || [];

      if (currentPath === '') {
        const fixedFolders = ['Operation', 'Research', 'Training'].map((folder) => ({
          name: folder,
          type: 'directory',
          parent: '',
        }));

        const dirNames = directories.map((d) => d.name);
        fixedFolders.forEach((folder) => {
          if (!dirNames.includes(folder.name)) {
            directories.push(folder);
          }
        });
      }

      setItems([...directories, ...files]);
    } catch (error) {
      console.error('Error fetching items:', error);
      message.error(error.response?.data?.error || 'Error fetching directory contents');
    } finally {
      setLoading(false);
    }
  };

  const fetchFolderTree = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/directory/tree`, { withCredentials: true });
      let data = res.data || [];

      const fixedFolders = ['Operation', 'Research', 'Training'];

      // Ensure fixed folders are present
      const existingTitles = new Set(data.map(d => d.title));
      fixedFolders.forEach(folder => {
        if (!existingTitles.has(folder)) {
          data.push({
            title: folder,
            value: folder,
            key: folder,
            children: []
          });
        }
      });

      setFolderTreeData(data);
    } catch (error) {
      console.error('Error fetching folder tree:', error);
      setFolderTreeData([
        { title: 'Operation', value: 'Operation', key: 'Operation', children: [] },
        { title: 'Research', value: 'Research', key: 'Research', children: [] },
        { title: 'Training', value: 'Training', key: 'Training', children: [] },
      ]);
    }
  };


  useEffect(() => {
    fetchFolderTree();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [currentPath]);

  useEffect(() => {
    // Refresh the file list every 10 seconds
    const interval = setInterval(() => {
      // Only auto-refresh if we're not in the middle of an operation
      if (!moveModalVisible && !copyModalVisible && !renameModalVisible && !createFolderModal && !uploadModalVisible) {
        fetchItems();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [currentPath, moveModalVisible, copyModalVisible, renameModalVisible, createFolderModal, uploadModalVisible]);

  useEffect(() => {
    const updateSuggestedName = async () => {
      if (copyItem && copyItem.type === 'file') {
        const name = copyItem.name;
        const ext = path.extname(name);
        const base = path.basename(name, ext);
        const targetDir = selectedDestination || currentPath;
        const suggested = await generateSuggestedName(base, ext, targetDir);
        setCopyNewName(suggested);
      }
    };
    updateSuggestedName();
  }, [selectedDestination]);

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
      // Use the mainFolder variable we defined earlier

      // Build the search URL with the main folder parameter if we're in a specific folder
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

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      message.error('Folder name cannot be empty');
      return;
    }
    try {
      await axios.post(
        `${BASE_URL}/directory/create`,
        { name: newFolderName, parent: currentPath },
        { withCredentials: true }
      );
      message.success('Folder created successfully');
      setCreateFolderModal(false);
      setNewFolderName('');
      fetchItems();
      fetchFolderTree();
    } catch (error) {
      console.error('Create folder error:', error);
      message.error(error.response?.data?.error || 'Error creating folder');
    }
  };

  const handleFolderClick = (folderName) => {
    const newPath = isRoot ? folderName : path.join(currentPath, folderName);
    setCurrentPath(newPath);
  };

  // This function is currently not used but might be useful for future enhancements
  // const filteredTreeData = useMemo(() => {
  //   const disableCurrent = (nodes) => {
  //     return nodes.map((node) => ({
  //       ...node,
  //       disabled: node.value === currentPath,
  //       children: node.children ? disableCurrent(node.children) : []
  //     }));
  //   };
  //   return disableCurrent(folderTreeData);
  // }, [folderTreeData, currentPath]);

  const handleGoUp = () => {
    if (isRoot) return;
    const parent = path.dirname(currentPath);
    setCurrentPath(parent === '.' ? '' : parent);
  };

  const handleBreadcrumbClick = (index) => {
    const segments = getPathSegments(currentPath);
    const newPath = segments.slice(0, index + 1).join('/');
    setCurrentPath(newPath);
  };

  const handleOpenUploadModal = () => {
    if (isRoot) {
      message.error('Please select an existing folder before uploading a file.');
      return;
    }
    setUploadingFile([]); // ✅ now an empty array
    setUploadModalVisible(true);
  };

  // This function is currently not used but might be needed for future enhancements
  // const handleRemoveFile = (index) => {
  //   const updatedFiles = [...selectedFiles];
  //   updatedFiles.splice(index, 1);
  //   setSelectedFiles(updatedFiles);
  // };

  const handleUpload = async () => {
    if (!uploadingFile || uploadingFile.length === 0) {
      message.error('Please select files first');
      return;
    }
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    for (const file of uploadingFile) {
      const ext = path.extname(file.name).toLowerCase();
      if (!allowedExtensions.includes(ext) || !allowedTypes.includes(file.type)) {
        message.error(`Unsupported file: ${file.name} (${file.type})`);
        return;
      }
    }


    if (fileUploadMessage.trim() && !targetUsername) {
      message.error('Please select a valid user to send the file to when including a message.');
      return;
    }

    const normalizedPath = currentPath.replace(/\\/g, '/');

    const existingFilesRes = await axios.get(`${BASE_URL}/files?directory=${encodeURIComponent(normalizedPath)}`, {
      withCredentials: true
    });
    const existingFiles = existingFilesRes.data || [];
    const existingNames = existingFiles.map(f => f.name);

    if (uploadingFile.length === 1) {
      const file = uploadingFile[0];
      const fileExists = existingNames.includes(file.name);

      const uploadSingle = async (overwrite) => {
        const formData = new FormData();
        formData.append('file', file);
        console.log("Sending folder:", normalizedPath);
        formData.append('directory', normalizedPath); // Fixed: removed toLowerCase()
        formData.append('container', mainFolder || 'operation'); // Added container parameter
        if (overwrite) formData.append('overwrite', 'true');
        if (fileUploadMessage.trim() && targetUsername.trim()) {
          formData.append('message', fileUploadMessage.trim());
          formData.append('receiver', targetUsername.trim());
        }

        try {
          await axios.post(`${BASE_URL}/upload`, formData, {
            withCredentials: true,
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          message.success(`${file.name} uploaded`);
        } catch (error) {
          console.error('Upload failed:', error);
          const errorMessage = error.response?.data?.error || `Upload failed for ${file.name}`;
          message.error(errorMessage);
        }
      };

      if (fileExists) {
        Modal.confirm({
          title: `A file named '${file.name}' already exists.`,
          icon: <ExclamationCircleOutlined />,
          content: 'Do you want to overwrite or keep both?',
          okText: 'Overwrite',
          cancelText: 'Keep Both',
          okButtonProps: { danger: true },
          onOk: async () => await uploadSingle(true),
          onCancel: async () => await uploadSingle(false),
        });
      } else {
        await uploadSingle(false);
      }
    } else {
      const formData = new FormData();
      uploadingFile.forEach((file) => formData.append('files', file));
      formData.append('directory', normalizedPath); // ✅ updated
      formData.append('container', mainFolder || 'operation'); // ✅ updated using mainFolder variable
      formData.append('overwrite', 'false');
      formData.append('skip', 'false');
      if (fileUploadMessage.trim() && targetUsername.trim()) {
        formData.append('message', fileUploadMessage.trim());
        formData.append('receiver', targetUsername.trim());
      }

      try {
        const res = await axios.post(`${BASE_URL}/bulk-upload`, formData, {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const results = res.data || [];
        const uploaded = results.filter(r => r.status === 'uploaded' || r.status === 'overwritten').length;
        const skipped = results.filter(r => r.status === 'skipped').length;
        const failed = results.filter(r => r.status.startsWith('error')).length;

        message.success(`${uploaded} uploaded, ${skipped} skipped, ${failed} failed`);
      } catch (error) {
        console.error('Bulk upload failed:', error);
        const errorMessage = error.response?.data?.error || 'Bulk upload failed';
        message.error(errorMessage);
      }
    }

    setUploadModalVisible(false);
    setUploadingFile([]);
    setFileUploadMessage('');
    setTargetUsername('');
    fetchItems();
  };

  // This function is currently not used but might be needed for future enhancements
  // const uploadFile = async (formData, isOverwrite) => {
  //   try {
  //     const res = await axios.post(`${BASE_URL}/upload`, formData, {
  //       withCredentials: true,
  //       headers: { 'Content-Type': 'multipart/form-data' }
  //     });

  //     const { message: uploadMsg, file_id } = res.data;

  //     if (fileUploadMessage.trim() && targetUsername.trim()) {
  //       try {
  //         await axios.post(`${BASE_URL}/file/message`, {
  //           file_id,
  //           receiver: targetUsername.trim(),
  //           message: fileUploadMessage.trim()
  //         }, { withCredentials: true });

  //         message.success(`Message sent to ${targetUsername}`);
  //       } catch (msgErr) {
  //         console.error('Message upload failed:', msgErr);
  //         message.error('Failed to send message to user');
  //       }
  //     }

  //     message.success(uploadMsg || 'File uploaded');
  //     setUploadModalVisible(false);
  //     setUploadingFile(null);
  //     setFileUploadMessage('');
  //     setTargetUsername('');
  //     fetchItems();
  //   } catch (error) {
  //     console.error('Upload failed:', error);
  //     message.error(error.response?.data?.error || 'Upload error');
  //   }
  // };

  const handleDelete = async (record) => {
    try {
      if (record.type === 'directory') {
        await axios.delete(`${BASE_URL}/directory/delete`, {
          data: { name: record.name, parent: currentPath },
          withCredentials: true
        });
      } else {
        console.log("🗑 Deleting file:", record.name, "from folder:", currentPath);
        await axios.delete(`${BASE_URL}/delete-file`, {
          data: {
            filename: record.name,
            directory: currentPath
          },
          withCredentials: true
        });
      }
      message.success(`${record.name} deleted successfully`);
      fetchItems();
      if (record.type === 'directory') {
        fetchFolderTree();
      }
    } catch (error) {
      console.error('Delete error:', error);
      message.error(error.response?.data?.error || `Error deleting ${record.name}`);
    }
  };

  const handleDownload = (fileName) => {
    const encodedDir = encodeURIComponent(currentPath || '');
    const encodedFile = encodeURIComponent(fileName.trim());
    const downloadUrl = `${BASE_URL}/download?directory=${encodedDir}&filename=${encodedFile}`;
    window.open(downloadUrl, '_blank');
  };

  const handleDownloadFolder = (folderName) => {
    const folderPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    const encodedPath = encodeURIComponent(folderPath.trim());
    const downloadUrl = `${BASE_URL}/download-folder?directory=${encodedPath}`;
    window.open(downloadUrl, '_blank');
  };

  const handleViewFile = (file) => {
    const encodedDir = encodeURIComponent(currentPath || '');
    const encodedFile = encodeURIComponent(file.name.trim());
    const previewUrl = `${BASE_URL}/preview?directory=${encodedDir}&filename=${encodedFile}`;
    window.open(previewUrl, '_blank');
  };

  // Handle row click for the entire table row
  const handleRowClick = (record) => {
    // Only respond to directory clicks
    if (record.type === 'directory') {
      handleFolderClick(record.name);
    }
    // Files are handled by their action buttons, not by row clicks
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
            parent: currentPath
          },
          { withCredentials: true }
        );
        fetchFolderTree();
      } else {
        await axios.put(
          `${BASE_URL}/file/rename`,
          {
            old_filename: selectedItem.name,
            new_filename: renameNewName
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

  const handleCopy = async (record) => {
    const name = record.name;
    const ext = path.extname(name);
    const base = path.basename(name, ext);
    const targetDir = selectedDestination || currentPath;
    const suggested = await generateSuggestedName(base, ext, targetDir);
    setCopyItem(record);
    setCopyNewName(suggested);
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
      const targetDir = selectedDestination || currentPath;

      if (copyItem.type === 'directory') {
        await axios.post(`${BASE_URL}/directory/copy`, {
          source_name: copyItem.name,
          source_parent: currentPath,
          new_name: copyNewName,
          destination_parent: targetDir
        }, { withCredentials: true });

        message.success(`Directory '${copyItem.name}' copied as '${copyNewName}'`);
        fetchFolderTree();

      } else {
        const res = await axios.post(`${BASE_URL}/copy-file`, {
          source_file: copyItem.name,
          new_file_name: copyNewName,
          destination_folder: targetDir
        }, { withCredentials: true });

        const finalName = res.data.final_name || copyNewName;

        message.success(`File '${copyItem.name}' copied as '${finalName}'`);
      }

      setCopyModalVisible(false);
      setCopyItem(null);
      setCopyNewName('');
      fetchItems();
    } catch (err) {
      console.error('Copy error:', err);
      message.error(err.response?.data?.error || 'Error copying item');
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
        // Continue anyway, the finalizeMove function will do another check
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
    if (!moveDestination?.trim()) {
      message.error('Please select a destination folder');
      return;
    }

    if (!moveItem) {
      message.error('No item selected to move');
      return;
    }

    try {
      if (moveItem.type === 'file') {
        const res = await axios.get(`${BASE_URL}/files?directory=${encodeURIComponent(moveDestination)}`, {
          withCredentials: true
        });

        const existingNames = Array.isArray(res.data) ? res.data.map(f => f.name) : [];
        const nameExists = existingNames.includes(moveItem.name);

        if (nameExists) {
          const conflictModal = Modal.info({
            title: `A file named '${moveItem.name}' already exists in '${moveDestination}'`,
            icon: <ExclamationCircleOutlined />,
            closable: true,
            width: 600,
            content: (
              <div>
                <p>Choose an action for this file:</p>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '12px',
                  marginTop: '16px'
                }}>
                  <Button
                    type="primary"
                    danger
                    style={{ flex: 1 }}
                    onClick={async () => {
                      try {
                        await finalizeMove(true);
                        setMoveModalVisible(false);
                        conflictModal.destroy();
                      } catch (err) {
                        console.error('Replace failed:', err);
                        message.error('Failed to replace file.');
                      }
                    }}
                  >
                    Replace
                  </Button>

                  <Button
                    style={{ flex: 1 }}
                    onClick={() => {
                      message.info('Skipped this file.');
                      setMoveModalVisible(false);
                      conflictModal.destroy();
                    }}
                  >
                    Skip
                  </Button>

                  <Button
                    type="default"
                    style={{ flex: 1 }}
                    onClick={async () => {
                      try {
                        await finalizeMove(false);
                        setMoveModalVisible(false);
                        conflictModal.destroy();
                      } catch (err) {
                        console.error('Keep both failed:', err);
                        message.error('Failed to keep both.');
                      }
                    }}
                  >
                    Keep Both
                  </Button>
                </div>
              </div>
            ),
            okButtonProps: { style: { display: 'none' } },
            cancelButtonProps: { style: { display: 'none' } },
          });

          return;
        }
      }

      await finalizeMove(false);
    } catch (err) {
      console.error('Move error:', err);
      message.error('Error checking for conflict or moving file');
    }
  };

  const finalizeMove = async (overwrite) => {
    try {
      if (moveItem.type === 'directory') {
        await axios.post(
          `${BASE_URL}/directory/move`,
          {
            name: moveItem.name,
            old_parent: currentPath,
            new_parent: moveDestination
          },
          { withCredentials: true }
        );
      } else {
        // First, verify the file exists by trying to get its metadata
        try {
          const checkUrl = `${BASE_URL}/files?directory=${encodeURIComponent(currentPath)}`;
          const checkRes = await axios.get(checkUrl, { withCredentials: true });

          const fileExists = (checkRes.data || []).some(f =>
            f.name === moveItem.name && f.directory === currentPath
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

        console.log('Moving file with:', {
          id: moveItem.id,
          filename: moveItem.name,
          old_parent: currentPath,
          new_parent: moveDestination,
          overwrite
        });

        await axios.post(
          `${BASE_URL}/move-file`,
          {
            id: moveItem.id,
            filename: moveItem.name,
            old_parent: currentPath,
            new_parent: moveDestination,
            overwrite,
          },
          { withCredentials: true }
        );
      }

      message.success(`Moved '${moveItem.name}' successfully`);

      setMoveModalVisible(false);
      setMoveDestination('');
      setMoveItem(null);

      fetchItems();  // Stay in current folder
      fetchFolderTree();
    } catch (err) {
      console.error('Move error:', err);

      // Handle specific error cases
      if (err.response?.data?.error === "Source file does not exist on disk") {
        message.error('The file no longer exists on the server. Please refresh the page.');
      } else {
        message.error(err.response?.data?.error || 'Error moving item');
      }

      setMoveModalVisible(false);
    }
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
        await batchDelete(selectedRows, currentPath, null, () => {
          fetchItems();
          fetchFolderTree();
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
    // Only allow selection mode when not at root level
    if (!isRoot) {
      setSelectionMode(true);
    } else {
      message.info('Please navigate to a folder before selecting items.');
    }
  };

  // Cancel selection mode
  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedRowKeys([]);
    setSelectedRows([]);
  };

  // Only enable row selection when not at root level
  const rowSelection = (selectionMode && !isRoot) ? {
    selectedRowKeys,
    onChange: (keys, rows) => {
      setSelectedRowKeys(keys);
      setSelectedRows(rows);
    }
  } : null;


  const columns = useMemo(() => {
    // Base columns that are always shown
    const baseColumns = [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        width: 300, // Fixed width for Name column
        ellipsis: true, // Add ellipsis for long names
        render: (name, record) => {
          if (record.type === 'directory') {
            return (
              <Space>
                <FolderOpenOutlined />
                <a onClick={() => handleFolderClick(record.name)}>{name}</a>
              </Space>
            );
          }
          return name;
        }
      },
      {
        title: 'Type',
        dataIndex: 'type',
        key: 'type',
        width: 80, // Reduced width for Type column
        render: (type) => (type === 'directory' ? 'Folder' : 'File')
      },
      {
        title: 'Size',
        dataIndex: 'formattedSize',
        key: 'size',
        width: 100, // Reduced width for Size column
        render: (size, record) => {
          if (record.type === 'directory') return '--';
          return size || formatFileSize(record.size) || 'Unknown';
        }
      }
    ];

    // If we're showing search results, add a Location column
    if (isSearching) {
      baseColumns.splice(1, 0, {
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
      });
    }

    // Add the Actions column
    baseColumns.push({
      title: 'Actions',
      key: 'actions',
      render: (record) => {
        // For search results, we need to adjust some actions
        const isSearchResult = isSearching;

        return (
          <Space>
            {record.type === 'file' && (
              <Tooltip title="View File">
                <Button
                  icon={<FileOutlined />}
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent row click event
                    if (isSearchResult) {
                      // For search results, we need to use the directory from the result
                      const encodedDir = encodeURIComponent(record.directory || '');
                      const encodedFile = encodeURIComponent(record.name.trim());
                      const previewUrl = `${BASE_URL}/preview?directory=${encodedDir}&filename=${encodedFile}`;
                      window.open(previewUrl, '_blank');
                    } else {
                      handleViewFile(record);
                    }
                  }}
                />
              </Tooltip>
            )}

            {record.type === 'file' && (
              <Tooltip title="Download">
                <Button
                  icon={<DownloadOutlined />}
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent row click event
                    if (isSearchResult) {
                      // For search results, we need to use the directory from the result
                      const encodedDir = encodeURIComponent(record.directory || '');
                      const encodedFile = encodeURIComponent(record.name.trim());
                      const downloadUrl = `${BASE_URL}/download?directory=${encodedDir}&filename=${encodedFile}`;
                      window.open(downloadUrl, '_blank');
                    } else {
                      handleDownload(record.name);
                    }
                  }}
                />
              </Tooltip>
            )}

            {record.type === 'directory' && (
              <Tooltip title="Download Folder">
                <Button icon={<DownloadOutlined />} onClick={(e) => {
                  e.stopPropagation(); // Prevent row click event
                  handleDownloadFolder(record.name);
                }} />
              </Tooltip>
            )}

            {!isSearchResult && !isRoot && !(record.type === 'directory' && isRoot) && (
              <>
                {/* Show action buttons for all folders and files except main folders */}
                {/* Check if it's not one of the main folders */}
                {!(record.type === 'directory' && (record.name === 'Research' || record.name === 'Training' || record.name === 'Operation')) && (
                  <>
                    <Tooltip title="Rename">
                      <Button
                        icon={<EditOutlined />}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row click event
                          setSelectedItem(record);
                          setRenameNewName(record.name);
                          setRenameModalVisible(true);
                        }}
                      />
                    </Tooltip>

                    <Tooltip title="Copy">
                      <Button icon={<CopyOutlined />} onClick={(e) => {
                        e.stopPropagation(); // Prevent row click event
                        handleCopy(record);
                      }} />
                    </Tooltip>

                    <Tooltip title="Move">
                      <Button icon={<SwapOutlined />} onClick={(e) => {
                        e.stopPropagation(); // Prevent row click event
                        handleMove(record);
                      }} />
                    </Tooltip>

                    <Tooltip title="Delete">
                      <Button danger icon={<DeleteOutlined />} onClick={(e) => {
                        e.stopPropagation(); // Prevent row click event
                        handleDelete(record);
                      }} />
                    </Tooltip>

                    {/* Show the more info button for all items */}
                    <Tooltip title="More Info">
                      <Button
                        icon={<MoreOutlined />}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row click event
                          setSelectedFileInfo(record);
                          setInfoModalVisible(true);
                        }}
                      />
                    </Tooltip>
                  </>
                )}
              </>
            )}
          </Space>
        );
      }
    });

    return baseColumns;
  }, [isSearching, currentPath]);

  const segments = getPathSegments(currentPath);
  const breadcrumbItems = [
    <Breadcrumb.Item key="root">
      {isRoot ? 'Root' : <a onClick={() => setCurrentPath('')}>Root</a>}
    </Breadcrumb.Item>
  ];
  segments.forEach((seg, index) => {
    breadcrumbItems.push(
      <Breadcrumb.Item key={index}>
        {index === segments.length - 1 ? seg : <a onClick={() => handleBreadcrumbClick(index)}>{seg}</a>}
      </Breadcrumb.Item>
    );
  });

  return (
    <Layout style={{ minHeight: '91vh', background: '#f0f2f5' }}>
      <Content style={{ margin: '24px', padding: '24px', background: '#fff' }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col flex="auto" style={{ textAlign: 'center' }}>
            <h2 style={{ margin: 0 }}></h2>
          </Col>
          <Col>
            <Button type="primary" icon={<UploadOutlined />} onClick={handleOpenUploadModal}>
              Upload File
            </Button>
          </Col>
        </Row>

        {segments.length > 0 && (
          <Row style={{ marginBottom: 16 }}>
            <Col>
              <Breadcrumb>{breadcrumbItems}</Breadcrumb>
            </Col>
          </Row>
        )}

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {!isRoot && !isSearching && (
            <Col>
              <Button icon={<ArrowUpOutlined />} onClick={handleGoUp}>
                Go Up
              </Button>
            </Col>
          )}
          {isSearching && (
            <Col>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => {
                  setSearchTerm('');
                  setIsSearching(false);
                }}
              >
                Back to Browsing
              </Button>
            </Col>
          )}
          {/* Only show the Create Folder button when inside a main folder (not at root level) */}
          {!isRoot && (
            <Col>
              <Button
                icon={<FolderAddOutlined />}
                onClick={() => setCreateFolderModal(true)}
                disabled={isSearching}
              >
                Create Folder
              </Button>
            </Col>
          )}
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
                ? "Search files..."
                : currentPath
                  ? `Search in ${currentPath}...`
                  : "Search files..."}
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
          {/* Only show the batch actions menu when inside a main folder (not at root level) */}
          {!isRoot && (
            <Col style={{ marginLeft: 'auto' }}>
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
            </Col>
          )}
        </Row>





        {selectionMode && selectedRows.length > 0 && (
          <SelectionHeader
            selectedItems={selectedRows}
            onDelete={handleBatchDelete}
            onCopy={handleBatchCopy}
            onMove={handleBatchMove}
            onDownload={handleBatchDownload}
            onCancelSelection={handleCancelSelection}
          />
        )}

        <Table
          className="action-buttons-table"
          columns={columns}
          dataSource={sortedItems}
          rowKey={(record) => `${record.type}-${record.id || record.name}`}
          loading={loading}
          pagination={false}
          scroll={{ y: '49vh' }}  // for content scrolling on table
          rowSelection={rowSelection}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { cursor: record.type === 'directory' ? 'pointer' : 'default' } // Only show pointer cursor for directories
          })}
        />

        {/* Use the CommonModals component for standard modals */}
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
          uploadingFiles={uploadingFile}
          setUploadingFiles={setUploadingFile}
          handleModalUpload={handleUpload}
          container=""
        />

        {/* File Information Modal */}
        <Modal
          title="File Information"
          open={infoModalVisible}
          onCancel={() => setInfoModalVisible(false)}
          footer={null}
        >
          {selectedFileInfo ? (
            <div>
              <p><strong>Name:</strong> {selectedFileInfo.name}</p>
              <p><strong>Type:</strong> {selectedFileInfo.type === 'directory' ? 'Folder' : 'File'}</p>
              <p><strong>Size:</strong> {selectedFileInfo.formattedSize || '--'}</p>
              <p><strong>Uploader:</strong> {selectedFileInfo.uploader || 'N/A'}</p>
              {selectedFileInfo.contentType && (
                <p><strong>Content Type:</strong> {selectedFileInfo.contentType}</p>
              )}
              {selectedFileInfo.id && (
                <p><strong>ID:</strong> {selectedFileInfo.id}</p>
              )}
            </div>
          ) : (
            <p>No information available</p>
          )}
        </Modal>

        {/* Custom Upload Modal with additional fields */}
        <Modal
          title="Upload File"
          open={uploadModalVisible}
          onCancel={() => setUploadModalVisible(false)}
          onOk={handleUpload}
        >
        <Dragger
          multiple
          fileList={uploadingFile}
          beforeUpload={(_, fileList) => {
            setUploadingFile(fileList);
            return false;
          }}

          showUploadList={{
            showRemoveIcon: true,
            removeIcon: <DeleteOutlined style={{ color: 'red' }} />, // You can style this
            showDownloadIcon: false,
            showPreviewIcon: false,
          }}

          onRemove={(file) => {
            setUploadingFile((prevList) =>
              prevList.filter((item) => item.uid !== file.uid)
            );
          }}

          customRequest={async ({ file, onProgress, onSuccess, onError }) => {
            const formData = new FormData();
            formData.append('file', file);
            const normalizedPath = currentPath.replace(/\\/g, '/');
            formData.append('directory', normalizedPath); // Normalize path
            formData.append('container', mainFolder || 'operation'); // Added container parameter

            if (fileUploadMessage.trim() && targetUsername.trim()) {
              formData.append('message', fileUploadMessage.trim());
              formData.append('receiver', targetUsername.trim());
            }

            try {
              await axios.post(`${BASE_URL}/upload`, formData, {
                withCredentials: true,
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (event) => {
                  onProgress({ percent: (event.loaded / event.total) * 100 });
                }
              });
              message.success(`${file.name} uploaded successfully`);
              onSuccess();
              fetchItems();
            } catch (err) {
              console.error('Upload error:', err);
              const errorMessage = err.response?.data?.error || `${file.name} upload failed`;
              message.error(errorMessage);
              onError(err);
            }
          }}

        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">Click or drag files here to upload</p>
          <p className="ant-upload-hint">Supports multiple files with progress tracking</p>
        </Dragger>
        <div style={{ marginTop: 8 }}>
        {Array.isArray(uploadingFile) && uploadingFile.map((_, i) => (
          <p key={i}></p>
        ))}

        </div>
        <Form.Item label="Instruction Template">
          <Select
            placeholder="Select a predefined message"
            allowClear
            onChange={(val) => setFileUploadMessage(val || '')}
            style={{ marginBottom: 8 }}
          >
            <Option value="Please review the file and provide feedback.">Request Review</Option>
            <Option value="Kindly make the necessary corrections.">Correction Request</Option>
            <Option value="This is urgent. Please address this today.">Urgent Task</Option>
            <Option value="No specific instruction. Just FYI.">FYI Only</Option>
          </Select>
        </Form.Item>

        <Form.Item label="Instruction (optional)">
          <Input.TextArea
            value={fileUploadMessage}
            onChange={(e) => setFileUploadMessage(e.target.value)}
            rows={3}
            placeholder="You can type a custom instruction or use a template above"
          />
        </Form.Item>

        <Form.Item
          label="Send to User"
          tooltip="Begin typing to search for a registered user"
          validateStatus={fileUploadMessage.trim() && !targetUsername ? 'error' : ''}
          help={fileUploadMessage.trim() && !targetUsername ? 'Please select a user when including a message.' : ''}
        >
          <UserSearchSelect
            value={targetUsername}
            onUserSelect={(value) => setTargetUsername(value)}
            required={!!fileUploadMessage.trim()}
          />
        </Form.Item>
        </Modal>
      </Content>
    </Layout>
  );
};

export default FileManager;
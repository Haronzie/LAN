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
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import path from 'path-browserify';
import debounce from 'lodash.debounce';

const { Content } = Layout;
const { Option } = Select;
const BASE_URL = `${window.location.protocol}//${window.location.hostname}:8081`;
axios.defaults.baseURL = BASE_URL;

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
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadingFile, setUploadingFile] = useState([]);
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
  const [folderTreeData, setFolderTreeData] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState('');
  const [targetUsername, setTargetUsername] = useState('');
  const [editingMetadataFile, setEditingMetadataFile] = useState(null);
const [metadataFields, setMetadataFields] = useState([{ key: '', value: '' }]);
const [metadataModalVisible, setMetadataModalVisible] = useState(false);
const [tagSearch, setTagSearch] = useState('');

  const navigate = useNavigate();
  const isRoot = currentPath === '';

  const generateSuggestedName = async (baseName, extension, destinationPath) => {
    try {
      const res = await axios.get('/directory/tree', { withCredentials: true });

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

  const fetchItems = async (tag = '') => {
    setLoading(true);
    try {
      const directoryParam = encodeURIComponent(currentPath);
      const tagParam = tag ? `&tag=${encodeURIComponent(tag)}` : '';
  
      const [filesRes, dirsRes] = await Promise.all([
        axios.get(`/files?directory=${directoryParam}${tagParam}`, { withCredentials: true }),
        axios.get(`/directory/list?directory=${directoryParam}`, { withCredentials: true })
      ]);
  
      const files = (filesRes.data || []).map((f) => ({
        name: f.name,
        type: 'file',
        size: f.size,
        formattedSize: formatFileSize(f.size),
        contentType: f.contentType,
        uploader: f.uploader,
        id: f.id
      }));
  
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
    const interval = setInterval(fetchItems, 10000);
    return () => clearInterval(interval);
  }, [currentPath]);

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

  const filteredItems = items.filter((item) =>
    (item.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      message.error('Folder name cannot be empty');
      return;
    }
    try {
      await axios.post(
        '/directory/create',
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
  
  const filteredTreeData = useMemo(() => {
    const disableCurrent = (nodes) => {
      return nodes.map((node) => ({
        ...node,
        disabled: node.value === currentPath,
        children: node.children ? disableCurrent(node.children) : []
      }));
    };
    return disableCurrent(folderTreeData);
  }, [folderTreeData, currentPath]);

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
  

  const handleUpload = async () => {
    if (!uploadingFile || uploadingFile.length === 0) {
      message.error('Please select files first');
      return;
    }
  
    if (fileUploadMessage.trim() && !targetUsername) {
      message.error('Please select a valid user to send the file to when including a message.');
      return;
    }
  
    const normalizedPath = currentPath.replace(/\\/g, '/');
  
    const existingFilesRes = await axios.get(`/files?directory=${encodeURIComponent(normalizedPath)}`, {
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
        formData.append('directory', normalizedPath); // ✅ updated
        if (overwrite) formData.append('overwrite', 'true');
        if (fileUploadMessage.trim() && targetUsername.trim()) {
          formData.append('message', fileUploadMessage.trim());
          formData.append('receiver', targetUsername.trim());
        }
  
        try {
          await axios.post('/upload', formData, {
            withCredentials: true,
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          message.success(`${file.name} uploaded`);
        } catch (error) {
          console.error('Upload failed:', error);
          message.error(`Upload failed for ${file.name}`);
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
      formData.append('container', normalizedPath.split('/')[0] || 'operation'); // ✅ updated
      formData.append('overwrite', 'false');
      formData.append('skip', 'false');
      if (fileUploadMessage.trim() && targetUsername.trim()) {
        formData.append('message', fileUploadMessage.trim());
        formData.append('receiver', targetUsername.trim());
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
  
        message.success(`${uploaded} uploaded, ${skipped} skipped, ${failed} failed`);
      } catch (error) {
        console.error('Bulk upload failed:', error);
        message.error('Bulk upload failed');
      }
    }
  
    setUploadModalVisible(false);
    setUploadingFile([]);
    setFileUploadMessage('');
    setTargetUsername('');
    fetchItems();
  };
  
  
  
  const uploadFile = async (formData, isOverwrite) => {
    try {
      const res = await axios.post('/upload', formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
  
      const { message: uploadMsg, file_id } = res.data;
  
      if (fileUploadMessage.trim() && targetUsername.trim()) {
        try {
          await axios.post('/file/message', {
            file_id,
            receiver: targetUsername.trim(),
            message: fileUploadMessage.trim()
          }, { withCredentials: true });
  
          message.success(`Message sent to ${targetUsername}`);
        } catch (msgErr) {
          console.error('Message upload failed:', msgErr);
          message.error('Failed to send message to user');
        }
      }
  
      message.success(uploadMsg || 'File uploaded');
      setUploadModalVisible(false);
      setUploadingFile(null);
      setFileUploadMessage('');
      setTargetUsername('');
      fetchItems();
    } catch (error) {
      console.error('Upload failed:', error);
      message.error(error.response?.data?.error || 'Upload error');
    }
  };

  const handleDelete = async (record) => {
    try {
      if (record.type === 'directory') {
        await axios.delete('/directory/delete', {
          data: { name: record.name, parent: currentPath },
          withCredentials: true
        });
      } else {
        await axios.delete('/delete-file', {
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
            parent: currentPath
          },
          { withCredentials: true }
        );
        fetchFolderTree();
      } else {
        await axios.put(
          '/file/rename',
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
        await axios.post('/directory/copy', {
          source_name: copyItem.name,
          source_parent: currentPath,
          new_name: copyNewName,
          destination_parent: targetDir
        }, { withCredentials: true });
  
        message.success(`Directory '${copyItem.name}' copied as '${copyNewName}'`);
        fetchFolderTree();
  
      } else {
        const res = await axios.post('/copy-file', {
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

  const handleMove = (record) => {
    setMoveItem(record);
    setMoveDestination('');
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
        const res = await axios.get(`/files?directory=${encodeURIComponent(moveDestination)}`, {
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
          '/directory/move',
          {
            name: moveItem.name,
            old_parent: currentPath,
            new_parent: moveDestination
          },
          { withCredentials: true }
        );
      } else {
        await axios.post(
          '/move-file',
          {
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
      message.error(err.response?.data?.error || 'Error moving item');
    }
  };
  

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
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
      render: (type) => (type === 'directory' ? 'Folder' : 'File')
    },
    {
      title: 'Size',
      dataIndex: 'formattedSize',
      key: 'size',
      render: (size, record) => (record.type === 'directory' ? '--' : size)
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record) => {
        return (
          <Space>
            {record.type === 'file' && (
              <Tooltip title="View File">
                <Button icon={<FileOutlined />} onClick={() => handleViewFile(record)} />
              </Tooltip>
            )}
  
            {record.type === 'file' && (
              <Tooltip title="Download">
                <Button icon={<DownloadOutlined />} onClick={() => handleDownload(record.name)} />
              </Tooltip>
            )}
            {record.type === 'directory' && (
              <Tooltip title="Download Folder">
                <Button icon={<DownloadOutlined />} onClick={() => handleDownloadFolder(record.name)} />
              </Tooltip>
            )}
  
            {/* ✅ NEW: Edit Metadata */}
            {record.type === 'file' && (
              <Tooltip title="Edit Metadata">
                <Button
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditingMetadataFile(record);
                    setMetadataFields([{ key: '', value: '' }]);
                    setMetadataModalVisible(true);
                  }}
                />
              </Tooltip>
            )}
  
            <Tooltip title="Rename">
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  setSelectedItem(record);
                  setRenameNewName(record.name);
                  setRenameModalVisible(true);
                }}
              />
            </Tooltip>
  
            <Tooltip title="Copy">
              <Button icon={<CopyOutlined />} onClick={() => handleCopy(record)} />
            </Tooltip>
  
            <Tooltip title="Move">
              <Button icon={<SwapOutlined />} onClick={() => handleMove(record)} />
            </Tooltip>
  
            <Tooltip title="Delete">
              <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
            </Tooltip>
          </Space>
        );
      }
    }
  ];
  

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
            <h2 style={{ margin: 0 }}>File Manager</h2>
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
  {!isRoot && (
    <Col>
      <Button icon={<ArrowUpOutlined />} onClick={handleGoUp}>
        Go Up
      </Button>
    </Col>
  )}
  <Col>
    <Button icon={<FolderAddOutlined />} onClick={() => setCreateFolderModal(true)}>
      Create Folder
    </Button>
  </Col>
  <Col>
    <Input
      placeholder="Search..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      allowClear
    />
  </Col>
  <Col>
    <Input
      placeholder="Search by tag..."
      value={tagSearch}
      onChange={(e) => {
        const newTag = e.target.value.trim();
        setTagSearch(newTag);
        fetchItems(newTag); // ✅ call backend with tag
      }}
      allowClear
    />
  </Col>
</Row>


        <Table
          columns={columns}
          dataSource={filteredItems}
          rowKey={(record) => record.id || record.name + record.type}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />

        <Modal
          title="Create New Folder"
          visible={createFolderModal}
          onOk={handleCreateFolder}
          onCancel={() => setCreateFolderModal(false)}
          okText="Create"
        >
          <Form layout="vertical">
            <Form.Item label="Folder Name" required>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Reports2025"
              />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="Rename Item"
          visible={renameModalVisible}
          onOk={handleRenameConfirm}
          onCancel={() => setRenameModalVisible(false)}
          okText="Rename"
        >
          <Form layout="vertical">
            <Form.Item label="New Name" required>
              <Input
                value={renameNewName}
                onChange={(e) => setRenameNewName(e.target.value)}
                placeholder="Enter new name"
              />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="Upload File"
          visible={uploadModalVisible}
          onCancel={() => setUploadModalVisible(false)}
          onOk={handleUpload}
        >
         <Dragger
  multiple
  fileList={uploadingFile}
  beforeUpload={(file, fileList) => {
    setUploadingFile(fileList);
    return false;
  }}
  showUploadList={false}
  customRequest={async ({ file, onProgress, onSuccess, onError }) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('directory', currentPath.replace(/\\/g, '/')); // ✅ Normalize path
  
    if (fileUploadMessage.trim() && targetUsername.trim()) {
      formData.append('message', fileUploadMessage.trim());
      formData.append('receiver', targetUsername.trim());
    }
  
    try {
      await axios.post('/upload', formData, {
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
      message.error(`${file.name} upload failed`);
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
{Array.isArray(uploadingFile) && uploadingFile.map((file, i) => (
  <p key={i}>Selected: {file.name}</p>
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

        <Modal
          title="Copy Item"
          visible={copyModalVisible}
          onOk={handleCopyConfirm}
          onCancel={() => setCopyModalVisible(false)}
          okText="Copy"
        >
          <Form layout="vertical">
            <Form.Item label="New Name" required>
              <Input
                value={copyNewName}
                onChange={(e) => setCopyNewName(e.target.value)}
                placeholder="Enter new name"
              />
            </Form.Item>
            <Form.Item label="Destination Folder (Optional)">
              <TreeSelect
                style={{ width: '100%' }}
                treeData={folderTreeData}
                placeholder="Select folder or leave blank"
                value={selectedDestination}
                onChange={(val) => setSelectedDestination(val)}
                treeDefaultExpandAll
                allowClear
              />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
  title="Move Item"
  visible={moveModalVisible}
  onOk={handleMoveConfirm}
  onCancel={() => setMoveModalVisible(false)}
  okText="Move"
>
  <Form layout="vertical">
    <Form.Item label="Destination Folder" required>
      <TreeSelect
        style={{ width: '100%' }}
        treeData={filteredTreeData}
        placeholder="Select destination folder"
        value={moveDestination}
        onChange={(val) => setMoveDestination(val)}
        treeDefaultExpandAll
        allowClear
      />
    </Form.Item>
  </Form>
</Modal>

{/* ✅ Insert this new modal here */}
<Modal
  title={`Edit Metadata for ${editingMetadataFile?.name}`}
  visible={metadataModalVisible}
  onCancel={() => setMetadataModalVisible(false)}
  onOk={async () => {
    const metadata = {};
    metadataFields.forEach(({ key, value }) => {
      if (key.trim()) metadata[key.trim()] = value;
    });
    try {
      await axios.put(`/file/${editingMetadataFile.id}/metadata`, metadata, {
        withCredentials: true,
      });
      message.success("Metadata updated!");
      setMetadataModalVisible(false);
      fetchItems();
    } catch (err) {
      message.error("Update failed");
    }
  }}
>
  {metadataFields.map((field, idx) => (
    <Space key={idx} style={{ display: 'flex', marginBottom: 8 }} align="start">
      <Input
        placeholder="Key"
        value={field.key}
        onChange={(e) => {
          const newFields = [...metadataFields];
          newFields[idx].key = e.target.value;
          setMetadataFields(newFields);
        }}
      />
      <Input
        placeholder="Value"
        value={field.value}
        onChange={(e) => {
          const newFields = [...metadataFields];
          newFields[idx].value = e.target.value;
          setMetadataFields(newFields);
        }}
      />
      <Button danger onClick={() => {
        const newFields = metadataFields.filter((_, i) => i !== idx);
        setMetadataFields(newFields);
      }}>
        Remove
      </Button>
    </Space>
  ))}
  <Button type="dashed" block onClick={() => setMetadataFields([...metadataFields, { key: '', value: '' }])}>
    + Add Field
  </Button>
</Modal>


      </Content>
    </Layout>
  );
};

export default FileManager;
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
  Card,
  Breadcrumb,
  Upload,
  TreeSelect,
  Checkbox,
  Select,
  Spin
} from 'antd';
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
  FileOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import path from 'path-browserify';
import debounce from 'lodash.debounce';

const { Content } = Layout;
const { Option } = Select;
const BASE_URL = process.env.REACT_APP_BACKEND_URL;


// Professional Searchable Dropdown Component for Grant/Revoke access
// Professional Searchable Dropdown Component for Grant/Revoke access
const UserSearchSelect = ({ value, onUserSelect }) => {
  const [options, setOptions] = useState([]);
  const [fetching, setFetching] = useState(false);

  // Debounced search function to reduce API calls
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
        // Assuming the endpoint returns an array of user objects with a 'username' property.
        setOptions(response.data || []);
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
    >
      {options.map((user) => (
        <Option key={user.username} value={user.username}>
          {user.username}
        </Option>
      ))}
    </Select>
  );
};


// Helper: split a path like "Folder/Subfolder" into segments
function getPathSegments(p) {
  if (!p) return [];
  return p.split('/').filter(Boolean);
}

// Convert file size to human-readable format
function formatFileSize(size) {
  if (size === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(size) / Math.log(1024));
  return (size / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
}

const FileManager = () => {
  const [items, setItems] = useState([]); // files + directories
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState(''); // "" = root
  const [searchTerm, setSearchTerm] = useState('');

  // Create folder modal
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Upload modal states
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [uploadConfidential, setUploadConfidential] = useState(false);

  // Rename modal
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [renameNewName, setRenameNewName] = useState('');

  // Copy modal
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [copyNewName, setCopyNewName] = useState('');
  const [copyItem, setCopyItem] = useState(null);

  // Move modal
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [moveDestination, setMoveDestination] = useState('');
  const [moveItem, setMoveItem] = useState(null);
  const [moveConfidential, setMoveConfidential] = useState(false);

  // Folder tree for optional destination selection
  const [folderTreeData, setFolderTreeData] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState('');

  // Grant/Revoke state
  const [grantModalVisible, setGrantModalVisible] = useState(false);
  const [revokeModalVisible, setRevokeModalVisible] = useState(false);
  const [accessFile, setAccessFile] = useState(null);
  const [targetUsername, setTargetUsername] = useState('');

  // Track current user & admin status
  const [currentUser, setCurrentUser] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  // On mount, read username & role from localStorage
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    const storedRole = localStorage.getItem('role');
    if (storedUsername) setCurrentUser(storedUsername);
    if (storedRole === 'admin') setIsAdmin(true)
  }, []);

  const navigate = useNavigate();
  const isRoot = currentPath === '';

  // Grant / Revoke Handlers
  const openGrantModal = (file) => {
    setAccessFile(file);
    setTargetUsername('');
    setGrantModalVisible(true);
  };

  const openRevokeModal = (file) => {
    setAccessFile(file);
    setTargetUsername('');
    setRevokeModalVisible(true);
  };

  const handleGrantAccess = async () => {
    if (!targetUsername) {
      message.error('Please select a user to grant access.');
      return;
    }
    if (!accessFile || !accessFile.id) {
      message.error('No file selected.');
      return;
    }
    try {
      await axios.post(
        '/grant-access',
        { file_id: accessFile.id, target_user: targetUsername },
        { withCredentials: true }
      );
      message.success(`Access granted to '${targetUsername}'`);
      setGrantModalVisible(false);
      setTargetUsername(''); // Reset targetUsername
      fetchItems();
    } catch (error) {
      console.error('Grant Access error:', error);
      message.error(error.response?.data?.error || 'Error granting access');
    } finally {
      setTargetUsername(''); // Ensure the input is cleared
    }
  };

  const handleRevokeAccess = async () => {
    if (!targetUsername) {
      message.error('Please select a user to revoke access.');
      return;
    }
    if (!accessFile || !accessFile.id) {
      message.error('No file selected.');
      return;
    }
    try {
      await axios.post(
        '/revoke-access',
        { file_id: accessFile.id, target_user: targetUsername },
        { withCredentials: true }
      );
      message.success(`Access revoked from '${targetUsername}'`);
      setRevokeModalVisible(false);
      setTargetUsername(''); // Reset targetUsername
      fetchItems();
    } catch (error) {
      console.error('Revoke Access error:', error);
      message.error(error.response?.data?.error || 'Error revoking access');
    } finally {
      setTargetUsername(''); // Ensure the input is cleared
    }
  };

  // Fetch items for the current folder
  const fetchItems = async () => {
    setLoading(true);
    try {
      const directoryParam = encodeURIComponent(currentPath);
      const [filesRes, dirsRes] = await Promise.all([
        axios.get(`/files?directory=${directoryParam}`, { withCredentials: true }),
        axios.get(`/directory/list?directory=${directoryParam}`, { withCredentials: true })
      ]);

      const files = (filesRes.data || []).map((f) => ({
        name: f.name,
        type: 'file',
        size: f.size,
        formattedSize: formatFileSize(f.size),
        contentType: f.contentType,
        uploader: f.uploader,
        confidential: f.confidential,
        id: f.id
      }));

      const directories = dirsRes.data || [];
      setItems([...directories, ...files]);
    } catch (error) {
      console.error('Error fetching items:', error);
      message.error(error.response?.data?.error || 'Error fetching directory contents');
    } finally {
      setLoading(false);
    }
  };

  // Fetch entire folder tree on mount
  const fetchFolderTree = async () => {
    try {
      const res = await axios.get('/directory/tree', { withCredentials: true });
      setFolderTreeData(res.data || []);
    } catch (error) {
      console.error('Error fetching folder tree:', error);
    }
  };

  useEffect(() => {
    fetchFolderTree();
  }, []);

  // Reload items when currentPath changes
  useEffect(() => {
    fetchItems();
  }, [currentPath]);

  // Optional polling every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchItems, 10000);
    return () => clearInterval(interval);
  }, [currentPath]);

  // Filter items by search term
  const filteredItems = items.filter((item) =>
    (item.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Create folder
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

  // Folder navigation
  const handleFolderClick = (folderName) => {
    const newPath = isRoot ? folderName : path.join(currentPath, folderName);
    setCurrentPath(newPath);
  };

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

  // Upload handling
  const handleOpenUploadModal = () => {
    if (isRoot) {
      message.error('Please select an existing folder before uploading a file.');
      return;
    }
    setUploadingFile(null);
    setUploadConfidential(false);
    setUploadModalVisible(true);
  };

  const doUpload = async (isConfidential) => {
    const formData = new FormData();
    if (!uploadingFile) {
      message.error('Please select a file first');
      return;
    }
    formData.append('file', uploadingFile);
    formData.append('directory', currentPath);
    formData.append('confidential', isConfidential ? 'true' : 'false');

    try {
      const res = await axios.post('/upload', formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success(res.data.message || 'File uploaded successfully');
      setUploadModalVisible(false);
      setUploadingFile(null);
      setUploadConfidential(false);
      fetchItems();
    } catch (error) {
      console.error('Upload error:', error);
      message.error(error.response?.data?.error || 'Error uploading file');
    }
  };

  const handleUpload = async () => {
    if (!uploadingFile) {
      message.error('Please select a file first');
      return;
    }
    if (!currentPath) {
      message.error('Please select a folder first');
      return;
    }
    if (!uploadConfidential) {
      Modal.confirm({
        title: 'Upload as non-confidential?',
        content: 'Are you sure you want to upload this file without marking it as confidential?',
        onOk: () => doUpload(false)
      });
    } else {
      doUpload(true);
    }
  };

  // Delete file or folder
  const handleDelete = async (record) => {
    try {
      if (record.type === 'directory') {
        await axios.delete('/directory/delete', {
          data: { name: record.name, parent: currentPath },
          withCredentials: true
        });
      } else {
        await axios.delete('/delete-file', {
          data: { filename: record.name },
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

  // Download file or folder
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
  

  // Rename
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

  // Copy
  const handleCopy = async (record) => {
    try {
      const targetDir = selectedDestination || currentPath;
  
      const res = await axios.get(`/files?directory=${encodeURIComponent(targetDir)}`, {
        withCredentials: true
      });
  
      // ✅ Safely check if res.data is an array
      const existingNames = Array.isArray(res.data) ? res.data.map((f) => f.name) : [];
  
      const name = record.name;
      const ext = record.type === 'file' ? path.extname(name) : '';
      const base = record.type === 'file' ? path.basename(name, ext) : name;
  
      let suggestedName = name;
  
      if (existingNames.includes(name)) {
        let attempt = 1;
        while (existingNames.includes(`${base} (${attempt})${ext}`)) {
          attempt++;
        }
        suggestedName = `${base} (${attempt})${ext}`;
      }
  
      setCopyItem(record);
      setCopyNewName(suggestedName);
      setCopyModalVisible(true);
    } catch (err) {
      console.error('Error checking copy conflicts:', err);
      const errorMsg = err.response?.data?.error || 'Failed to check for file conflict. Target folder might be missing or empty.';
      message.error(errorMsg);
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
    try {
      if (copyItem.type === 'directory') {
        await axios.post('/directory/copy', {
          source_name: copyItem.name,
          source_parent: currentPath,
          new_name: copyNewName,
          destination_parent: selectedDestination || currentPath
        }, { withCredentials: true });
      } else {
        await axios.post('/copy-file', {
          source_file: copyItem.name,
          new_file_name: copyNewName,
          destination_folder: selectedDestination || currentPath
        }, { withCredentials: true });
      }
      message.success(`Copied '${copyItem.name}' to '${copyNewName}' successfully`);
      setCopyModalVisible(false);
      setCopyItem(null);
      setCopyNewName('');
      fetchItems();
      if (copyItem.type === 'directory') fetchFolderTree();
    } catch (err) {
      console.error('Copy error:', err);
      message.error(err.response?.data?.error || 'Error copying file');
    }
  };


  const handleMove = async (record) => {
    const destination = currentPath;
    const filename = record.name;
  
    try {
      const res = await axios.get(`/files?directory=${encodeURIComponent(destination)}`, {
        withCredentials: true
      });
  
      const existingNames = res.data.map(f => f.name);
      const nameExists = existingNames.includes(filename);
  
      if (nameExists) {
        Modal.confirm({
          title: `A file named '${filename}' already exists.`,
          content: 'Do you want to overwrite the existing file or keep both?',
          okText: 'Keep Both',
          cancelText: 'Cancel',
          onOk: () => {
            setMoveItem(record);
            setMoveDestination(destination);
            setMoveModalVisible(true); // Let backend rename it with (1)
          },
          onCancel: () => {
            message.info('Move cancelled.');
          },
          okButtonProps: { type: 'primary' },
          cancelButtonProps: { danger: true }
        });
  
        Modal.info({
          title: 'Overwrite Option',
          content: (
            <div>
              <p>Or click below to force overwrite the file instead of keeping both.</p>
              <Button
                type="danger"
                onClick={async () => {
                  try {
                    await axios.post('/move-file', {
                      filename,
                      old_parent: currentPath,
                      new_parent: destination,
                      overwrite: true
                    }, { withCredentials: true });
                    message.success(`File '${filename}' overwritten.`);
                    fetchItems();
                  } catch (err) {
                    console.error('Overwrite error:', err);
                    message.error('Failed to overwrite file.');
                  }
                }}
              >
                Overwrite Anyway
              </Button>
            </div>
          ),
          okText: 'Close',
        });
  
      } else {
        setMoveItem(record);
        setMoveDestination(destination);
        setMoveModalVisible(true);
      }
    } catch (err) {
      console.error('Move check error:', err);
      message.error('Error checking file conflict');
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
            overwrite: false, // default: do not overwrite, use Windows-style rename
            confidential: moveConfidential
          },
          { withCredentials: true }
        );
      }
  
      message.success(`Moved '${moveItem.name}' successfully`);
      setMoveModalVisible(false);
      setMoveDestination('');
      setMoveItem(null);
      fetchItems();
      if (moveItem.type === 'directory') {
        fetchFolderTree();
      }
    } catch (error) {
      console.error('Move error:', error);
      message.error(error.response?.data?.error || 'Error moving item');
    }
  };
  

  // Table columns
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
        const isOwner = record.uploader === currentUser;

        const canManageAccess =
          record.type === 'file' &&
          record.confidential &&
          (isOwner || isAdmin);

        return (
          <Space>
            {/* View File */}
            {record.type === 'file' && (
              <Tooltip title="View File">
                <Button icon={<FileOutlined />} onClick={() => handleViewFile(record)} />
              </Tooltip>
            )}

            {/* Download */}
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

            {/* Rename */}
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

            {/* Copy */}
            <Tooltip title="Copy">
              <Button icon={<CopyOutlined />} onClick={() => handleCopy(record)} />
            </Tooltip>

            {/* Move */}
            <Tooltip title="Move">
              <Button icon={<SwapOutlined />} onClick={() => handleMove(record)} />
            </Tooltip>

            {/* Delete */}
            <Tooltip title="Delete">
              <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
            </Tooltip>

            {/* Grant Access */}
            {canManageAccess && (
              <Tooltip title="Grant Access">
                <Button onClick={() => openGrantModal(record)}>Grant</Button>
              </Tooltip>
            )}

            {/* Revoke Access */}
            {canManageAccess && (
              <Tooltip title="Revoke Access">
                <Button onClick={() => openRevokeModal(record)}>Revoke</Button>
              </Tooltip>
            )}
          </Space>
        );
      }
    }
  ];

  // Breadcrumb
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
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content style={{ margin: '24px', padding: '24px', background: '#fff' }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col xs={8} style={{ textAlign: 'left' }}>
            <Button type="primary" icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin')}>
              Back to Dashboard
            </Button>
          </Col>
          <Col xs={8} style={{ textAlign: 'center' }}>
            <h2 style={{ margin: 0 }}>File Manager</h2>
          </Col>
          <Col xs={8} style={{ textAlign: 'right' }}>
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
        </Row>

        <Table
          columns={columns}
          dataSource={filteredItems}
          rowKey={(record) => record.id || record.name + record.type}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />

        {/* Create Folder Modal */}
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

        {/* Rename Modal */}
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

        {/* Upload Modal */}
        <Modal
          title="Upload File"
          visible={uploadModalVisible}
          onOk={handleUpload}
          onCancel={() => {
            setUploadModalVisible(false);
            setUploadingFile(null);
            setUploadConfidential(false);
          }}
          okText="Upload"
        >
          <p>Target Folder: {currentPath || 'None (Please create a folder first)'}</p>
          <Upload
            beforeUpload={(file) => {
              setUploadingFile(file);
              return false;
            }}
            maxCount={1}
          >
            <Button icon={<UploadOutlined />}>Select File</Button>
          </Upload>
          {uploadingFile && (
            <Card size="small" style={{ marginTop: 16 }}>
              <strong>Selected File:</strong> {uploadingFile.name}
            </Card>
          )}
          <Form layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item label="Mark as Confidential?">
              <Checkbox
                checked={uploadConfidential}
                onChange={(e) => setUploadConfidential(e.target.checked)}
              >
                Confidential
              </Checkbox>
            </Form.Item>
          </Form>
        </Modal>

        {/* Copy Modal */}
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

        {/* Move Modal */}
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
                treeData={folderTreeData}
                placeholder="Select destination folder"
                value={moveDestination}
                onChange={(val) => setMoveDestination(val)}
                treeDefaultExpandAll
                allowClear
              />
            </Form.Item>
            {moveItem && moveItem.type === 'file' && (
              <Form.Item label="Confidential">
                <Checkbox
                  checked={moveConfidential}
                  onChange={(e) => setMoveConfidential(e.target.checked)}
                />
              </Form.Item>
            )}
          </Form>
        </Modal>

        {/* Grant Access Modal with Professional Searchable Dropdown */}
        <Modal
  title="Grant Access"
  visible={grantModalVisible}
  onOk={handleGrantAccess}
  onCancel={() => setGrantModalVisible(false)}
  okText="Grant Access"
>
  <Form layout="vertical">
    <Form.Item
      label="Select User to Grant Access"
      required
      tooltip="Begin typing to search for a username"
    >
      <UserSearchSelect 
        value={targetUsername}
        onUserSelect={(value) => setTargetUsername(value)} 
      />
    </Form.Item>
  </Form>
</Modal>


        {/* Revoke Access Modal with Professional Searchable Dropdown */}
        <Modal
  title="Revoke Access"
  visible={revokeModalVisible}
  onOk={handleRevokeAccess}
  onCancel={() => setRevokeModalVisible(false)}
  okText="Revoke Access"
>
  <Form layout="vertical">
    <Form.Item
      label="Select User to Revoke Access"
      required
      tooltip="Begin typing to search for a username"
    >
      <UserSearchSelect 
        value={targetUsername}
        onUserSelect={(value) => setTargetUsername(value)} 
      />
    </Form.Item>
  </Form>
</Modal>

      </Content>
    </Layout>
  );
};

export default FileManager;

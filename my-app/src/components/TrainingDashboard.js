import React, { useState, useEffect } from 'react';
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
  Spin
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
  FileOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import path from 'path-browserify';

const { Content } = Layout;
const { Option } = Select;

/**
 * Helper to format file sizes in human-readable form.
 */
function formatFileSize(size) {
  if (size === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(size) / Math.log(1024));
  return (size / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
}

const TrainingDashboard = () => {
  const navigate = useNavigate();

  // Current user and role states
  const [currentUser, setCurrentUser] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

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
  }, []);

  // ----------------------------------
  // States: path, items, loading, search, etc.
  // ----------------------------------
  const [currentPath, setCurrentPath] = useState('Training');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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

  // Directory tree for moving files/folders
  const [directories, setDirectories] = useState([]);

  // Upload Modal states
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [uploadConfidential, setUploadConfidential] = useState(false);

  // Grant/Revoke State
  const [grantModalVisible, setGrantModalVisible] = useState(false);
  const [revokeModalVisible, setRevokeModalVisible] = useState(false);
  const [accessFile, setAccessFile] = useState(null);
  const [targetUsername, setTargetUsername] = useState('');
  const [userOptions, setUserOptions] = useState([]); // Store fetched user options
  const [fetchingUsers, setFetchingUsers] = useState(false); // Loading state for user search

  // Function to handle user search
  const handleUserSearch = async (value) => {
    if (!value) {
      setUserOptions([]);
      return;
    }
    setFetchingUsers(true);
    try {
      const response = await axios.get(`/users/fetch?search=${value}`, { withCredentials: true });
      setUserOptions(response.data || []); // Assuming API returns an array of users
    } catch (error) {
      console.error('Error fetching users:', error);
      message.error('Failed to fetch users');
    } finally {
      setFetchingUsers(false);
    }
  };

  // Grant Access
  const handleGrantAccess = async () => {
    if (!targetUsername.trim()) {
      message.error('Username cannot be empty');
      return;
    }
    if (!accessFile || !accessFile.id) {
      message.error('No file selected');
      return;
    }
    try {
      await axios.post(
        '/grant-access',
        {
          file_id: accessFile.id,
          target_user: targetUsername,
        },
        { withCredentials: true }
      );
      message.success(`Access granted to '${targetUsername}'`);
      setGrantModalVisible(false);
      setTargetUsername('');
      fetchItems(); // Refresh the list to reflect updated permissions
    } catch (error) {
      console.error('Grant Access error:', error);
      message.error(error.response?.data?.error || 'Error granting access');
    }
  };

  // Revoke Access
  const handleRevokeAccess = async () => {
    if (!targetUsername.trim()) {
      message.error('Username cannot be empty');
      return;
    }
    if (!accessFile || !accessFile.id) {
      message.error('No file selected');
      return;
    }
    try {
      await axios.post(
        '/revoke-access',
        {
          file_id: accessFile.id,
          target_user: targetUsername,
        },
        { withCredentials: true }
      );
      message.success(`Access revoked from '${targetUsername}'`);
      setRevokeModalVisible(false);
      setTargetUsername('');
      fetchItems(); // Refresh the list to reflect updated permissions
    } catch (error) {
      console.error('Revoke Access error:', error);
      message.error(error.response?.data?.error || 'Error revoking access');
    }
  };

  // ----------------------------------
  // Confidential file access check
  // ----------------------------------
  const checkFileAccess = (record) => {
    if (record.type !== 'file') return true;
    return (
      !record.confidential ||
      record.uploader === currentUser ||
      isAdmin ||
      (record.authorizedUsers && record.authorizedUsers.includes(currentUser))
    );
  };

  // ----------------------------------
  // Fetch Directories
  // ----------------------------------
  const fetchDirectories = async () => {
    try {
      const res = await axios.get('/directory/tree?container=training', { withCredentials: true });
      setDirectories(res.data || []);
    } catch (error) {
      console.error('Error fetching directories:', error);
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
      const dirRes = await axios.get(`/directory/list?directory=${dirParam}`, {
        withCredentials: true
      });
      const fetchedDirs = Array.isArray(dirRes.data) ? dirRes.data : [];

      // 2) Fetch files (including confidential flag and authorizedUsers if available)
      const fileRes = await axios.get(`/files?directory=${dirParam}`, {
        withCredentials: true
      });
      const fetchedFiles = (fileRes.data || []).map((f) => ({
        id: f.id,
        name: f.name,
        type: 'file',
        size: f.size,
        formattedSize: formatFileSize(f.size),
        uploader: f.uploader,
        confidential: f.confidential,
        authorizedUsers: f.permissions ? f.permissions.map(p => p.username) : []
      }));

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
    // eslint-disable-next-line
  }, [currentPath]);

  // Filter by search term
  const filteredItems = items
  .filter(checkFileAccess)
  .filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );


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
    const parent = path.dirname(currentPath);
    setCurrentPath(parent === '.' ? 'Training' : parent);
  };
  

  const getPathSegments = (p) => (p ? p.split('/').filter(Boolean) : []);
const segments = getPathSegments(currentPath);
const breadcrumbItems = [
  <Breadcrumb.Item key="root">
    {currentPath === 'Training' ? 'Training' : <a onClick={() => setCurrentPath('Training')}>Training</a>}
  </Breadcrumb.Item>,
];

segments.slice(1).forEach((seg, index) => {
  const partialPath = segments.slice(0, index + 2).join('/');
  const validPartial = partialPath.startsWith('Training') ? partialPath : path.join('Training', partialPath);
  const isLast = index === segments.length - 2;

  breadcrumbItems.push(
    <Breadcrumb.Item key={index}>
      {isLast ? seg : <a onClick={() => setCurrentPath(validPartial)}>{seg}</a>}
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
    setUploadingFile(null);
    setUploadConfidential(false);
    setUploadModalVisible(true);
  };

  const doModalUpload = async (isConfidential) => {
    if (!uploadingFile) {
      message.error('Please select a file first');
      return;
    }
    if (!currentPath) {
      message.error('Please select or create a folder first');
      return;
    }
    const formData = new FormData();
    formData.append('file', uploadingFile);
    formData.append('directory', currentPath);
    formData.append('confidential', isConfidential ? 'true' : 'false');
    formData.append('container', 'training');

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
      console.error('Modal-based upload error:', error);
      message.error(error.response?.data?.error || 'Error uploading file');
    }
  };

  const handleModalUpload = () => {
    if (!uploadConfidential) {
      Modal.confirm({
        title: 'Upload as non-confidential?',
        content: 'Are you sure you want to upload this file without marking it as confidential?',
        onOk: () => doModalUpload(false)
      });
    } else {
      doModalUpload(true);
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
        await axios.delete('/directory/delete', {
          data: { name: record.name, parent: currentPath, container: 'training' },
          withCredentials: true
        });
      } else {
        await axios.delete('/delete-file', {
          data: { directory: currentPath, filename: record.name, container: 'training' },
          withCredentials: true
        });
      }
      message.success(`${record.name} deleted successfully`);
      fetchItems();
    } catch (error) {
      console.error('Delete error:', error);
      message.error(error.response?.data?.error || 'Error deleting item');
    }
  };

  // ----------------------------------
  // Download
  // ----------------------------------
  const handleDownload = (fileName) => {
    const downloadUrl = `http://localhost:8080/download?filename=${encodeURIComponent(fileName)}`;
    window.open(downloadUrl, '_blank');
  };

  const handleDownloadFolder = (folderName) => {
    const folderPath = path.join(currentPath, folderName);
    const downloadUrl = `http://localhost:8080/download-folder?directory=${encodeURIComponent(folderPath)}`;
    window.open(downloadUrl, '_blank');
  };

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
    const suggestedName = record.name + '_copy';
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
      if (copyItem.type === 'directory') {
        await axios.post(
          '/directory/copy',
          {
            source_name: copyItem.name,
            source_parent: currentPath,
            new_name: copyNewName,
            destination_parent: selectedDestination || currentPath,
            container: 'training'
          },
          { withCredentials: true }
        );
      } else {
        await axios.post(
          '/copy-file',
          {
            source_file: copyItem.name,
            new_file_name: copyNewName,
            destination_folder: selectedDestination || currentPath,
            container: 'training'
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

  // ----------------------------------
  // Move
  // ----------------------------------
  const handleMove = (record) => {
    const isOwner =
      record.type === 'directory'
        ? record.created_by === currentUser
        : record.uploader === currentUser;
    if (!isOwner) {
      message.error('Only the owner can move this item.');
      return;
    }
    setMoveItem(record);
    setMoveDestination(currentPath);
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
      if (moveItem.type === 'directory') {
        await axios.post(
          '/directory/move',
          {
            name: moveItem.name,
            old_parent: currentPath,
            new_parent: moveDestination,
            container: 'training'
          },
          { withCredentials: true }
        );
      } else {
        await axios.post(
          '/file/move',
          {
            filename: moveItem.name,
            old_parent: currentPath,
            new_parent: moveDestination,
            container: 'training'
          },
          { withCredentials: true }
        );
      }
      message.success(`Moved '${moveItem.name}' successfully`);
      setMoveModalVisible(false);
      setMoveDestination('');
      setMoveItem(null);
      fetchItems();
    } catch (error) {
      console.error('Move error:', error);
      message.error(error.response?.data?.error || 'Error moving item');
    }
  };

  // ----------------------------------
  // Add the handleViewFile function
  const handleViewFile = (file) => {
    const previewUrl = `http://localhost:8080/preview?directory=${encodeURIComponent(currentPath)}&filename=${encodeURIComponent(file.name)}`;
    window.open(previewUrl, '_blank');
  };

  // ----------------------------------
  // Table Columns (with Confidential File Check)
  // ----------------------------------
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
              <a onClick={() => handleFolderClick(name)}>{name}</a>
            </Space>
          );
        }
        if (record.type === 'file') {
          const hasAccess = checkFileAccess(record);
          if (!hasAccess) {
            return (
              <Space>
                <LockOutlined style={{ color: 'red' }} />
                <span>{name} (Locked)</span>
              </Space>
            );
          }
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
        const isOwner =
          record.type === 'directory'
            ? record.created_by === currentUser
            : record.uploader === currentUser;

        const canManageAccess =
          record.type === 'file' &&
          record.confidential &&
          (isOwner || isAdmin);

        const hasAccess = checkFileAccess(record);

        return (
          <Space>
            {/* View File */}
            {record.type === 'file' && hasAccess && (
              <Tooltip title="View File">
                <Button icon={<FileOutlined />} onClick={() => handleViewFile(record)} />
              </Tooltip>
            )}

            {/* Download */}
            {record.type === 'file' && (
              hasAccess ? (
                <Tooltip title="Download">
                  <Button icon={<DownloadOutlined />} onClick={() => handleDownload(record.name)} />
                </Tooltip>
              ) : (
                <Tooltip title="Access Denied">
                  <Button icon={<LockOutlined />} disabled />
                </Tooltip>
              )
            )}
            {record.type === 'directory' && (
              <Tooltip title="Download Folder">
                <Button icon={<DownloadOutlined />} onClick={() => handleDownloadFolder(record.name)} />
              </Tooltip>
            )}

            {/* Rename */}
            {isOwner && (
              <Tooltip title="Rename">
                <Button icon={<EditOutlined />} onClick={() => handleRename(record)} />
              </Tooltip>
            )}

            {/* Copy */}
            <Tooltip title="Copy">
              <Button icon={<CopyOutlined />} onClick={() => handleCopy(record)} />
            </Tooltip>

            {/* Move */}
            {isOwner && (
              <Tooltip title="Move">
                <Button icon={<SwapOutlined />} onClick={() => handleMove(record)} />
              </Tooltip>
            )}

            {/* Delete */}
            {isOwner && (
              <Tooltip title={record.type === 'directory' ? 'Delete Folder' : 'Delete File'}>
                <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
              </Tooltip>
            )}

            {/* Grant Access */}
            {canManageAccess && (
              <Tooltip title="Grant Access">
                <Button
                  onClick={() => {
                    setAccessFile(record);
                    setTargetUsername('');
                    setGrantModalVisible(true);
                  }}
                >
                  Grant
                </Button>
              </Tooltip>
            )}

            {/* Revoke Access */}
            {canManageAccess && (
              <Tooltip title="Revoke Access">
                <Button
                  onClick={() => {
                    setAccessFile(record);
                    setTargetUsername('');
                    setRevokeModalVisible(true);
                  }}
                >
                  Revoke
                </Button>
              </Tooltip>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <Layout style={{ minHeight: '84vh', background: '#f0f2f5' }}>
      <Content style={{ margin: '5px', padding: '10px', background: '#fff' }}>
        {/* Top Bar */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <h2 style={{ margin: 0 }}>Training Dashboard</h2>
          </Col>
          <Col>
            <Button type="primary" icon={<UploadOutlined />} onClick={handleOpenUploadModal}>
              Upload File
            </Button>
          </Col>
        </Row>

        {/* Navigation Row */}
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
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
            />
          </Col>
        </Row>

        {/* Breadcrumb */}
        <Breadcrumb style={{ marginBottom: 16 }}>{breadcrumbItems}</Breadcrumb>

        {/* Table of Items */}
        <Table
          columns={columns}
          dataSource={filteredItems}
          rowKey={(record) => (record.id ? record.id : record.name + record.type)}
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
                placeholder="e.g. Drills"
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
              <Select
                style={{ width: '100%' }}
                placeholder="Select folder or leave blank"
                value={selectedDestination}
                onChange={(val) => setSelectedDestination(val)}
                allowClear
              >
                {items
                  .filter((item) => item.type === 'directory')
                  .map((folder) => {
                    const folderPath = path.join(currentPath, folder.name);
                    return (
                      <Option key={folderPath} value={folderPath}>
                        {folder.name}
                      </Option>
                    );
                  })}
              </Select>
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
                treeData={directories}
                placeholder="Select destination folder"
                value={moveDestination}
                onChange={(val) => setMoveDestination(val)}
                treeDefaultExpandAll
                allowClear
              />
            </Form.Item>
          </Form>
        </Modal>

        {/* Upload Modal */}
        <Modal
          title="Upload File"
          visible={uploadModalVisible}
          onOk={handleModalUpload}
          onCancel={() => {
            setUploadModalVisible(false);
            setUploadingFile(null);
            setUploadConfidential(false);
          }}
          okText="Upload"
        >
          <p>Target Folder: {currentPath || '(none)'}</p>
          <Form layout="vertical">
            <Form.Item>
              <Button
                icon={<UploadOutlined />}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.onchange = (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setUploadingFile(file);
                    }
                  };
                  input.click();
                }}
              >
                Select File
              </Button>
            </Form.Item>

            {uploadingFile && (
              <Card size="small" style={{ marginTop: 16 }}>
                <strong>Selected File:</strong> {uploadingFile.name}
              </Card>
            )}

            <Form.Item label="Mark as Confidential?" style={{ marginTop: 16 }}>
              <Checkbox
                checked={uploadConfidential}
                onChange={(e) => setUploadConfidential(e.target.checked)}
              >
                Confidential
              </Checkbox>
            </Form.Item>
          </Form>
        </Modal>

        {/* Grant Access Modal */}
        <Modal
  title="Grant Access"
  visible={grantModalVisible}
  onOk={handleGrantAccess}
  onCancel={() => setGrantModalVisible(false)}
  okText="Grant"
>
  <Form layout="vertical">
    <Form.Item
      label="Select User to Grant Access"
      required
      tooltip="Begin typing to search for a username"
    >
      <Select
        showSearch
        placeholder="Type to search for a user"
        notFoundContent={fetchingUsers ? <Spin size="small" /> : null}
        onSearch={handleUserSearch}
        onChange={(value) => setTargetUsername(value)}
        filterOption={false} // rely on API search results
        style={{ width: '100%' }}
        allowClear
        value={targetUsername}  // Controlled value
      >
        {userOptions.map((user) => (
          <Select.Option key={user.username} value={user.username}>
            {user.username}
          </Select.Option>
        ))}
      </Select>
    </Form.Item>
  </Form>
</Modal>
        {/* Revoke Access Modal */}
        <Modal
  title="Revoke Access"
  visible={revokeModalVisible}
  onOk={handleRevokeAccess}
  onCancel={() => setRevokeModalVisible(false)}
  okText="Revoke"
>
  <Form layout="vertical">
    <Form.Item
      label="Select User to Revoke Access"
      required
      tooltip="Begin typing to search for a username"
    >
      <Select
        showSearch
        placeholder="Type to search for a user"
        notFoundContent={fetchingUsers ? <Spin size="small" /> : null}
        onSearch={handleUserSearch}
        onChange={(value) => setTargetUsername(value)}
        filterOption={false}
        style={{ width: '100%' }}
        allowClear
        value={targetUsername}  // Controlled value
      >
        {userOptions.map((user) => (
          <Select.Option key={user.username} value={user.username}>
            {user.username}
          </Select.Option>
        ))}
      </Select>
    </Form.Item>
  </Form>
</Modal>
      </Content>
    </Layout>
  );
};

export default TrainingDashboard;

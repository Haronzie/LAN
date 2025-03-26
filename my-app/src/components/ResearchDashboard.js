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
  Checkbox
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
  ArrowLeftOutlined
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

const ResearchDashboard = () => {
  const navigate = useNavigate();

  // ----------------------------------------
  // Current user from localStorage
  // ----------------------------------------
  const [currentUser, setCurrentUser] = useState('');
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setCurrentUser(storedUsername);
    }
  }, []);

  // ----------------------------------------
  // States: path, items, loading, search
  // ----------------------------------------
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Create Folder
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

  // ----------------------------------------
  // NEW: Modal-Based Upload States
  // ----------------------------------------
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [uploadConfidential, setUploadConfidential] = useState(false);

  // ----------------------------------------
  // Fetch Directories + Files
  // ----------------------------------------
  const fetchItems = async () => {
    setLoading(true);
    try {
      const dirParam = encodeURIComponent(currentPath);

      // 1) Directories
      const dirRes = await axios.get(`/directory/list?directory=${dirParam}`, {
        withCredentials: true
      });
      const directories = Array.isArray(dirRes.data) ? dirRes.data : [];

      // 2) Files
      const fileRes = await axios.get(`/files?directory=${dirParam}`, {
        withCredentials: true
      });
      const files = (fileRes.data || []).map((f) => ({
        name: f.name,
        type: 'file',
        size: f.size,
        formattedSize: formatFileSize(f.size),
        uploader: f.uploader
      }));

      setItems([...directories, ...files]);
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

  // ----------------------------------------
  // Search Filtering
  // ----------------------------------------
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ----------------------------------------
  // Create Folder
  // ----------------------------------------
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
    } catch (error) {
      console.error('Create folder error:', error);
      message.error(error.response?.data?.error || 'Error creating folder');
    }
  };

  // ----------------------------------------
  // Navigation & Breadcrumbs
  // ----------------------------------------
  const handleFolderClick = (folderName) => {
    const newPath = path.join(currentPath, folderName);
    setCurrentPath(newPath);
  };

  const handleGoUp = () => {
    if (!currentPath) return;
    if (currentPath === 'Research') {
      setCurrentPath('');
      return;
    }
    const parent = path.dirname(currentPath);
    setCurrentPath(parent === '.' ? '' : parent);
  };

  const getPathSegments = (p) => (p ? p.split('/').filter(Boolean) : []);
  const segments = getPathSegments(currentPath);
  const breadcrumbItems = [
    <Breadcrumb.Item key="root">
      {currentPath === '' ? 'Root' : <a onClick={() => setCurrentPath('')}>Root</a>}
    </Breadcrumb.Item>
  ];
  segments.forEach((seg, index) => {
    const partialPath = segments.slice(0, index + 1).join('/');
    const isLast = index === segments.length - 1;
    breadcrumbItems.push(
      <Breadcrumb.Item key={index}>
        {isLast ? seg : (
          <a onClick={() => setCurrentPath(segments.slice(0, index + 1).join('/'))}>
            {seg}
          </a>
        )}
      </Breadcrumb.Item>
    );
  });

  // ----------------------------------------
  // NEW: Modal-Based Upload
  // ----------------------------------------
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
    formData.append('container', 'research');

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

  // ----------------------------------------
  // Delete
  // ----------------------------------------
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
          data: { name: record.name, parent: currentPath, container: 'research' },
          withCredentials: true
        });
      } else {
        await axios.delete('/delete-file', {
          data: { directory: currentPath, filename: record.name, container: 'research' },
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

  // ----------------------------------------
  // Download
  // ----------------------------------------
  const handleDownload = (fileName) => {
    const downloadUrl = `http://localhost:8080/download?filename=${encodeURIComponent(fileName)}`;
    window.open(downloadUrl, '_blank');
  };

  const handleDownloadFolder = (folderName) => {
    const folderPath = path.join(currentPath, folderName);
    const downloadUrl = `http://localhost:8080/download-folder?directory=${encodeURIComponent(folderPath)}`;
    window.open(downloadUrl, '_blank');
  };

  // ----------------------------------------
  // Rename
  // ----------------------------------------
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
    } catch (error) {
      console.error('Rename error:', error);
      message.error(error.response?.data?.error || 'Error renaming item');
    }
  };

  // ----------------------------------------
  // Copy
  // ----------------------------------------
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
            container: 'research'
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
            container: 'research'
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

  // ----------------------------------------
  // Move
  // ----------------------------------------
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
            container: 'research'
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
            container: 'research'
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

  // ----------------------------------------
  // Table Columns
  // ----------------------------------------
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
      render: (size, record) => (record.type === 'directory' ? '--' : size),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record) => {
        const isOwner =
          record.type === 'directory'
            ? record.created_by === currentUser
            : record.uploader === currentUser;

        return (
          <Space>
            {/* Download for files */}
            {record.type === 'file' && (
              <Tooltip title="Download">
                <Button icon={<DownloadOutlined />} onClick={() => handleDownload(record.name)} />
              </Tooltip>
            )}

            {/* If directory not owned => Download Folder */}
            {record.type === 'directory' && !isOwner && (
              <Tooltip title="Download Folder">
                <Button icon={<DownloadOutlined />} onClick={() => handleDownloadFolder(record.name)} />
              </Tooltip>
            )}

            {/* Copy is available to all */}
            <Tooltip title="Copy">
              <Button icon={<CopyOutlined />} onClick={() => handleCopy(record)} />
            </Tooltip>

            {/* Rename, delete, move only if owner */}
            {isOwner && (
              <>
                <Tooltip title="Rename">
                  <Button icon={<EditOutlined />} onClick={() => handleRename(record)} />
                </Tooltip>
                <Tooltip title={record.type === 'directory' ? 'Delete Folder' : 'Delete File'}>
                  <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
                </Tooltip>
                <Tooltip title="Move">
                  <Button icon={<SwapOutlined />} onClick={() => handleMove(record)} />
                </Tooltip>
              </>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content style={{ margin: '24px', padding: '24px', background: '#fff' }}>
        {/* Top Bar */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Button
              type="primary"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/user')}
            >
              Back to Dashboard
            </Button>
          </Col>

          <Col>
            <h2 style={{ margin: 0 }}>Research Dashboard</h2>
          </Col>

          {/* Instead of an Upload component with customRequest, we use a modal-based approach */}
          <Col>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => handleOpenUploadModal()}
            >
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
        <Breadcrumb style={{ marginBottom: 16 }}>
          <Breadcrumb.Item key="root">
            {currentPath === '' ? 'Root' : <a onClick={() => setCurrentPath('')}>Root</a>}
          </Breadcrumb.Item>
          {segments.map((seg, index) => (
            <Breadcrumb.Item key={index}>
              {index === segments.length - 1 ? (
                seg
              ) : (
                <a onClick={() => setCurrentPath(segments.slice(0, index + 1).join('/'))}>
                  {seg}
                </a>
              )}
            </Breadcrumb.Item>
          ))}
        </Breadcrumb>

        {/* Table of Items */}
        <Table
          columns={columns}
          dataSource={filteredItems}
          rowKey={(record) => record.name + record.type}
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
                placeholder="e.g. Experiments"
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
              <Select
                style={{ width: '100%' }}
                placeholder="Select a destination folder"
                value={moveDestination}
                onChange={(val) => setMoveDestination(val)}
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

        {/* NEW Modal-Based Upload */}
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
                  // Show a file picker
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
      </Content>
    </Layout>
  );
};

export default ResearchDashboard;

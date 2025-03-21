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
  Card,
  Breadcrumb,
  Upload
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  ArrowUpOutlined,
  FolderAddOutlined,
  EditOutlined,
  // NEW:
  CopyOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import path from 'path-browserify';

const { Content } = Layout;

// Helper: split a path into segments (e.g., "Folder/Subfolder")
function getPathSegments(p) {
  if (!p) return [];
  return p.split('/').filter(Boolean);
}

const FileManager = () => {
  const [items, setItems] = useState([]); // files and directories
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState(''); // root: empty string
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [renameNewName, setRenameNewName] = useState('');

  // NEW: Copy modal states
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [copyNewName, setCopyNewName] = useState('');
  const [copyItem, setCopyItem] = useState(null);

  const navigate = useNavigate();
  const isRoot = currentPath === '';

  // Navigate back to the admin dashboard
  const handleBackToDashboard = () => {
    navigate('/admin');
  };

  // Fetch items (directories + files) for the currentPath
  const fetchItems = async () => {
    setLoading(true);
    try {
      const directoryParam = encodeURIComponent(currentPath);
      // We call both endpoints in parallel:
      const [filesRes, dirsRes] = await Promise.all([
        axios.get(`/files?directory=${directoryParam}`, { withCredentials: true }),
        axios.get(`/directory/list?directory=${directoryParam}`, { withCredentials: true }),
      ]);

      // Convert files to your table structure
      const files = (filesRes.data || []).map((f) => ({
        name: f.name,
        type: 'file',
        size: f.size,
        contentType: f.contentType,
        uploader: f.uploader,
      }));

      // Directories should already have { name, type: 'directory' }
      const directories = dirsRes.data || [];

      setItems([...directories, ...files]);
    } catch (error) {
      console.error('Error fetching items:', error);
      message.error(error.response?.data?.error || 'Error fetching directory contents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [currentPath]);

  // Optional polling for backend changes (e.g. every 10s)
  useEffect(() => {
    const interval = setInterval(fetchItems, 10000);
    return () => clearInterval(interval);
  }, [currentPath]);

  // Filter items by search term
  const filteredItems = items.filter((item) =>
    (item.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Create Folder
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
    } catch (error) {
      console.error('Create folder error:', error);
      message.error(error.response?.data?.error || 'Error creating folder');
    }
  };

  // Navigate into a folder
  const handleFolderClick = (folderName) => {
    const newPath = isRoot ? folderName : path.join(currentPath, folderName);
    setCurrentPath(newPath);
  };

  // Go up one level
  const handleGoUp = () => {
    if (isRoot) return;
    const parent = path.dirname(currentPath);
    setCurrentPath(parent === '.' ? '' : parent);
  };

  // Breadcrumb
  const handleBreadcrumbClick = (index) => {
    const segments = getPathSegments(currentPath);
    const newPath = segments.slice(0, index + 1).join('/');
    setCurrentPath(newPath);
  };

  // Upload modal
  const handleOpenUploadModal = () => {
    if (isRoot) {
      message.error('Please select an existing folder before uploading a file.');
      return;
    }
    setUploadingFile(null);
    setUploadModalVisible(true);
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

    const formData = new FormData();
    formData.append('file', uploadingFile);
    formData.append('directory', currentPath);

    try {
      const res = await axios.post('/upload', formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success(res.data.message || 'File uploaded successfully');
      setUploadModalVisible(false);
      setUploadingFile(null);
      fetchItems();
    } catch (error) {
      console.error('Upload error:', error);
      message.error(error.response?.data?.error || 'Error uploading file');
    }
  };

  // Delete item (file or directory)
  const handleDelete = async (record) => {
    try {
      if (record.type === 'directory') {
        await axios.delete('/directory/delete', {
          data: { name: record.name, parent: currentPath },
          withCredentials: true,
        });
      } else {
        await axios.delete('/delete-file', {
          data: { filename: record.name },
          withCredentials: true,
        });
      }
      message.success(`${record.name} deleted successfully`);
      fetchItems();
    } catch (error) {
      console.error('Delete error:', error);
      message.error(error.response?.data?.error || `Error deleting ${record.name}`);
    }
  };

  // Download file
  const handleDownload = (fileName) => {
    // Adjust the base URL as needed (e.g. if your server is not localhost:8080)
    const downloadUrl = `http://localhost:8080/download?filename=${encodeURIComponent(fileName)}`;
    window.open(downloadUrl, '_blank');
  };

  // Rename (files or directories)
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
          },
          { withCredentials: true }
        );
      } else {
        await axios.put(
          '/file/rename',
          {
            old_filename: selectedItem.name,
            new_filename: renameNewName,
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

  // NEW: handleCopy - opens the Copy modal
  const handleCopy = (record) => {
    // Suggest a new name by appending "_copy"
    const suggestedName = record.name + '_copy';
    setCopyItem(record);
    setCopyNewName(suggestedName);
    setCopyModalVisible(true);
  };

  // NEW: handleCopyConfirm - calls the correct endpoint for file or folder
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
        // Copy a folder
        await axios.post(
          '/directory/copy',
          {
            source_name: copyItem.name,
            source_parent: currentPath,
            new_name: copyNewName,
          },
          { withCredentials: true }
        );
      } else {
        // Copy a file
        await axios.post(
          '/copy-file',
          {
            source_file: copyItem.name,
            new_file_name: copyNewName,
          },
          { withCredentials: true }
        );
      }
      message.success(`Copied '${copyItem.name}' to '${copyNewName}' successfully`);
      setCopyModalVisible(false);
      setCopyNewName('');
      setCopyItem(null);
      fetchItems();
    } catch (error) {
      console.error('Copy error:', error);
      message.error(error.response?.data?.error || 'Error copying item');
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
      },
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (type === 'directory' ? 'Folder' : 'File'),
    },
    {
      title: 'Size (KB)',
      dataIndex: 'size',
      key: 'size',
      render: (size, record) =>
        record.type === 'directory' ? '--' : (size / 1024).toFixed(2),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record) => (
        <Space>
          {record.type === 'file' && (
            <Tooltip title="Download">
              <Button
                icon={<DownloadOutlined />}
                onClick={() => handleDownload(record.name)}
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
          {/* NEW: Copy button */}
          <Tooltip title="Copy">
            <Button
              icon={<CopyOutlined />}
              onClick={() => handleCopy(record)}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Build breadcrumb items
  const segments = getPathSegments(currentPath);
  const breadcrumbItems = [
    <Breadcrumb.Item key="root">
      {isRoot ? 'Root' : <a onClick={() => setCurrentPath('')}>Root</a>}
    </Breadcrumb.Item>,
  ];
  segments.forEach((seg, index) => {
    breadcrumbItems.push(
      <Breadcrumb.Item key={index}>
        {index === segments.length - 1 ? (
          seg
        ) : (
          <a onClick={() => handleBreadcrumbClick(index)}>{seg}</a>
        )}
      </Breadcrumb.Item>
    );
  });

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content style={{ margin: '24px', padding: '24px', background: '#fff' }}>

        {/* Top row: Title, Back to Dashboard, and Upload */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Space>
              <h2 style={{ margin: 0 }}>File Manager</h2>
              <Button onClick={handleBackToDashboard}>Back to Dashboard</Button>
            </Space>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={handleOpenUploadModal}
            >
              Upload File
            </Button>
          </Col>
        </Row>

        {/* Breadcrumb */}
        {segments.length > 0 && (
          <Row style={{ marginBottom: 16 }}>
            <Col>
              <Breadcrumb>{breadcrumbItems}</Breadcrumb>
            </Col>
          </Row>
        )}

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {currentPath && (
            <Col>
              <Button icon={<ArrowUpOutlined />} onClick={handleGoUp}>
                Go Up
              </Button>
            </Col>
          )}
          <Col>
            <Button
              icon={<FolderAddOutlined />}
              onClick={() => setCreateFolderModal(true)}
            >
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
          rowKey={(record) => record.name}
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
          onCancel={() => setUploadModalVisible(false)}
          okText="Upload"
        >
          <p>Target Folder: {currentPath || 'None (Please create a folder first)'}</p>
          <Upload
            beforeUpload={(file) => {
              setUploadingFile(file);
              return false; // Prevent auto-upload
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
        </Modal>

        {/* NEW: Copy Modal */}
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
          </Form>
        </Modal>
      </Content>
    </Layout>
  );
};

export default FileManager;

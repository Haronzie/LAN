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
  ArrowLeftOutlined,
  FolderAddOutlined,
  ArrowUpOutlined,
  EditOutlined,
  SwapOutlined,
  CopyOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import path from 'path-browserify';

const { Content } = Layout;

// Helper: split a path into segments (e.g. "Operation/Reports")
function getPathSegments(p) {
  if (!p) return [];
  return p.split('/').filter(Boolean);
}

const FileManager = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Folder creation
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Upload
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);

  // Rename / Move / Copy
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [renameNewName, setRenameNewName] = useState('');
  const [moveDestination, setMoveDestination] = useState('');
  const [copyDestination, setCopyDestination] = useState('');

  const navigate = useNavigate();
  const isRoot = currentPath === '';

  // Default subfolders for root view.
  const defaultFolders = [
    { name: 'Operation', type: 'directory' },
    { name: 'Research', type: 'directory' },
    { name: 'Training', type: 'directory' }
  ];

  // 1) FETCH ITEMS (combine files and directories)
  const fetchItems = async () => {
    setLoading(true);
    try {
      // When at root, you can simply use the default folders.
      if (isRoot) {
        setItems(defaultFolders);
      } else {
        const directoryParam = encodeURIComponent(currentPath);
        const [filesRes, dirsRes] = await Promise.all([
          axios.get(`/files?directory=${directoryParam}`, { withCredentials: true }),
          axios.get(`/directory/list?directory=${directoryParam}`, { withCredentials: true })
        ]);
        const files = filesRes.data || [];
        const directories = dirsRes.data || [];
        setItems([...directories, ...files]);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
      message.error(
        error.response?.data?.error || 'Error fetching directory contents'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line
  }, [currentPath]);

  // Use a safe check for item.name in case it's undefined.
  const filteredItems = items.filter((item) =>
    (item.name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 2) CREATE FOLDER using /directory/create
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
      message.error(
        error.response?.data?.error || 'Error creating folder'
      );
    }
  };

  // 3) NAVIGATE FOLDERS
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

  // 4) UPLOAD FILE
  const handleOpenUploadModal = () => {
    // Prevent upload if no folder is selected.
    if (isRoot) {
      message.error('Please select a folder before uploading a file.');
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
    const formData = new FormData();
    formData.append('file', uploadingFile);
    formData.append('directory', currentPath);
    try {
      const res = await axios.post('/upload', formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success(res.data.message || 'File uploaded successfully');
      setUploadModalVisible(false);
      setUploadingFile(null);
      fetchItems();
    } catch (error) {
      console.error('Upload error:', error);
      message.error('Error uploading file');
    }
  };

  // 5) DELETE: use different endpoints for file vs. directory
  const handleDelete = async (record) => {
    try {
      if (record.type === 'directory') {
        await axios.delete('/directory/delete', {
          data: { name: path.join(currentPath, record.name) },
          withCredentials: true
        });
      } else {
        await axios.delete('/files', {
          data: { filename: path.join(currentPath, record.name) },
          withCredentials: true
        });
      }
      message.success(`${record.name} deleted successfully`);
      fetchItems();
    } catch (error) {
      console.error('Delete error:', error);
      message.error(error.response?.data?.error || `Error deleting ${record.name}`);
    }
  };

  // 6) DOWNLOAD
  const handleDownload = (fileName) => {
    const fullPath = path.join(currentPath, fileName);
    window.open(`/download?filename=${encodeURIComponent(fullPath)}`, '_blank');
  };

  // 7) RENAME: different endpoints based on type
  const handleRenameConfirm = async () => {
    if (!renameNewName.trim()) {
      message.error('New name cannot be empty');
      return;
    }
    try {
      if (selectedItem.type === 'directory') {
        await axios.put('/directory/rename', {
          old_name: path.join(currentPath, selectedItem.name),
          new_name: renameNewName
        }, { withCredentials: true });
      } else {
        await axios.put('/files', {
          old_filename: path.join(currentPath, selectedItem.name),
          new_filename: renameNewName
        }, { withCredentials: true });
      }
      message.success('Item renamed successfully');
      setRenameModalVisible(false);
      setSelectedItem(null);
      fetchItems();
    } catch (error) {
      console.error('Rename error:', error);
      message.error('Error renaming item');
    }
  };

  // 8) MOVE: assume endpoints /directory/move and /files/move exist
  const handleMoveConfirm = async () => {
    if (!moveDestination.trim()) {
      message.error('Destination cannot be empty');
      return;
    }
    try {
      if (selectedItem.type === 'directory') {
        await axios.put('/directory/move', {
          source: path.join(currentPath, selectedItem.name),
          destination: moveDestination
        }, { withCredentials: true });
      } else {
        await axios.put('/files/move', {
          source: path.join(currentPath, selectedItem.name),
          destination: moveDestination
        }, { withCredentials: true });
      }
      message.success('Item moved successfully');
      setMoveModalVisible(false);
      setSelectedItem(null);
      fetchItems();
    } catch (error) {
      console.error('Move error:', error);
      message.error('Error moving item');
    }
  };

  // 9) COPY: assume endpoints /directory/copy and /files/copy exist
  const handleCopyConfirm = async () => {
    if (!copyDestination.trim()) {
      message.error('Destination cannot be empty');
      return;
    }
    try {
      if (selectedItem.type === 'directory') {
        await axios.post('/directory/copy', {
          name: path.join(currentPath, selectedItem.name),
          destination: copyDestination
        }, { withCredentials: true });
      } else {
        await axios.post('/files/copy', {
          filename: path.join(currentPath, selectedItem.name),
          destination: copyDestination
        }, { withCredentials: true });
      }
      message.success('Item copied successfully');
      setCopyModalVisible(false);
      setSelectedItem(null);
      fetchItems();
    } catch (error) {
      console.error('Copy error:', error);
      message.error('Error copying item');
    }
  };

  // 10) TABLE COLUMNS for display
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
      title: 'Size (KB)',
      dataIndex: 'size',
      key: 'size',
      render: (size, record) =>
        record.type === 'directory' ? '--' : (size / 1024).toFixed(2)
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
          <Tooltip title="Move">
            <Button
              icon={<SwapOutlined />}
              onClick={() => {
                setSelectedItem(record);
                setMoveDestination(currentPath);
                setMoveModalVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Copy">
            <Button
              icon={<CopyOutlined />}
              onClick={() => {
                setSelectedItem(record);
                setCopyModalVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title={record.type === 'file' ? 'Delete File' : 'Delete Folder'}>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  // Breadcrumb items
  const segments = getPathSegments(currentPath);
  const breadcrumbItems = [
    <Breadcrumb.Item key="root">
      {isRoot ? 'Root' : <a onClick={() => setCurrentPath('')}>Root</a>}
    </Breadcrumb.Item>
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
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin')}>
              Back to Dashboard
            </Button>
          </Col>
          <Col>
            <h2 style={{ margin: 0 }}>File Manager</h2>
          </Col>
          <Col>
            <Button type="primary" icon={<UploadOutlined />} onClick={handleOpenUploadModal}>
              Upload File
            </Button>
          </Col>
        </Row>

        <Row style={{ marginBottom: 16 }}>
          <Col>
            <Breadcrumb>{breadcrumbItems}</Breadcrumb>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col>
            <Button icon={<ArrowUpOutlined />} disabled={isRoot} onClick={handleGoUp}>
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

        {/* Move Modal */}
        <Modal
          title="Move Item"
          visible={moveModalVisible}
          onOk={handleMoveConfirm}
          onCancel={() => setMoveModalVisible(false)}
          okText="Move"
        >
          <Form layout="vertical">
            <Form.Item label="Destination Path" required>
              <Input
                value={moveDestination}
                onChange={(e) => setMoveDestination(e.target.value)}
                placeholder="e.g. Operation/Reports"
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
            <Form.Item label="Destination Folder" required>
              <Input
                value={copyDestination}
                onChange={(e) => setCopyDestination(e.target.value)}
                placeholder="e.g. Training"
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
          <p>Target Folder: {currentPath || 'Root'}</p>
          <Upload
            beforeUpload={(file) => {
              setUploadingFile(file);
              return false; // Prevent default upload
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
      </Content>
    </Layout>
  );
};

export default FileManager;

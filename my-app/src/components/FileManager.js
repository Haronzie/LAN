import React, { useState, useEffect } from 'react';
import {
  Layout,
  Table,
  Button,
  Upload,
  message,
  Input,
  Row,
  Col,
  Modal,
  Space,
  Tooltip,
  Form,
  Select,
  Card
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

// ======= 1) ADD HELPER FUNCTION =======
function getBackendPath(currentPath) {
  return currentPath === '' ? 'Cdrrmo files' : currentPath;
}

const { Content } = Layout;

const FileManager = () => {
  const [items, setItems] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState(''); // root = ''
  const [searchTerm, setSearchTerm] = useState('');

  // Folder creation modal states
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Folder selection for uploading
  const [selectedFolder, setSelectedFolder] = useState(''); // Selected folder for upload
  const [fileToUpload, setFileToUpload] = useState(null); // Store file to upload

  // Rename & Move states
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [copyModalVisible, setCopyModalVisible] = useState(false); // Modal for copying files
  const [selectedItem, setSelectedItem] = useState(null);
  const [renameNewName, setRenameNewName] = useState('');
  const [moveDestination, setMoveDestination] = useState('');
  const [copyDestination, setCopyDestination] = useState('');

  const navigate = useNavigate();

  // =========== 2A) USE HELPER IN fetchItems ============  
  const fetchItems = async () => {
    setLoading(true);
    try {
      const directoryParam = encodeURIComponent(currentPath || '');
      const res = await axios.get(`http://localhost:9090/list-resource?directory=${directoryParam}`, {
        withCredentials: true
      });

      // Filter out the 'Cdrrmo files' folder from being displayed in the table
      const filteredItems = res.data.filter(item => item.name !== 'Cdrrmo files');
      if (Array.isArray(filteredItems)) {
        setItems(filteredItems);
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error('Error fetching directory contents:', error);
      message.error('Error fetching directory contents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [currentPath]);

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isRoot = currentPath === '';

  // Up one level
  const handleGoUp = () => {
    if (isRoot) return;
    const parent = path.dirname(currentPath);
    setCurrentPath(parent === '.' ? '' : parent);
  };

  // Delete file or folder
  const handleDelete = async (record) => {
    try {
      await axios.delete('/delete-resource', {
        data: {
          resource_type: record.type,
          name: path.join(currentPath, record.name),
        },
        withCredentials: true,
      });
      message.success(`${record.name} deleted successfully`);
      fetchItems();
    } catch (error) {
      message.error(`Error deleting ${record.name}`);
    }
  };

  // Download file
  const handleDownload = (fileName) => {
    const fullPath = path.join(getBackendPath(currentPath), fileName);
    window.open(`/download?filename=${encodeURIComponent(fullPath)}`, '_blank');
  };

  // Create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      message.error('Folder name cannot be empty');
      return;
    }
    try {
      const parentPath = getBackendPath(currentPath);
      const folderPath = path.join(parentPath, newFolderName);

      await axios.post(
        '/create-resource',
        {
          resource_type: 'directory',
          name: folderPath,
          parent: selectedFolder || currentPath,  // Use selected folder if available
        },
        { withCredentials: true }
      );
      message.success('Folder created successfully');
      setCreateFolderModal(false);
      setNewFolderName('');
      fetchItems();
    } catch (error) {
      message.error('Error creating folder');
    }
  };

  // Upload file
  const customUpload = async ({ file, onSuccess, onError }) => {
    if (!selectedFolder && currentPath === '') {
      // If no folder is selected and we're in the root, show an error
      message.error('Please select a folder to upload the file');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('directory', selectedFolder || currentPath); // Use selected folder if any

    try {
      const res = await axios.post('/upload', formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success(res.data.message || 'File uploaded successfully');
      onSuccess(null, file);
      fetchItems();
    } catch (error) {
      message.error('Error uploading file');
      onError(error);
    }
  };

  // Set the file to upload
  const handleFileChange = (file) => {
    setFileToUpload(file);  // Store file info
  };

  // Rename
  const handleRenameConfirm = async () => {
    if (!renameNewName.trim()) {
      message.error('New name cannot be empty');
      return;
    }
    try {
      await axios.put(
        '/rename-resource',
        {
          resource_type: selectedItem.type,
          old_name: path.join(currentPath, selectedItem.name),
          new_name: path.join(currentPath, renameNewName),
        },
        { withCredentials: true }
      );
      message.success('Item renamed successfully');
      setRenameModalVisible(false);
      setSelectedItem(null);
      fetchItems();
    } catch (error) {
      message.error('Error renaming item');
    }
  };

  // Move
  const handleMoveConfirm = async () => {
    if (!moveDestination.trim()) {
      message.error('Destination cannot be empty');
      return;
    }
    try {
      await axios.put(
        '/move-resource',
        {
          resource_type: selectedItem.type,
          source: path.join(currentPath, selectedItem.name),
          destination: moveDestination,
        },
        { withCredentials: true }
      );
      message.success('Item moved successfully');
      setMoveModalVisible(false);
      setSelectedItem(null);
      fetchItems();
    } catch (error) {
      message.error('Error moving item');
    }
  };

  // Copy
  const handleCopyConfirm = async () => {
    if (!copyDestination.trim()) {
      message.error('Destination cannot be empty');
      return;
    }
    try {
      await axios.put(
        '/copy-resource',
        {
          resource_type: selectedItem.type,
          source: path.join(currentPath, selectedItem.name),
          destination: copyDestination,
        },
        { withCredentials: true }
      );
      message.success('Item copied successfully');
      setCopyModalVisible(false);
      setSelectedItem(null);
      fetchItems();
    } catch (error) {
      message.error('Error copying item');
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
              <a
                onClick={() => {
                  const newPath = isRoot
                    ? record.name
                    : path.join(currentPath, record.name);
                  setCurrentPath(newPath);
                }}
              >
                {name}
              </a>
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
                onClick={() =>
                  handleDownload(record.name) // or pass path.join(currentPath, record.name)
                }
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
          <Tooltip title={record.type === 'file' ? "Delete File" : "Delete Folder"}>
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
            <Upload customRequest={customUpload} showUploadList={false} onChange={({ file }) => handleFileChange(file)}>
              <Button type="primary" icon={<UploadOutlined />}>
                Upload File
              </Button>
            </Upload>
          </Col>
        </Row>

        {/* Display the selected file */}
        {fileToUpload && (
          <Card
            title="Selected File"
            bordered={false}
            style={{ marginBottom: 16 }}
          >
            <p><strong>File Name:</strong> {fileToUpload.name}</p>
            <p><strong>Folder:</strong> {selectedFolder || 'Root'}</p>
          </Card>
        )}

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col>
            <Button
              icon={<ArrowUpOutlined />}
              disabled={isRoot}
              onClick={handleGoUp}
            >
              Go Up
            </Button>
          </Col>
          <Col>
            <Button
              icon={<FolderAddOutlined />}
              onClick={() => setCreateFolderModal(true)}
            >
              Create Folder
            </Button>
          </Col>
          <Col>
            <Select
              value={selectedFolder}
              onChange={setSelectedFolder}
              placeholder="Select Folder"
              style={{ width: 200 }}
            >
              {items
                .filter((item) => item.type === 'directory')
                .map((folder, index) => (
                  <Select.Option key={index} value={folder.name}>
                    {folder.name}
                  </Select.Option>
                ))}
            </Select>
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
                placeholder="Enter destination path (e.g., training/reports)"
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
              <Select
                value={copyDestination}
                onChange={setCopyDestination}
                placeholder="Select Folder"
                style={{ width: '100%' }}
              >
                {items
                  .filter((item) => item.type === 'directory')
                  .map((folder, index) => (
                    <Select.Option key={index} value={folder.name}>
                      {folder.name}
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

export default FileManager;

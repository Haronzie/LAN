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
  Form
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  ArrowLeftOutlined,
  FolderAddOutlined,
  ArrowUpOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import path from 'path-browserify'; 
// "path-browserify" helps manipulate paths in the browser. 
// Install with: npm install path-browserify

const { Content } = Layout;

const FileManager = () => {
  const [items, setItems] = useState([]);        // Contains files + directories
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState(''); // Track which folder we’re in
  const [searchTerm, setSearchTerm] = useState('');

  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const navigate = useNavigate();

  // Fetch items in the currentPath
  const fetchItems = async () => {
    setLoading(true);
    try {
      // If currentPath is empty, we fetch top-level
      const res = await axios.get(`/list-resource?directory=${currentPath}`, {
        withCredentials: true
      });
      if (Array.isArray(res.data)) {
        setItems(res.data);
      } else {
        setItems([]);
      }
    } catch (error) {
      message.error('Error fetching directory contents');
    } finally {
      setLoading(false);
    }
  };

  // On mount or whenever currentPath changes, fetch items
  useEffect(() => {
    fetchItems();
  }, [currentPath]);

  // Filter by searchTerm (applies to both files and directories)
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper to determine if we’re at root or not
  const isRoot = currentPath === '';

  // Go up one directory
  const handleGoUp = () => {
    if (isRoot) return; // already at root
    // E.g., if currentPath = "operation/training", 
    // path.dirname(...) => "operation"
    const parent = path.dirname(currentPath);
    if (parent === '.') {
      // Means we were in something like "folder" => go to root
      setCurrentPath('');
    } else {
      setCurrentPath(parent);
    }
  };

  // Delete item (file or directory)
  const handleDelete = async (record) => {
    try {
      await axios.delete('/delete-resource', {
        data: {
          resource_type: record.type, // "file" or "directory"
          // The name is relative to root, e.g. "operation/file.txt"
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
    // Just open a new tab that points to /download?filename=...
    window.open(`/download?filename=${encodeURIComponent(fileName)}`, '_blank');
  };

  // Create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      message.error('Folder name cannot be empty');
      return;
    }
    try {
      // If we’re in "operation", the new folder path is "operation/newFolderName"
      const folderPath = currentPath
        ? path.join(currentPath, newFolderName)
        : newFolderName;

      await axios.post(
        '/create-resource',
        {
          resource_type: 'directory',
          name: folderPath,
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

  // Custom upload function (uploads to the current directory)
  const customUpload = async ({ file, onSuccess, onError }) => {
    const formData = new FormData();
    formData.append('file', file);
    // Pass the currentPath as "directory"
    formData.append('directory', currentPath);

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

  // Table columns
  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => {
        // If it's a directory, make it clickable to navigate inside
        if (record.type === 'directory') {
          return (
            <Space>
              <FolderOpenOutlined />
              <a
                onClick={() => {
                  // e.g. if currentPath = 'operation'
                  // then we set new path to 'operation/record.name'
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
        // Otherwise, it's a file
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
      render: (record) => {
        if (record.type === 'file') {
          return (
            <Space>
              <Tooltip title="Download">
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() =>
                    handleDownload(path.join(currentPath, record.name))
                  }
                />
              </Tooltip>
              <Tooltip title="Delete File">
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(record)}
                />
              </Tooltip>
            </Space>
          );
        }
        // For directories, just show Delete (or any other action you want)
        return (
          <Space>
            <Tooltip title="Delete Folder">
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
              />
            </Tooltip>
          </Space>
        );
      },
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
            <Upload customRequest={customUpload} showUploadList={false}>
              <Button type="primary" icon={<UploadOutlined />}>
                Upload File
              </Button>
            </Upload>
          </Col>
        </Row>

        {/* Row for path navigation, create folder, and search */}
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
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
            />
          </Col>
        </Row>

        {/* Table of files & folders */}
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
      </Content>
    </Layout>
  );
};

export default FileManager;

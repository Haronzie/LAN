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
  ArrowUpOutlined,
  EditOutlined,
  SwapOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import path from 'path-browserify'; // Install with: npm install path-browserify

const { Content } = Layout;

const FileManager = () => {
  // States for files and current folder navigation
  const [items, setItems] = useState([]); // items: both files and folders
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState(''); // root = ''
  const [searchTerm, setSearchTerm] = useState('');

  // State for Create Folder modal
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // States for Rename and Move modals
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [renameNewName, setRenameNewName] = useState('');
  const [moveDestination, setMoveDestination] = useState('');

  const navigate = useNavigate();

  // Fetch items in the current folder using your /list-resource endpoint
  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/list-resource?directory=${currentPath}`, {
        withCredentials: true,
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

  // Refetch items when currentPath changes
  useEffect(() => {
    fetchItems();
  }, [currentPath]);

  // Filter items based on search term
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isRoot = currentPath === '';

  // Navigate one level up
  const handleGoUp = () => {
    if (isRoot) return;
    const parent = path.dirname(currentPath);
    setCurrentPath(parent === '.' ? '' : parent);
  };

  // Delete item (file or folder)
  const handleDelete = async (record) => {
    try {
      await axios.delete('/delete-resource', {
        data: {
          resource_type: record.type, // "file" or "directory"
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

  // Download a file
  const handleDownload = (fileName) => {
    window.open(`/download?filename=${encodeURIComponent(fileName)}`, '_blank');
  };

  // Create folder (will be created in the current folder)
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      message.error('Folder name cannot be empty');
      return;
    }
    try {
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

  // Custom upload function: uploads file into the current folder
  const customUpload = async ({ file, onSuccess, onError }) => {
    const formData = new FormData();
    formData.append('file', file);
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

  // Handle Rename Confirm
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
          new_name: currentPath
            ? path.join(currentPath, renameNewName)
            : renameNewName,
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

  // Handle Move Confirm
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
          destination: moveDestination, // Destination should be full relative path from base
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

  // Table columns definition
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
            <>
              <Tooltip title="Download">
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() =>
                    handleDownload(path.join(currentPath, record.name))
                  }
                />
              </Tooltip>
            </>
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
                // Pre-fill moveDestination with currentPath if available
                setMoveDestination(currentPath);
                setMoveModalVisible(true);
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
      </Content>
    </Layout>
  );
};

export default FileManager;

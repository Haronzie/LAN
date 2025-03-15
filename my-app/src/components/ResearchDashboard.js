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

// Example: replace with your real authentication logic
const currentUser = { username: 'john_doe' };

const ResearchDashboard = () => {
  const navigate = useNavigate();

  // 1) Start at the root (empty string), so we can show the "Research" folder
  //    (and filter out other folders at root).
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Folder creation
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Upload
  const [selectedFolder, setSelectedFolder] = useState('');
  const [fileToUpload, setFileToUpload] = useState(null);

  // Rename / Move / Copy
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [renameNewName, setRenameNewName] = useState('');
  const [moveDestination, setMoveDestination] = useState('');
  const [copyDestination, setCopyDestination] = useState('');

  // ===========================
  // FETCH ITEMS
  // ===========================
  const fetchItems = async () => {
    setLoading(true);
    try {
      const directoryParam = encodeURIComponent(currentPath);
      const res = await axios.get(
        `http://localhost:9090/list-resource?directory=${directoryParam}`,
        { withCredentials: true }
      );
      setItems(res.data || []);
    } catch (error) {
      console.error('Error fetching directory contents:', error);
      message.error(error.response?.data?.error || 'Error fetching directory contents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line
  }, [currentPath]);

  // ===========================
  // FILTER LOGIC
  // ===========================
  // If we're at root (''), only show the "Research" folder (if it exists).
  // If we're inside "Research" (or deeper), show all items normally.
  let displayedItems = items;
  if (currentPath === '') {
    displayedItems = items.filter((item) => item.name === 'Research' && item.type === 'directory');
  }

  // Search filter
  const filteredItems = displayedItems.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ===========================
  // CREATE FOLDER
  // ===========================
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      message.error('Folder name cannot be empty');
      return;
    }
    try {
      await axios.post(
        '/create-directory',
        {
          name: newFolderName,
          parent: currentPath
        },
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

  // ===========================
  // NAVIGATION
  // ===========================
  const handleFolderClick = (folderName) => {
    const newPath = path.join(currentPath, folderName);
    setCurrentPath(newPath);
  };

  const handleGoUp = () => {
    // If at root, do nothing.
    if (currentPath === '') return;

    // If currently "Research", go back to root
    if (currentPath === 'Research') {
      setCurrentPath('');
      return;
    }
    // Else, normal "up" logic
    const parent = path.dirname(currentPath);
    setCurrentPath(parent === '.' ? '' : parent);
  };

  // ===========================
  // UPLOAD FILE
  // ===========================
  const customUpload = async ({ file, onSuccess, onError }) => {
    // Force user to pick a folder from dropdown
    if (!selectedFolder) {
      message.error('Please select a folder to upload your file.');
      onError(new Error('No folder selected'));
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('directory', selectedFolder);

    try {
      const res = await axios.post('/upload', formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success(res.data.message || 'File uploaded successfully');
      onSuccess(null, file);
      setFileToUpload(null);
      fetchItems();
    } catch (error) {
      console.error('Upload error:', error);
      onError(error);
      message.error('Error uploading file');
    }
  };

  // ===========================
  // DELETE
  // ===========================
  const handleDelete = async (record) => {
    try {
      await axios.delete('/delete-resource', {
        data: {
          resource_type: record.type,
          name: path.join(currentPath, record.name)
        },
        withCredentials: true
      });
      message.success(`${record.name} deleted successfully`);
      fetchItems();
    } catch (error) {
      console.error('Delete error:', error);
      message.error(error.response?.data?.error || `Error deleting ${record.name}`);
    }
  };

  // ===========================
  // DOWNLOAD
  // ===========================
  const handleDownload = (fileName) => {
    const fullPath = path.join(currentPath, fileName);
    window.open(`/download?filename=${encodeURIComponent(fullPath)}`, '_blank');
  };

  // ===========================
  // RENAME
  // ===========================
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
          new_name: path.join(currentPath, renameNewName)
        },
        { withCredentials: true }
      );
      message.success('Item renamed successfully');
      setRenameModalVisible(false);
      setSelectedItem(null);
      fetchItems();
    } catch (error) {
      console.error('Rename error:', error);
      message.error('Error renaming item');
    }
  };

  // ===========================
  // MOVE
  // ===========================
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
          destination: moveDestination
        },
        { withCredentials: true }
      );
      message.success('Item moved successfully');
      setMoveModalVisible(false);
      setSelectedItem(null);
      fetchItems();
    } catch (error) {
      console.error('Move error:', error);
      message.error('Error moving item');
    }
  };

  // ===========================
  // COPY
  // ===========================
  const handleCopyConfirm = async () => {
    if (!copyDestination.trim()) {
      message.error('Destination cannot be empty');
      return;
    }
    try {
      await axios.post(
        '/copy-resource',
        {
          file_name: path.join(currentPath, selectedItem.name),
          new_name: '',
          destination: copyDestination
        },
        { withCredentials: true }
      );
      message.success('Item copied successfully');
      setCopyModalVisible(false);
      setSelectedItem(null);
      fetchItems();
    } catch (error) {
      console.error('Copy error:', error);
      message.error('Error copying item');
    }
  };

  // ===========================
  // TABLE COLUMNS
  // ===========================
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
      render: (record) => {
        const isUploader = record.uploader === currentUser.username;
        return (
          <Space>
            {record.type === 'file' && (
              <Tooltip title="Download">
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownload(record.name)}
                />
              </Tooltip>
            )}
            {record.type === 'file' && (
              <Tooltip title="Copy">
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => {
                    setSelectedItem(record);
                    setCopyModalVisible(true);
                  }}
                />
              </Tooltip>
            )}
            {record.type === 'file' && isUploader && (
              <>
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
                <Tooltip title="Delete File">
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(record)}
                  />
                </Tooltip>
              </>
            )}
            {record.type === 'directory' && (
              <Tooltip title="Delete Folder">
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(record)}
                />
              </Tooltip>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content style={{ margin: '24px', padding: '24px', background: '#fff' }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            {/* Instead of "Back", go to your main dashboard (adjust as needed) */}
            <Button onClick={() => navigate('/user')}>Back to Dashboard</Button>
          </Col>
          <Col>
            <h2 style={{ margin: 0 }}>Research Dashboard</h2>
          </Col>
          <Col>
            <Upload
              customRequest={customUpload}
              showUploadList={false}
              onChange={({ file }) => setFileToUpload(file)}
            >
              <Button type="primary" icon={<UploadOutlined />}>
                Upload File
              </Button>
            </Upload>
          </Col>
        </Row>

        {fileToUpload && (
          <Card title="Selected File" bordered={false} style={{ marginBottom: 16 }}>
            <p>
              <strong>File Name:</strong> {fileToUpload.name}
            </p>
            <p>
              <strong>Target Folder:</strong> {selectedFolder || '(none selected)'}
            </p>
          </Card>
        )}

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col>
            <Button
              icon={<ArrowUpOutlined />}
              onClick={handleGoUp}
              disabled={currentPath === ''}
            >
              Go Up
            </Button>
          </Col>
          <Col>
            <Button icon={<FolderAddOutlined />} onClick={() => setCreateFolderModal(true)}>
              Create Folder
            </Button>
          </Col>
          <Col>
            {/* Folder dropdown for upload */}
            <Select
              value={selectedFolder}
              onChange={setSelectedFolder}
              placeholder="Select Folder for Upload"
              style={{ width: 200 }}
            >
              {filteredItems
                .filter((item) => item.type === 'directory')
                .map((folder, index) => {
                  const folderPath = path.join(currentPath, folder.name);
                  return (
                    <Select.Option key={index} value={folderPath}>
                      {folder.name}
                    </Select.Option>
                  );
                })}
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
                placeholder="e.g. Research/Archive"
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
                placeholder="e.g. Research/Backups"
              />
            </Form.Item>
          </Form>
        </Modal>
      </Content>
    </Layout>
  );
};

export default ResearchDashboard;

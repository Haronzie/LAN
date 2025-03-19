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
  Card,
  Breadcrumb
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  FolderAddOutlined,
  ArrowUpOutlined,
  EditOutlined,
  CopyOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import path from 'path-browserify';

const { Content } = Layout;
const { Option } = Select;

const TrainingDashboard = () => {
  const navigate = useNavigate();

  // 1. Current user from localStorage
  const [currentUser, setCurrentUser] = useState('');

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setCurrentUser(storedUsername);
    }
  }, []);

  // 2. Path & Items
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Create folder modal
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Upload
  const [selectedFolder, setSelectedFolder] = useState('');
  const [fileToUpload, setFileToUpload] = useState(null);

  // Rename
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [renameNewName, setRenameNewName] = useState('');

  // Copy
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [copyNewFileName, setCopyNewFileName] = useState('');
  const [copySelectedItem, setCopySelectedItem] = useState(null);

  // ==================================================
  // FETCH DIRECTORIES + FILES
  // ==================================================
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
      const files = Array.isArray(fileRes.data) ? fileRes.data : [];

      // Combine them
      setItems([...directories, ...files]);
    } catch (error) {
      console.error('Error fetching directory contents:', error);
      message.error(
        error.response?.data?.error || 'Error fetching directory contents'
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line
  }, [currentPath]);

  // Whenever currentPath changes, set selected folder for uploading
  useEffect(() => {
    setSelectedFolder(currentPath || '');
  }, [currentPath]);

  // ==================================================
  // SEARCH
  // ==================================================
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ==================================================
  // CREATE FOLDER
  // ==================================================
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

  // ==================================================
  // NAVIGATION & BREADCRUMBS
  // ==================================================
  const handleFolderClick = (folderName) => {
    const newPath = path.join(currentPath, folderName);
    setCurrentPath(newPath);
  };

  const handleGoUp = () => {
    if (!currentPath) return; // at root
    if (currentPath === 'Training') {
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
    const isLast = index === segments.length - 1;
    const partialPath = segments.slice(0, index + 1).join('/');
    breadcrumbItems.push(
      <Breadcrumb.Item key={index}>
        {isLast ? (
          seg
        ) : (
          <a onClick={() => setCurrentPath(partialPath)}>
            {seg}
          </a>
        )}
      </Breadcrumb.Item>
    );
  });

  // ==================================================
  // UPLOAD FILE
  // ==================================================
  const customUpload = async ({ file, onSuccess, onError }) => {
    if (!selectedFolder) {
      message.error('No folder selected for upload.');
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

  // ==================================================
  // DELETE
  // ==================================================
  const handleDelete = async (record) => {
    if (record.type === 'directory') {
      // Only the folder owner can delete
      if (record.created_by && record.created_by !== currentUser) {
        message.error('Only the folder owner can delete this folder.');
        return;
      }
      try {
        await axios.delete('/directory/delete', {
          data: { name: record.name, parent: currentPath },
          withCredentials: true
        });
        message.success(`${record.name} folder deleted successfully`);
        fetchItems();
      } catch (error) {
        console.error('Delete folder error:', error);
        message.error(
          error.response?.data?.error || `Error deleting folder '${record.name}'`
        );
      }
    } else if (record.type === 'file') {
      // Only the file uploader can delete
      if (record.uploader && record.uploader !== currentUser) {
        message.error('Only the uploader can delete this file.');
        return;
      }
      try {
        await axios.delete('/delete-file', {
          data: { filename: path.join(currentPath, record.name) },
          withCredentials: true
        });
        message.success(`${record.name} deleted successfully`);
        fetchItems();
      } catch (error) {
        console.error('Delete file error:', error);
        message.error(
          error.response?.data?.error || `Error deleting file '${record.name}'`
        );
      }
    }
  };

  // ==================================================
  // DOWNLOAD
  // ==================================================
  const handleDownload = (fileName) => {
    // If your backend is on port 8080:
    const downloadUrl = `http://localhost:8080/download?filename=${encodeURIComponent(fileName)}`;
    window.open(downloadUrl, '_blank');
  };

  // ==================================================
  // RENAME
  // ==================================================
  const handleRename = (record) => {
    setSelectedItem(record);
    setRenameNewName(record.name);
    setRenameModalVisible(true);
  };

  const handleRenameConfirm = async () => {
    if (!renameNewName.trim()) {
      message.error('New name cannot be empty');
      return;
    }
    if (!selectedItem) return;

    const oldName = selectedItem.name;
    try {
      if (selectedItem.type === 'directory') {
        await axios.put(
          '/directory/rename',
          {
            old_name: oldName,
            new_name: renameNewName,
            parent: currentPath
          },
          { withCredentials: true }
        );
      } else {
        await axios.put(
          '/file/rename',
          {
            old_filename: path.join(currentPath, oldName),
            new_filename: renameNewName
          },
          { withCredentials: true }
        );
      }
      message.success(`Renamed '${oldName}' to '${renameNewName}'`);
      setRenameModalVisible(false);
      setSelectedItem(null);
      fetchItems();
    } catch (error) {
      console.error('Rename error:', error);
      message.error(error.response?.data?.error || 'Error renaming item');
    }
  };

  // ==================================================
  // COPY (FILES ONLY)
  // ==================================================
  const handleCopy = (record) => {
    if (record.type !== 'file') {
      message.error('Copying directories is not supported by the current backend.');
      return;
    }
    setCopySelectedItem(record);
    setCopyNewFileName(`Copy_of_${record.name}`);
    setCopyModalVisible(true);
  };

  const handleCopyConfirm = async () => {
    if (!copyNewFileName.trim()) {
      message.error('New file name cannot be empty');
      return;
    }
    if (!copySelectedItem) return;

    const oldName = copySelectedItem.name;
    try {
      await axios.post(
        '/copy-file',
        {
          source_file: path.join(currentPath, oldName),
          new_file_name: copyNewFileName
        },
        { withCredentials: true }
      );
      message.success(`Copied '${oldName}' to '${copyNewFileName}'`);
      setCopyModalVisible(false);
      setCopySelectedItem(null);
      fetchItems();
    } catch (error) {
      console.error('Copy error:', error);
      message.error(error.response?.data?.error || 'Error copying file');
    }
  };

  // ==================================================
  // TABLE COLUMNS
  // ==================================================
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
      title: 'Size (KB)',
      dataIndex: 'size',
      key: 'size',
      render: (size, record) =>
        record.type === 'directory'
          ? '--'
          : size
          ? (size / 1024).toFixed(2)
          : '0.00'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record) => {
        // Check ownership
        const isFolderOwner =
          record.type === 'directory' && record.created_by === currentUser;
        const isFileOwner =
          record.type === 'file' && record.uploader === currentUser;

        return (
          <Space>
            {/* DOWNLOAD (file only) */}
            {record.type === 'file' && (
              <Tooltip title="Download">
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownload(record.name)}
                />
              </Tooltip>
            )}

            {/* COPY (file only) */}
            {record.type === 'file' && (
              <Tooltip title="Copy">
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => handleCopy(record)}
                />
              </Tooltip>
            )}

            {/* RENAME (only owner) */}
            {(isFolderOwner || isFileOwner) && (
              <Tooltip title="Rename">
                <Button
                  icon={<EditOutlined />}
                  onClick={() => handleRename(record)}
                />
              </Tooltip>
            )}

            {/* DELETE (only owner) */}
            {(isFolderOwner || isFileOwner) && (
              <Tooltip
                title={record.type === 'directory' ? 'Delete Folder' : 'Delete File'}
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(record)}
                />
              </Tooltip>
            )}

            {/* If not owner, disable the delete button */}
            {record.type === 'directory' && !isFolderOwner && (
              <Tooltip title="Only the folder owner can delete this folder">
                <Button disabled danger icon={<DeleteOutlined />} />
              </Tooltip>
            )}
            {record.type === 'file' && !isFileOwner && (
              <Tooltip title="Only the uploader can delete this file">
                <Button disabled danger icon={<DeleteOutlined />} />
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
        {/* Top bar */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Button onClick={() => navigate('/user')}>Back to Dashboard</Button>
          </Col>
          <Col>
            <h2 style={{ margin: 0 }}>Training Dashboard</h2>
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
              <strong>Target Folder:</strong> {selectedFolder || '(none)'}
            </p>
          </Card>
        )}

        {/* Navigation Row */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col>
            <Button
              icon={<ArrowUpOutlined />}
              onClick={handleGoUp}
              disabled={!currentPath}
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

        {/* Copy Modal (files only) */}
        <Modal
          title="Copy File"
          visible={copyModalVisible}
          onOk={handleCopyConfirm}
          onCancel={() => setCopyModalVisible(false)}
          okText="Copy"
        >
          <Form layout="vertical">
            <Form.Item label="New File Name" required>
              <Input
                value={copyNewFileName}
                onChange={(e) => setCopyNewFileName(e.target.value)}
                placeholder="Copy_of_myfile.pdf"
              />
            </Form.Item>
          </Form>
        </Modal>
      </Content>
    </Layout>
  );
};

export default TrainingDashboard;

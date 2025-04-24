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
  Select,
  Popconfirm,
  Tooltip,
  Form,
  Space
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ArrowLeftOutlined,
  CopyOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
const BASE_URL = `${window.location.protocol}//${window.location.hostname}:8081`;
axios.defaults.baseURL = BASE_URL;

const { Content } = Layout;
const { Option } = Select;

const UserFileManager = () => {
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [currentUsername, setCurrentUsername] = useState('');

  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [copyModalVisible, setCopyModalVisible] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [renameNewName, setRenameNewName] = useState('');
  const [moveDestination, setMoveDestination] = useState('');
  const [copyNewName, setCopyNewName] = useState('');
  const [copyDestination, setCopyDestination] = useState('');

  const navigate = useNavigate();

  const fetchFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await axios.get('/files', { withCredentials: true });
      setFiles(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      message.error('Error fetching files');
    } finally {
      setLoadingFiles(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await axios.get('/api/user/profile', { withCredentials: true });
      setCurrentUsername(res.data.username);
    } catch (error) {
      console.error('Error fetching user profile', error);
    }
  };

  const checkFileAccess = (file) => {
    return (
      !file.confidential ||
      file.uploader === currentUsername ||
      (file.permissions && file.permissions.includes(currentUsername))
    );
  };

  useEffect(() => {
    fetchFiles();
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    const visibleFiles = files.filter(checkFileAccess);
    const searched = term
      ? visibleFiles.filter(f => f.file_name.toLowerCase().includes(term))
      : visibleFiles;
    setFilteredFiles(searched);
  }, [searchTerm, files, currentUsername]);

  const handleDeleteFile = async (fileName) => {
    try {
      await axios.delete('/delete-resource', {
        data: { resource_type: 'file', name: fileName },
        withCredentials: true
      });
      message.success(`File '${fileName}' deleted successfully`);
      fetchFiles();
    } catch (error) {
      message.error('Error deleting file');
    }
  };

  const handleRenameConfirm = async () => {
    try {
      await axios.put(
        '/rename-resource',
        {
          resource_type: 'file',
          old_name: selectedFile,
          new_name: renameNewName,
        },
        { withCredentials: true }
      );
      message.success('File renamed successfully');
      setRenameModalVisible(false);
      fetchFiles();
    } catch (error) {
      message.error('Error renaming file');
    }
  };

  const handleMoveConfirm = async () => {
    try {
      await axios.put(
        '/move-resource',
        {
          resource_type: 'file',
          source: selectedFile,
          destination: moveDestination,
        },
        { withCredentials: true }
      );
      message.success('File moved successfully');
      setMoveModalVisible(false);
      fetchFiles();
    } catch (error) {
      message.error('Error moving file');
    }
  };

  const handleCopyConfirm = async () => {
    try {
      await axios.post(
        '/copy-resource',
        {
          file_name: selectedFile,
          new_name: copyNewName,
          destination: copyDestination,
        },
        { withCredentials: true }
      );
      message.success('File copied successfully');
      setCopyModalVisible(false);
      fetchFiles();
    } catch (error) {
      message.error('Error copying file');
    }
  };

  const customUpload = async ({ file, onSuccess, onError }) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post('/upload', formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success(res.data.message || 'File uploaded successfully');
      onSuccess(null, file);
      fetchFiles();
    } catch (error) {
      message.error('Error uploading file');
      onError(error);
    }
  };

  const columns = [
    {
      title: 'File Name',
      dataIndex: 'file_name',
      key: 'file_name'
    },
    {
      title: 'Size (KB)',
      dataIndex: 'size',
      key: 'size',
      render: size => (size / 1024).toFixed(2)
    },
    {
      title: 'Uploader',
      dataIndex: 'uploader',
      key: 'uploader'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record) => {
        const isUploader = record.uploader === currentUsername;
        return (
          <Space>
            <Tooltip title="Download File">
              <Button
                icon={<DownloadOutlined />}
                onClick={() => {
                  const downloadUrl = `${window.location.origin}/download?filename=${encodeURIComponent(record.file_name)}`;
                  window.open(downloadUrl, '_blank');
                }}
              />
            </Tooltip>
            <Tooltip title="Copy File">
              <Button
                icon={<CopyOutlined />}
                onClick={() => {
                  setSelectedFile(record.file_name);
                  setCopyNewName('');
                  setCopyDestination('');
                  setCopyModalVisible(true);
                }}
              />
            </Tooltip>
            {isUploader && (
              <>
                <Popconfirm
                  title={`Delete file '${record.file_name}'?`}
                  onConfirm={() => handleDeleteFile(record.file_name)}
                  okText="Yes"
                  cancelText="No"
                >
                  <Tooltip title="Delete File">
                    <Button danger icon={<DeleteOutlined />} />
                  </Tooltip>
                </Popconfirm>
                <Tooltip title="Rename File">
                  <Button
                    onClick={() => {
                      setSelectedFile(record.file_name);
                      setRenameNewName(record.file_name);
                      setRenameModalVisible(true);
                    }}
                  >
                    Rename
                  </Button>
                </Tooltip>
                <Tooltip title="Move File">
                  <Button
                    onClick={() => {
                      setSelectedFile(record.file_name);
                      setMoveDestination(record.file_name);
                      setMoveModalVisible(true);
                    }}
                  >
                    Move
                  </Button>
                </Tooltip>
              </>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <Content style={{ padding: 24, background: '#fff', minHeight: 360 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <h2 style={{ margin: 0 }}>File Manager</h2>
        </Col>
        <Col>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/user')}
            style={{ marginRight: 8 }}
          >
            Back to Dashboard
          </Button>
          <Upload customRequest={customUpload} showUploadList={false}>
            <Button type="primary" icon={<UploadOutlined />}>
              Upload File
            </Button>
          </Upload>
        </Col>
      </Row>

      <Row style={{ marginBottom: 16 }} justify="start">
        <Col>
          <Input
            placeholder="Search files..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            allowClear
            style={{ width: 300 }}
          />
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={filteredFiles}
        rowKey="file_name"
        loading={loadingFiles}
        pagination={{ pageSize: 10 }}
      />

      {/* Rename Modal */}
      <Modal
        title="Rename File"
        visible={renameModalVisible}
        onOk={handleRenameConfirm}
        onCancel={() => setRenameModalVisible(false)}
        okText="Rename"
      >
        <Form layout="vertical">
          <Form.Item label="New File Name">
            <Input
              placeholder="Enter new file name"
              value={renameNewName}
              onChange={e => setRenameNewName(e.target.value)}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Move Modal */}
      <Modal
        title="Move File"
        visible={moveModalVisible}
        onOk={handleMoveConfirm}
        onCancel={() => setMoveModalVisible(false)}
        okText="Move"
      >
        <Form layout="vertical">
          <Form.Item label="Destination Directory">
            <Select
              style={{ width: '100%' }}
              onChange={(value) => {
                if (value === 'root') {
                  setMoveDestination(selectedFile);
                } else {
                  setMoveDestination(`${value}/${selectedFile}`);
                }
              }}
              placeholder="Select destination directory"
            >
              <Option value="root">Root (uploads)</Option>
              <Option value="Documents">Documents</Option>
              <Option value="Images">Images</Option>
              <Option value="Archives">Archives</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Copy Modal */}
      <Modal
        title="Copy File"
        visible={copyModalVisible}
        onOk={handleCopyConfirm}
        onCancel={() => setCopyModalVisible(false)}
        okText="Copy"
      >
        <Form layout="vertical">
          <Form.Item label="New File Name (optional)">
            <Input
              placeholder="Leave empty to keep original name"
              value={copyNewName}
              onChange={e => setCopyNewName(e.target.value)}
            />
          </Form.Item>
          <Form.Item label="Destination Directory (required)">
            <Input
              placeholder="e.g. 'Documents', 'Images'"
              value={copyDestination}
              onChange={e => setCopyDestination(e.target.value)}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Content>
  );
};

export default UserFileManager;

import React, { useState, useEffect } from 'react';
import { Layout, Table, Button, Upload, message, Input, Row, Col, Modal, Select } from 'antd';
import { UploadOutlined, DeleteOutlined, DownloadOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Content } = Layout;

const UserFileManager = () => {
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [currentUsername, setCurrentUsername] = useState('');

  // New state variables for Rename and Move modals
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [renameNewName, setRenameNewName] = useState('');
  const [moveDestination, setMoveDestination] = useState('');

  const navigate = useNavigate();

  // Fetch files from the API
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

  // Fetch current user's profile to get username
  const fetchCurrentUser = async () => {
    try {
      const res = await axios.get('/api/user/profile', { withCredentials: true });
      setCurrentUsername(res.data.username);
    } catch (error) {
      console.error("Error fetching user profile", error);
    }
  };

  useEffect(() => {
    fetchFiles();
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    setFilteredFiles(term ? files.filter(f => f.file_name.toLowerCase().includes(term)) : files);
  }, [searchTerm, files]);

  const handleDeleteFile = async (fileName) => {
    try {
      await axios.delete('/delete-resource', { data: { resource_type: 'file', name: fileName }, withCredentials: true });
      message.success(`File '${fileName}' deleted successfully`);
      fetchFiles();
    } catch (error) {
      message.error('Error deleting file');
    }
  };

  // Function to handle renaming a file
  const handleRenameConfirm = async () => {
    try {
      await axios.put('/rename-resource', {
        resource_type: 'file',
        old_name: selectedFile,
        new_name: renameNewName,
      }, { withCredentials: true });
      message.success(`File renamed successfully`);
      setRenameModalVisible(false);
      fetchFiles();
    } catch (error) {
      message.error('Error renaming file');
    }
  };

  // Function to handle moving a file
  const handleMoveConfirm = async () => {
    try {
      await axios.put('/move-resource', {
        resource_type: 'file',
        source: selectedFile,
        destination: moveDestination,
      }, { withCredentials: true });
      message.success(`File moved successfully`);
      setMoveModalVisible(false);
      fetchFiles();
    } catch (error) {
      message.error('Error moving file');
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
        // Only the uploader gets to see additional buttons.
        const isUploader = record.uploader === currentUsername;
        return (
          <>
            <Button icon={<DownloadOutlined />} onClick={() => window.open(`/download?filename=${record.file_name}`, '_blank')}>
              Download
            </Button>
            {isUploader && (
              <>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteFile(record.file_name)}
                  style={{ marginLeft: 8 }}
                >
                  Delete
                </Button>
                <Button
                  onClick={() => {
                    setSelectedFile(record.file_name);
                    setRenameNewName(record.file_name);
                    setRenameModalVisible(true);
                  }}
                  style={{ marginLeft: 8 }}
                >
                  Rename
                </Button>
                <Button
                  onClick={() => {
                    setSelectedFile(record.file_name);
                    setMoveDestination(record.file_name);
                    setMoveModalVisible(true);
                  }}
                  style={{ marginLeft: 8 }}
                >
                  Move
                </Button>
              </>
            )}
          </>
        );
      }
    }
  ];

  // Custom upload function
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

  return (
    <div style={{ padding: 24, background: '#fff', minHeight: 360 }}>
      <Row justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </Col>
        <Col>
          <h2>File Manager</h2>
        </Col>
        <Col>
          <Button type="primary">
            <Upload customRequest={customUpload} showUploadList={false}>
              <UploadOutlined /> Upload File
            </Upload>
          </Button>
        </Col>
      </Row>
      <Input
        placeholder="Search files"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{ width: 300, marginBottom: 16 }}
      />
      <Table columns={columns} dataSource={filteredFiles} rowKey="file_name" loading={loadingFiles} pagination={{ pageSize: 10 }} />

      {/* Rename Modal */}
      <Modal
        title="Rename File"
        visible={renameModalVisible}
        onOk={handleRenameConfirm}
        onCancel={() => setRenameModalVisible(false)}
      >
        <Input
          placeholder="Enter new file name"
          value={renameNewName}
          onChange={e => setRenameNewName(e.target.value)}
        />
      </Modal>

      {/* Move Modal */}
      <Modal
        title="Move File"
        visible={moveModalVisible}
        onOk={handleMoveConfirm}
        onCancel={() => setMoveModalVisible(false)}
      >
        <Select
          placeholder="Select destination directory"
          style={{ width: '100%' }}
          onChange={(value) => {
            if (value === 'root') {
              setMoveDestination(selectedFile);
            } else {
              setMoveDestination(`${value}/${selectedFile}`);
            }
          }}
        >
          <Select.Option value="root">Root (uploads)</Select.Option>
          <Select.Option value="Documents">Documents</Select.Option>
          <Select.Option value="Images">Images</Select.Option>
          <Select.Option value="Archives">Archives</Select.Option>
        </Select>
      </Modal>
    </div>
  );
};

export default UserFileManager;

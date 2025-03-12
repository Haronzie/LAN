import React, { useState, useEffect } from 'react';
import { Layout, Table, Button, Upload, message, Input, Row, Col } from 'antd';
import { UploadOutlined, DeleteOutlined, DownloadOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Content } = Layout;

const FileManager = () => {
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredFiles, setFilteredFiles] = useState([]);
  
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

  useEffect(() => {
    fetchFiles();
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
      render: (record) => (
        <>
          <Button icon={<DownloadOutlined />} onClick={() => window.open(`/download?filename=${record.file_name}`, '_blank')}>
            Download
          </Button>
          <Button danger icon={<DeleteOutlined />} onClick={() => handleDeleteFile(record.file_name)}>
            Delete
          </Button>
        </>
      )
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
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin')}>
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
    </div>
  );
};

export default FileManager;

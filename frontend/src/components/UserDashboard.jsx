// src/components/UserDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Button, Form, Upload, Spin, List, Row, Col, Input, message } from 'antd';
import { UploadOutlined, DownloadOutlined, DeleteOutlined } from '@ant-design/icons';

const { Header, Content } = Layout;

const UserDashboard = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Retrieve logged-in user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser) {
      const userObj = JSON.parse(storedUser);
      // If the user is admin, redirect to the admin dashboard
      if (userObj.role && userObj.role === 'admin') {
        navigate('/admin-dashboard');
      } else {
        setLoggedInUser(userObj);
      }
    }
  }, [navigate]);

  // Fetch files from the back-end
  const fetchFiles = useCallback(async () => {
    if (!loggedInUser) {
      message.error('You must be logged in to view files.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/files');
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      const data = await response.json();
      setFiles(data || []);
    } catch (err) {
      message.error(err.message);
    }
    setIsLoading(false);
  }, [loggedInUser]);

  useEffect(() => {
    if (loggedInUser) {
      fetchFiles();
    }
  }, [loggedInUser, fetchFiles]);

  // Handle file upload
  const handleUpload = async () => {
    if (!loggedInUser) {
      message.error('You must be logged in to upload a file.');
      return;
    }
    if (!uploadFile) {
      message.error('Please select a file to upload.');
      return;
    }
    const formData = new FormData();
    formData.append('file', uploadFile);
    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to upload file');
      }
      await response.json();
      message.success(`File "${uploadFile.name}" uploaded successfully`);
      setUploadFile(null);
      fetchFiles();
    } catch (err) {
      message.error(err.message);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      const response = await fetch('/logout', { method: 'POST' });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to logout');
      }
      const data = await response.json();
      message.success(data.message);
      localStorage.removeItem('loggedInUser');
      navigate('/login');
    } catch (err) {
      message.error(err.message);
    }
  };

  // Handle file download
  const handleDownload = async (fileName) => {
    try {
      const response = await fetch(`/download?filename=${encodeURIComponent(fileName)}`);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to download file');
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success(`File "${fileName}" downloaded successfully.`);
    } catch (err) {
      message.error(err.message);
    }
  };

  // Handle file deletion
  const handleDelete = async (fileName) => {
    if (!loggedInUser) {
      message.error('You must be logged in to delete a file.');
      return;
    }
    try {
      const response = await fetch('/delete-file', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_name: fileName }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to delete file');
      }
      const data = await response.json();
      message.success(data.message);
      fetchFiles();
    } catch (err) {
      message.error(err.message);
    }
  };

  // Filter files by search term
  const filteredFiles = files.filter((f) =>
    f.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          backgroundColor: '#001529',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 style={{ color: '#fff', margin: 0 }}>User Dashboard</h2>
        <Button type="primary" onClick={handleLogout}>
          Logout
        </Button>
      </Header>
      <Content style={{ padding: '1rem' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <h3>Files</h3>
            <Input.Search
              placeholder="Search files by name"
              allowClear
              onSearch={(value) => setSearchTerm(value)}
              style={{ marginBottom: 16 }}
            />
            <Spin spinning={isLoading}>
              {filteredFiles.length === 0 ? (
                <p>No files found.</p>
              ) : (
                <List
                  dataSource={filteredFiles}
                  renderItem={(file) => (
                    <List.Item
                      actions={[
                        <Button
                          icon={<DownloadOutlined />}
                          size="small"
                          onClick={() => handleDownload(file.file_name)}
                        >
                          Download
                        </Button>,
                        loggedInUser && loggedInUser.username === file.uploader ? (
                          <Button
                            icon={<DeleteOutlined />}
                            size="small"
                            danger
                            onClick={() => handleDelete(file.file_name)}
                          >
                            Delete
                          </Button>
                        ) : null,
                      ]}
                    >
                      <List.Item.Meta
                        title={file.file_name}
                        description={`Size: ${file.size} bytes - Uploaded by: ${file.uploader}`}
                      />
                    </List.Item>
                  )}
                />
              )}
            </Spin>
          </Col>
          <Col xs={24} md={8}>
            <h3>Upload File</h3>
            <Form layout="vertical" onFinish={handleUpload}>
              <Form.Item label="Select File">
                <Upload
                  beforeUpload={(file) => {
                    setUploadFile(file);
                    return false; // Prevent auto-upload
                  }}
                  fileList={uploadFile ? [uploadFile] : []}
                  onRemove={() => setUploadFile(null)}
                >
                  <Button icon={<UploadOutlined />}>Select File</Button>
                </Upload>
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block>
                  Upload
                </Button>
              </Form.Item>
            </Form>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
};

export default UserDashboard;

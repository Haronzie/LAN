// src/components/AdminDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout,
  Tabs,
  Button,
  Table,
  Form,
  Input,
  Upload,
  Spin,
  message,
} from 'antd';
import { UploadOutlined, DownloadOutlined, DeleteOutlined } from '@ant-design/icons';

const { Header, Content } = Layout;
const { TabPane } = Tabs;

const AdminDashboard = () => {
  const navigate = useNavigate();

  // State declarations
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  // Store the entire logged in user object (including role)
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState(''); // search for users
  const [fileSearchTerm, setFileSearchTerm] = useState(''); // search for files

  // Get current logged in user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser) {
      // Now store the whole object (e.g., { username, role })
      const userObj = JSON.parse(storedUser);
      if (userObj && userObj.username) {
        setCurrentUser(userObj);
      }
    }
  }, []);

  // Fetch users from back-end
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      message.error(err.message);
    }
    setIsLoading(false);
  }, []);

  // Fetch files from back-end
  const fetchFiles = useCallback(async () => {
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
  }, []);

  // Refresh data on tab change
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
    if (activeTab === 'files') {
      fetchFiles();
    }
  }, [activeTab, fetchUsers, fetchFiles]);

  // Handler for adding a user via Form (values: { newUsername, newPassword })
  const handleAddUser = async (values) => {
    try {
      const response = await fetch('/add-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: values.newUsername,
          password: values.newPassword,
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to add user');
      }
      const data = await response.json();
      message.success(data.message);
      fetchUsers();
    } catch (err) {
      message.error(err.message);
    }
  };

  // Handler for updating a user (values: { oldUsername, updatedUsername, updatedPassword })
  const handleUpdateUser = async (values) => {
    if (
      !values.oldUsername.trim() ||
      !values.updatedUsername.trim() ||
      !values.updatedPassword.trim()
    ) {
      message.error("Old username, new username, and new password are required.");
      return;
    }
    const userExists = users.some((u) =>
      u.username
        ? u.username.toLowerCase() === values.oldUsername.trim().toLowerCase()
        : false
    );
    if (!userExists) {
      message.error("User does not exist.");
      return;
    }
    if (
      values.oldUsername.trim().toLowerCase() ===
      values.updatedUsername.trim().toLowerCase()
    ) {
      message.error("New username must be different from the old username.");
      return;
    }
    const usernameTaken = users.some((u) =>
      u.username
        ? u.username.toLowerCase() === values.updatedUsername.trim().toLowerCase() &&
          u.username.toLowerCase() !== values.oldUsername.trim().toLowerCase()
        : false
    );
    if (usernameTaken) {
      message.error("New username is already taken.");
      return;
    }
    try {
      const response = await fetch('/update-user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_username: values.oldUsername,
          new_username: values.updatedUsername,
          new_password: values.updatedPassword,
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to update user');
      }
      const data = await response.json();
      message.success(data.message);
      fetchUsers();
      if (
        values.oldUsername.trim().toLowerCase() === currentUser.username.trim().toLowerCase()
      ) {
        localStorage.removeItem('loggedInUser');
        navigate('/login');
      }
    } catch (err) {
      message.error(err.message);
    }
  };

  // Handler for deleting a user (values: { deleteUsername })
  const handleDeleteUser = async (values) => {
    const trimmedUsername = values.deleteUsername.trim().toLowerCase();
    if (trimmedUsername === currentUser.username.trim().toLowerCase()) {
      message.error("Cannot delete your own admin account. Please assign another admin first.");
      return;
    }
    if (!users || users.length === 0) {
      message.error("No users available.");
      return;
    }
    const userExists = users.some((u) =>
      u.username ? u.username.toLowerCase() === trimmedUsername : false
    );
    if (!userExists) {
      message.error("User does not exist.");
      return;
    }
    try {
      const response = await fetch('/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: values.deleteUsername }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to delete user');
      }
      const data = await response.json();
      message.success(data.message);
      fetchUsers();
    } catch (err) {
      message.error(err.message);
    }
  };

  // Handler for assigning admin role (values: { assignUsername })
  const handleAssignAdmin = async (values) => {
    try {
      const response = await fetch('/assign-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: values.assignUsername }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to assign admin');
      }
      const data = await response.json();
      message.success(data.message);
      fetchUsers();
    } catch (err) {
      message.error(err.message);
    }
  };

  // Handler for uploading a file. Uses state uploadFile set via Upload component.
  const handleFileUpload = async () => {
    if (!uploadFile) {
      message.error('Please select a file to upload.');
      return;
    }
    const fileName = uploadFile.name;
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
      message.success(`File "${fileName}" uploaded successfully`);
      setUploadFile(null);
      fetchFiles();
    } catch (err) {
      message.error(err.message);
    }
  };

  // Handler for downloading a file
  const handleDownload = async (file) => {
    try {
      const response = await fetch(`/download?filename=${encodeURIComponent(file.file_name)}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Download failed');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      message.error(err.message);
    }
  };

  // Handler for deleting a file
  const handleDeleteFile = async (file) => {
    if (currentUser.role !== 'admin' && currentUser.username.trim() !== file.uploader.trim()) {
      message.error('You are not allowed to delete this file.');
      return;
    }
    try {
      const response = await fetch('/delete-file', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_name: file.file_name }),
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

  // Logout handler
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

  // Define columns for the Users table
  const userColumns = [
    { title: 'Username', dataIndex: 'username', key: 'username' },
    { title: 'Role', dataIndex: 'role', key: 'role' },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      render: (active) => (active ? 'Active' : 'Inactive'),
    },
  ];
  

  // Define columns for the Files table
  const fileColumns = [
    { title: 'File Name', dataIndex: 'file_name', key: 'file_name' },
    { title: 'Size (bytes)', dataIndex: 'size', key: 'size' },
    { title: 'Uploader', dataIndex: 'uploader', key: 'uploader' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <>
          <Button
            icon={<DownloadOutlined />}
            size="small"
            onClick={() => handleDownload(record)}
            style={{ marginRight: 8 }}
          >
            Download
          </Button>
          {(currentUser && (currentUser.role === 'admin' || currentUser.username.trim() === record.uploader.trim())) && (
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
              onClick={() => handleDeleteFile(record)}
            >
              Delete
            </Button>
          )}
        </>
      ),
    },
  ];

  // Filter users based on search term (case-insensitive)
  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter files based on file search term (case-insensitive)
  const filteredFiles = files.filter(file =>
    file.file_name.toLowerCase().includes(fileSearchTerm.toLowerCase())
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#001529',
        }}
      >
        <h2 style={{ color: '#fff', margin: 0 }}>Admin Dashboard</h2>
        <Button type="primary" onClick={handleLogout}>
          Logout
        </Button>
      </Header>
      <Content style={{ padding: '1rem' }}>
        <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key)}>
          <TabPane tab="View Users" key="users">
            <h3>User List</h3>
            <Input.Search
              placeholder="Search users by username"
              allowClear
              onSearch={(value) => setSearchTerm(value)}
              style={{ marginBottom: 16, maxWidth: 300 }}
            />
            <Spin spinning={isLoading}>
              {filteredUsers && filteredUsers.length > 0 ? (
                <Table
                  dataSource={filteredUsers}
                  columns={userColumns}
                  rowKey="username"
                  pagination={false}
                />
              ) : (
                <p>No users found.</p>
              )}
            </Spin>
          </TabPane>
          <TabPane tab="View Files" key="files">
            <h3>Files</h3>
            <Input.Search
              placeholder="Search files by name"
              allowClear
              onSearch={(value) => setFileSearchTerm(value)}
              style={{ marginBottom: 16, maxWidth: 300 }}
            />
            <Spin spinning={isLoading}>
              {filteredFiles && filteredFiles.length > 0 ? (
                <Table
                  dataSource={filteredFiles}
                  columns={fileColumns}
                  rowKey="file_name"
                  pagination={false}
                />
              ) : (
                <p>No files found.</p>
              )}
            </Spin>
          </TabPane>
          <TabPane tab="Add User" key="addUser">
            <h3>Add User</h3>
            <Form layout="vertical" onFinish={handleAddUser}>
              <Form.Item
                label="Username"
                name="newUsername"
                rules={[{ required: true, message: 'Please input username' }]}
              >
                <Input placeholder="Enter username" />
              </Form.Item>
              <Form.Item
                label="Password"
                name="newPassword"
                rules={[{ required: true, message: 'Please input password' }]}
              >
                <Input.Password placeholder="Enter password" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">
                  Add User
                </Button>
              </Form.Item>
            </Form>
          </TabPane>
          <TabPane tab="Update User" key="updateUser">
            <h3>Update User</h3>
            <Form layout="vertical" onFinish={handleUpdateUser}>
              <Form.Item
                label="Old Username"
                name="oldUsername"
                rules={[{ required: true, message: 'Please input old username' }]}
              >
                <Input placeholder="Enter old username" />
              </Form.Item>
              <Form.Item
                label="New Username"
                name="updatedUsername"
                rules={[{ required: true, message: 'Please input new username' }]}
              >
                <Input placeholder="Enter new username" />
              </Form.Item>
              <Form.Item
                label="New Password"
                name="updatedPassword"
                rules={[{ required: true, message: 'Please input new password' }]}
              >
                <Input.Password placeholder="Enter new password" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">
                  Update User
                </Button>
              </Form.Item>
            </Form>
          </TabPane>
          <TabPane tab="Delete User" key="deleteUser">
            <h3>Delete User</h3>
            <Form layout="vertical" onFinish={handleDeleteUser}>
              <Form.Item
                label="Username"
                name="deleteUsername"
                rules={[{ required: true, message: 'Please input username to delete' }]}
              >
                <Input placeholder="Enter username" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" danger htmlType="submit">
                  Delete User
                </Button>
              </Form.Item>
            </Form>
          </TabPane>
          <TabPane tab="Assign Admin" key="assignAdmin">
            <h3>Assign Admin Role</h3>
            <Form layout="vertical" onFinish={handleAssignAdmin}>
              <Form.Item
                label="Username"
                name="assignUsername"
                rules={[{ required: true, message: 'Please input username' }]}
              >
                <Input placeholder="Enter username" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">
                  Assign Admin
                </Button>
              </Form.Item>
            </Form>
          </TabPane>
          <TabPane tab="Upload File" key="uploadFile">
            <h3>Upload File</h3>
            <Form layout="vertical" onFinish={handleFileUpload}>
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
                <Button type="primary" htmlType="submit">
                  Upload
                </Button>
              </Form.Item>
            </Form>
          </TabPane>
        </Tabs>
      </Content>
    </Layout>
  );
};

export default AdminDashboard;

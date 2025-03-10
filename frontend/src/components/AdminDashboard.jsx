// src/components/AdminDashboard.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout,
  Menu,
  Button,
  Table,
  Form,
  Input,
  Upload,
  Spin,
  message,
  Card,
} from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  UserOutlined,
  FileOutlined,
  PlusOutlined,
  EditOutlined,
  UserDeleteOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;
const SIDEBAR_WIDTH = 200; // fixed sidebar width

const AdminDashboard = () => {
  const navigate = useNavigate();

  // Menu selection state
  const [selectedMenu, setSelectedMenu] = useState('viewUsers');

  // State for user management
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // State for file management
  const [files, setFiles] = useState([]);
  const [fileSearchTerm, setFileSearchTerm] = useState('');
  const [uploadFile, setUploadFile] = useState(null);

  // Current logged-in user
  const [currentUser, setCurrentUser] = useState(null);

  // Get current logged-in user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser) {
      const userObj = JSON.parse(storedUser);
      if (userObj && userObj.username) {
        setCurrentUser(userObj);
      }
    }
  }, []);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/users', { credentials: 'include' });
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

  // Fetch files
  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/files', { credentials: 'include' });
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

  // Decide what data to fetch based on selectedMenu
  useEffect(() => {
    if (selectedMenu === 'viewUsers') {
      fetchUsers();
    } else if (selectedMenu === 'viewFiles') {
      fetchFiles();
    }
  }, [selectedMenu, fetchUsers, fetchFiles]);

  // ========== Handlers for User Management ==========
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

  const handleUpdateUser = async (values) => {
    if (
      !values.oldUsername.trim() ||
      !values.updatedUsername.trim() ||
      !values.updatedPassword.trim()
    ) {
      message.error('Old username, new username, and new password are required.');
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
        values.oldUsername.trim().toLowerCase() ===
        currentUser?.username.trim().toLowerCase()
      ) {
        localStorage.removeItem('loggedInUser');
        navigate('/login');
      }
    } catch (err) {
      message.error(err.message);
    }
  };

  const handleDeleteUser = async (values) => {
    const trimmedUsername = values.deleteUsername.trim().toLowerCase();
    if (currentUser && trimmedUsername === currentUser.username.trim().toLowerCase()) {
      message.error(
        'Cannot delete your own admin account. Please assign another admin first.'
      );
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

  // ========== Handlers for File Management ==========
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

  const handleDownload = async (file) => {
    try {
      const response = await fetch(
        `/download?filename=${encodeURIComponent(file.file_name)}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );
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

  const handleDeleteFile = async (file) => {
    if (
      currentUser?.role !== 'admin' &&
      currentUser?.username.trim() !== file.uploader.trim()
    ) {
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

  // ========== Table Definitions ==========

  // The "No." column references "row_num" which we will set in a sorted array below.
  const userColumns = [
    { title: 'No.', dataIndex: 'row_num', key: 'row_num', width: 60 },
    { title: 'Username', dataIndex: 'username', key: 'username' },
    { title: 'Role', dataIndex: 'role', key: 'role' },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      render: (active) => (active ? 'Active' : 'Inactive'),
    },
  ];

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
          {currentUser &&
            (currentUser.role === 'admin' ||
              currentUser.username.trim() === record.uploader.trim()) && (
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

  // ========== Filtered Data ==========

  // Basic filtering by searchTerm
  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort admins first, then alphabetical by username. Assign row_num after sorting.
  const sortedAndNumberedUsers = useMemo(() => {
    // Make a copy so we don't mutate state
    const copied = [...filteredUsers];

    // Sort: admin first, then by username
    copied.sort((a, b) => {
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (b.role === 'admin' && a.role !== 'admin') return 1;
      return a.username.localeCompare(b.username);
    });

    // Assign row_num in ascending order
    return copied.map((user, index) => ({
      ...user,
      row_num: index + 1,
    }));
  }, [filteredUsers]);

  const filteredFiles = files.filter((f) =>
    f.file_name.toLowerCase().includes(fileSearchTerm.toLowerCase())
  );

  // ========== Conditional Rendering of Content ==========
  const renderContent = () => {
    switch (selectedMenu) {
      case 'viewUsers':
        return (
          <Card title="User List" style={{ marginBottom: 24 }}>
            <Input.Search
              placeholder="Search users by username"
              allowClear
              onSearch={(value) => setSearchTerm(value)}
              style={{ marginBottom: 16, maxWidth: 300 }}
            />
            <Spin spinning={isLoading}>
              {sortedAndNumberedUsers.length > 0 ? (
                <Table
                  dataSource={sortedAndNumberedUsers}
                  columns={userColumns}
                  rowKey="username"
                  pagination={false}
                />
              ) : (
                <p>No users found.</p>
              )}
            </Spin>
          </Card>
        );
      case 'viewFiles':
        return (
          <Card title="Files" style={{ marginBottom: 24 }}>
            <Input.Search
              placeholder="Search files by name"
              allowClear
              onSearch={(value) => setFileSearchTerm(value)}
              style={{ marginBottom: 16, maxWidth: 300 }}
            />
            <Spin spinning={isLoading}>
              {filteredFiles.length > 0 ? (
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
          </Card>
        );
      case 'addUser':
        return (
          <Card title="Add User" style={{ marginBottom: 24 }}>
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
          </Card>
        );
      case 'updateUser':
        return (
          <Card title="Update User" style={{ marginBottom: 24 }}>
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
          </Card>
        );
      case 'deleteUser':
        return (
          <Card title="Delete User" style={{ marginBottom: 24 }}>
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
          </Card>
        );
      case 'assignAdmin':
        return (
          <Card title="Assign Admin Role" style={{ marginBottom: 24 }}>
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
          </Card>
        );
      case 'uploadFile':
        return (
          <Card title="Upload File" style={{ marginBottom: 24 }}>
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
          </Card>
        );
      default:
        return <div>Welcome to the Admin Dashboard</div>;
    }
  };

  // ========== Menu Items ==========
  const menuItems = [
    { key: 'viewUsers', icon: <UserOutlined />, label: 'View Users' },
    { key: 'viewFiles', icon: <FileOutlined />, label: 'View Files' },
    { key: 'addUser', icon: <PlusOutlined />, label: 'Add User' },
    { key: 'updateUser', icon: <EditOutlined />, label: 'Update User' },
    { key: 'deleteUser', icon: <UserDeleteOutlined />, label: 'Delete User' },
    { key: 'assignAdmin', icon: <UserSwitchOutlined />, label: 'Assign Admin' },
    { key: 'uploadFile', icon: <UploadOutlined />, label: 'Upload File' },
  ];

  return (
    <Layout>
      {/* Fixed sidebar */}
      <Sider
        width={SIDEBAR_WIDTH}
        style={{
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
          overflow: 'auto',
          backgroundColor: '#001529',
          zIndex: 1000,
        }}
        breakpoint="lg"
        collapsedWidth={80}
      >
        <div
          style={{
            height: 64,
            margin: 16,
            color: '#fff',
            fontSize: 18,
            textAlign: 'center',
          }}
        >
          <strong>Admin Panel</strong>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedMenu]}
          onClick={(e) => setSelectedMenu(e.key)}
          items={menuItems}
        />
      </Sider>

      {/* Main layout with fixed header */}
      <Layout style={{ marginLeft: SIDEBAR_WIDTH }}>
        <Header
          style={{
            position: 'fixed',
            top: 0,
            left: SIDEBAR_WIDTH,
            right: 0,
            height: 64,
            backgroundColor: '#fff',
            padding: '0 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 1001,
            boxShadow: '0 2px 8px #f0f1f2',
          }}
        >
          <h2 style={{ margin: 0 }}>LAN File Sharing</h2>
          <Button type="primary" onClick={handleLogout}>
            Logout
          </Button>
        </Header>

        {/* Content area with padding to account for fixed header */}
        <Content style={{ marginTop: 80, padding: '1rem 2rem' }}>
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminDashboard;

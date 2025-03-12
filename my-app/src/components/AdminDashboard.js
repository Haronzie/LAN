import React, { useEffect, useState } from 'react';
import {
  Layout,
  Menu,
  Table,
  Button,
  message,
  Input,
  Row,
  Col,
  Modal,
  Form
} from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  UserOutlined,
  DashboardOutlined,
  PlusOutlined
} from '@ant-design/icons';

const { Header, Content, Footer, Sider } = Layout;

// Simple form layout for adding a new user
const AddUserForm = ({ visible, onCancel, onAddUser }) => {
  const [form] = Form.useForm();

  const handleOk = () => {
    form
      .validateFields()
      .then((values) => {
        onAddUser(values);
        form.resetFields();
      })
      .catch(() => {});
  };

  return (
    <Modal
      open={visible}
      title="Add New User"
      onCancel={onCancel}
      onOk={handleOk}
      okText="Add"
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="Username"
          name="username"
          rules={[{ required: true, message: 'Please input a username!' }]}
        >
          <Input placeholder="Enter new username" />
        </Form.Item>
        <Form.Item
          label="Password"
          name="password"
          rules={[{ required: true, message: 'Please input a password!' }]}
        >
          <Input.Password placeholder="Enter new user password" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAddUserModalVisible, setIsAddUserModalVisible] = useState(false);

  const navigate = useNavigate();

  // Fetch the list of users from the backend API
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/users', { withCredentials: true }); // ✅ Proxy handles /users
      setUsers(res.data);
    } catch (error) {
      message.error('Error fetching users');
    } finally {
      setLoading(false);
    }
  };

  // On component mount, fetch users
  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users client-side whenever users or searchTerm changes
  useEffect(() => {
    if (!searchTerm) {
      setFilteredUsers(users);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = users.filter((u) =>
        u.username.toLowerCase().includes(term)
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  // Define columns for the user table
  const columns = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username'
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role'
    },
    {
      title: 'Active',
      dataIndex: 'active',
      key: 'active',
      render: (active) => (active ? 'Yes' : 'No')
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record) => (
        <Button
          onClick={() => handleToggleActive(record.username, record.active)}
        >
          {record.active ? 'Deactivate' : 'Activate'}
        </Button>
      )
    }
  ];

  // Handle toggling active status for a user
  const handleToggleActive = async (username, isActive) => {
    try {
      await axios.put(
        '/update-user-status', // ✅ Proxy handles /update-user-status
        {
          username,
          active: !isActive
        },
        { withCredentials: true }
      );
      message.success(
        `User '${username}' is now ${!isActive ? 'activated' : 'deactivated'}`
      );
      fetchUsers(); // Refresh the user list
    } catch (error) {
      message.error('Error updating user status');
    }
  };

  // Handle adding a new user
  const handleAddUser = async (values) => {
    try {
      await axios.post(
        '/add-user', // ✅ Proxy handles /add-user
        {
          username: values.username,
          password: values.password
        },
        { withCredentials: true }
      );
      message.success(`User '${values.username}' has been added successfully`);
      setIsAddUserModalVisible(false);
      fetchUsers();
    } catch (error) {
      message.error('Error adding user');
    }
  };

  // Handle logout button click
  const handleLogout = async () => {
    try {
      await axios.post('/logout', {}, { withCredentials: true }); // ✅ Proxy handles /logout
      navigate('/login');
    } catch (error) {
      message.error('Logout failed');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', fontFamily: '"Roboto", sans-serif' }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div style={{ padding: '16px', color: '#fff', fontSize: '24px', textAlign: 'center' }}>
          CDRRMO Admin
        </div>
        <Menu theme="dark" mode="inline" defaultSelectedKeys={['dashboard']}>
          <Menu.Item key="dashboard" icon={<DashboardOutlined />}>
            <Link to="/admin">Dashboard</Link>
          </Menu.Item>
          <Menu.Item key="users" icon={<UserOutlined />}>
            <Link to="/admin/users">User Management</Link>
          </Menu.Item>
        </Menu>
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 20px', textAlign: 'right' }}>
          <Button type="primary" onClick={handleLogout}>
            Logout
          </Button>
        </Header>
        <Content style={{ margin: '24px 16px 0' }}>
          <div style={{ padding: 24, background: '#fff', minHeight: 360 }}>
            <Row justify="space-between" style={{ marginBottom: 16 }}>
              <Col>
                <h2>User Management</h2>
              </Col>
              <Col>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setIsAddUserModalVisible(true)}
                >
                  Add User
                </Button>
              </Col>
            </Row>
            <Row style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Input
                  placeholder="Search by username"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </Col>
            </Row>
            <Table
              columns={columns}
              dataSource={filteredUsers}
              rowKey="username"
              loading={loading}
            />
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          © {new Date().getFullYear()} CDRRMO Official Admin Dashboard
        </Footer>
      </Layout>

      {/* Modal for Adding a New User */}
      <AddUserForm
        visible={isAddUserModalVisible}
        onCancel={() => setIsAddUserModalVisible(false)}
        onAddUser={handleAddUser}
      />
    </Layout>
  );
};

export default AdminDashboard;

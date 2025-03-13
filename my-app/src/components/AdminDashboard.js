import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Row, Col, Card, Statistic, List, message, Input, Typography } from 'antd';
import { DashboardOutlined, UserOutlined, SettingOutlined, FileOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AddResourceModal from './AddResourceModal'; // Import the modal component

const { Header, Content, Footer, Sider } = Layout;
const { Text } = Typography;

const AdminDashboard = () => {
  // Initialize states with safe defaults
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [files, setFiles] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [adminName, setAdminName] = useState("Admin");
  const [modalVisible, setModalVisible] = useState(false); // New state for modal visibility

  const navigate = useNavigate();

  // Retrieve stored admin username from localStorage on mount
  useEffect(() => {
    const storedName = localStorage.getItem("username");
    if (storedName) {
      setAdminName(storedName);
    }
  }, []);

  // Fetch users
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await axios.get('/users', { withCredentials: true });
      // Ensure that users is an array, fallback to an empty array if not.
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      message.error('Error fetching users');
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch files from API
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

  // Fetch activities from the backend API
  const fetchActivities = async () => {
    try {
      const res = await axios.get('/activities', { withCredentials: true });
      // Expected response: an array of activity objects
      setActivities(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      message.error('Error fetching activities');
    }
  };

  // Run initial fetches on component mount
  useEffect(() => {
    fetchUsers();
    fetchFiles();
    fetchActivities();
  }, []);

  // Poll for fresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchUsers();
      fetchFiles();
      fetchActivities();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter users whenever searchTerm or users changes
  useEffect(() => {
    const term = searchTerm.toLowerCase();
    setFilteredUsers(
      Array.isArray(users)
        ? (term ? users.filter(u => (u.username || '').toLowerCase().includes(term)) : users)
        : []
    );
  }, [searchTerm, users]);

  // Use safe checks for summary statistics
  const totalUsers = Array.isArray(users) ? users.length : 0;
  const activeUsers = Array.isArray(users) ? users.filter(u => u.active).length : 0;
  const totalFiles = Array.isArray(files) ? files.length : 0;

  return (
    <Layout style={{ minHeight: '100vh', fontFamily: 'Roboto, sans-serif' }}>
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
          <Menu.Item key="files" icon={<FileOutlined />}>
            <Link to="/admin/files">File Manager</Link>
          </Menu.Item>
          <Menu.Item key="settings" icon={<SettingOutlined />}>
            <Link to="/admin/settings">Settings</Link>
          </Menu.Item>
        </Menu>
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 20px', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Text style={{ marginRight: '20px', fontWeight: 'bold' }}>Welcome, {adminName}!</Text>
          <Button type="primary" style={{ marginRight: 8 }} onClick={() => navigate('/admin/settings')}>
            Settings
          </Button>
          <Button
            type="primary"
            onClick={async () => {
              try {
                await axios.post('/logout', {}, { withCredentials: true });
                navigate('/login');
              } catch (error) {
                message.error('Logout failed');
              }
            }}
          >
            Logout
          </Button>
        </Header>
        <Content style={{ margin: '24px 16px 0' }}>
          <div style={{ padding: 24, background: '#fff', minHeight: 360 }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <Card>
                  <Statistic title="Total Users" value={totalUsers} loading={loadingUsers} />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card>
                  <Statistic title="Active Users" value={activeUsers} loading={loadingUsers} />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card>
                  <Statistic title="Total Files" value={totalFiles} loading={loadingFiles} />
                </Card>
              </Col>
            </Row>
            <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
              <Col xs={24} md={12}>
                <Card title="Recent Activity Log">
                  <List
                    dataSource={activities}
                    renderItem={item => (
                      <List.Item>
                        <strong>
                          {item.timestamp
                            ? new Date(item.timestamp).toLocaleString()
                            : item.time}
                        </strong>
                        : {item.event || item.activity}
                      </List.Item>
                    )}
                  />
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="Quick Actions">
                  <Button type="primary" block style={{ marginBottom: 8 }} onClick={() => navigate('/admin/users')}>
                    Manage Users
                  </Button>
                  <Button type="primary" block onClick={() => navigate('/admin/files')}>
                    Manage Files
                  </Button>
                  {/* New button to open the Add Resource Modal */}
                  <Button type="primary" block style={{ marginTop: 8 }} onClick={() => setModalVisible(true)}>
                    Add Resource
                  </Button>
                </Card>
              </Col>
            </Row>
            <Row style={{ marginTop: 24 }}>
              <Col span={8}>
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </Col>
            </Row>
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          © {new Date().getFullYear()} CDRRMO Official Admin Dashboard
        </Footer>
      </Layout>
      {/* AddResourceModal component integration */}
      <AddResourceModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        refreshResources={fetchFiles}
      />
    </Layout>
  );
};

export default AdminDashboard;

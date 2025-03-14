import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Row, Col, Card, Statistic, List, Input, message, Typography } from 'antd';
import { DashboardOutlined, UserOutlined, SettingOutlined, FileOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AddResourceModal from './AddResourceModal';
import { Column } from '@ant-design/charts';
import Settings from './Settings'; // Import your Settings component

const { Header, Content, Footer, Sider } = Layout;
const { Title, Text } = Typography;

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [adminName, setAdminName] = useState('Admin');
  const [modalVisible, setModalVisible] = useState(false);
  const navigate = useNavigate();

  // Retrieve stored admin username from localStorage on mount.
  useEffect(() => {
    const storedName = localStorage.getItem("username");
    if (storedName) {
      setAdminName(storedName);
    }
  }, []);

  // Fetch users.
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await axios.get('/users', { withCredentials: true });
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      message.error('Error fetching users');
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch files.
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

  // Fetch activities.
  const fetchActivities = async () => {
    try {
      const res = await axios.get('/activities', { withCredentials: true });
      setActivities(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      message.error('Error fetching activities');
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchFiles();
    fetchActivities();
  }, []);

  // Poll for fresh data every 30 seconds.
  useEffect(() => {
    const interval = setInterval(() => {
      fetchUsers();
      fetchFiles();
      fetchActivities();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Summary statistics.
  const totalUsers = Array.isArray(users) ? users.length : 0;
  const activeUsers = Array.isArray(users) ? users.filter(u => u.active).length : 0;
  const totalFiles = Array.isArray(files) ? files.length : 0;

  // Prepare chart data for user statistics.
  const userStats = [
    { type: 'Active Users', count: activeUsers },
    { type: 'Inactive Users', count: totalUsers - activeUsers },
  ];

  const chartConfig = {
    data: userStats,
    xField: 'type',
    yField: 'count',
    label: {
      position: 'inside', // use inside instead of middle
      style: {
        fill: '#FFFFFF',
        opacity: 0.6,
      },
    },
    meta: {
      type: { alias: 'User Status' },
      count: { alias: 'Number of Users' },
    },
    columnStyle: { radius: [4, 4, 0, 0] },
  };

  const handleLogout = async () => {
    try {
      await axios.post('/logout', {}, { withCredentials: true });
      navigate('/login');
    } catch (error) {
      message.error('Logout failed.');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', fontFamily: 'Roboto, sans-serif' }}>
      <Sider breakpoint="lg" collapsedWidth="0" style={{ background: '#001529' }}>
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
        <Header
          style={{
            background: '#fff',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Welcome, {adminName}!
            </Title>
          </div>
          <div>
            <Button type="primary" style={{ marginRight: 8 }} onClick={() => navigate('/admin/settings')}>
              Settings
            </Button>
            <Button type="primary" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </Header>
        <Content style={{ margin: '24px 16px 0' }}>
          <div
            style={{
              padding: 24,
              background: '#fff',
              minHeight: 360,
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
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
                <Card title="Recent Activity Log" style={{ borderRadius: '8px' }}>
                  <List
                    dataSource={activities.slice(0, 5)}
                    renderItem={(item) => (
                      <List.Item>
                        <strong>
                          {item.timestamp ? new Date(item.timestamp).toLocaleString() : item.time}
                        </strong>
                        : {item.event || item.activity}
                      </List.Item>
                    )}
                  />
                  <Button type="link" onClick={() => navigate('/admin/activities')}>
                    View All Activities
                  </Button>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="User Statistics" style={{ borderRadius: '8px' }}>
                  <Column {...chartConfig} />
                </Card>
              </Col>
            </Row>
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          © {new Date().getFullYear()} CDRRMO Official Admin Dashboard
        </Footer>
      </Layout>
      <AddResourceModal visible={modalVisible} onClose={() => setModalVisible(false)} refreshResources={fetchFiles} />
    </Layout>
  );
};

export default AdminDashboard;

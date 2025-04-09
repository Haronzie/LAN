import React, { useState, useEffect, useRef } from 'react';
import {
  Layout,
  Menu,
  Button,
  Row,
  Col,
  Card,
  Statistic,
  List,
  message,
  Typography,
} from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  SettingOutlined,
  FileOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Column } from '@ant-design/charts';

const { Header, Content, Footer, Sider } = Layout;
const { Title, Text } = Typography;

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [adminName, setAdminName] = useState('Admin');
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const siderRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const storedName = localStorage.getItem('username');
    if (storedName) setAdminName(storedName);
  }, []);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await axios.get('/users', { withCredentials: true });
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch {
      message.error('Error fetching users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await axios.get('/files', { withCredentials: true });
      setFiles(Array.isArray(res.data) ? res.data : []);
    } catch {
      message.error('Error fetching files');
    } finally {
      setLoadingFiles(false);
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await axios.get('/activities', { withCredentials: true });
      setActivities(Array.isArray(res.data) ? res.data : []);
    } catch {
      message.error('Error fetching activities');
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchFiles();
    fetchActivities();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchUsers();
      fetchFiles();
      fetchActivities();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const totalUsers = users.length;
  const totalFiles = files.length;
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const regularCount = users.filter((u) => u.role === 'user').length;

  const userStats = [
    { type: 'Admin Users', count: adminCount },
    { type: 'Regular Users', count: regularCount },
  ];

  const chartConfig = {
    data: userStats,
    xField: 'type',
    yField: 'count',
    height: 180,
    columnStyle: { radius: [4, 4, 0, 0] },
    label: {
      position: 'top',
      style: {
        fill: '#FFFFFF',
        opacity: 0.7,
      },
    },
    yAxis: {
      min: 0,
      tickInterval: 1,
    },
    meta: {
      type: { alias: 'User Role' },
      count: { alias: 'Number of Users' },
    },
  };

  const handleLogout = async () => {
    try {
      await axios.post('/logout', {}, { withCredentials: true });
      navigate('/');
    } catch {
      message.error('Logout failed.');
    }
  };

  const toggleSidebar = () => setCollapsed(!collapsed);

  const handleBreakpoint = (broken) => {
    setIsMobile(broken);
    setCollapsed(broken);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMobile && !collapsed && siderRef.current && !siderRef.current.contains(event.target)) {
        setCollapsed(true);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobile, collapsed]);

  return (
    <Layout style={{ minHeight: '100vh', fontFamily: 'Roboto, sans-serif', overflow: 'hidden' }}>
      {isMobile && !collapsed && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1,
          }}
        />
      )}

      <Sider
        ref={siderRef}
        breakpoint="lg"
        collapsedWidth="0"
        collapsible={false}
        collapsed={collapsed}
        onBreakpoint={handleBreakpoint}
        onCollapse={setCollapsed}
        style={{
          position: isMobile ? 'fixed' : 'relative',
          zIndex: 2,
          height: '100vh',
          overflow: 'auto',
          background: '#001529',
        }}
        trigger={null}
      >
        <div
          style={{
            padding: '16px',
            color: '#fff',
            fontSize: collapsed ? '16px' : '20px',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {collapsed ? 'CA' : 'Resilio Admin'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['dashboard']}
          style={{ width: '100%', borderRight: 0 }}
        >
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
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            height: '64px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={toggleSidebar}
                style={{ marginRight: 12 }}
              />
            )}
            <Title level={4} style={{ margin: 0, fontSize: '16px' }}>
              Welcome, {adminName}!
            </Title>
          </div>
          <Button type="primary" size="small" onClick={handleLogout}>
            Logout
          </Button>
        </Header>

        <Content style={{ margin: 0, padding: '16px', overflowY: 'auto' }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <Card>
                <Statistic title="Total Users" value={totalUsers} loading={loadingUsers} />
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card>
                <Statistic title="Total Files" value={totalFiles} loading={loadingFiles} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
            <Col xs={24} md={12}>
              <Card title="Recent Activity">
                <List
                  size="small"
                  dataSource={activities.slice(0, 5)}
                  renderItem={(item) => (
                    <List.Item>
                      <Text>
                        <strong>
                          {item.timestamp
                            ? new Date(item.timestamp).toLocaleTimeString()
                            : item.time}
                        </strong>
                        : {item.event || item.activity}
                      </Text>
                    </List.Item>
                  )}
                />
                <div style={{ textAlign: 'right', marginTop: 8 }}>
                  <Button type="link" size="small" onClick={() => navigate('/admin/activities')}>
                    View All
                  </Button>
                </div>
              </Card>
            </Col>

            <Col xs={24} md={12}>
              <Card title="User Role Distribution">
                <Column {...chartConfig} />
              </Card>
            </Col>
          </Row>
        </Content>

        <Footer style={{ textAlign: 'center' }}>
          © {new Date().getFullYear()} Resilio Official Admin Dashboard
        </Footer>
      </Layout>
    </Layout>
  );
};

export default AdminDashboard;

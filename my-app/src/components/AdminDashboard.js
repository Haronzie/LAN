import React, { useState, useEffect } from 'react';
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
  Typography
} from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  SettingOutlined,
  FileOutlined
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Column } from '@ant-design/charts';
import './AdminDashboard.css';

const { Header, Content, Footer, Sider } = Layout;
const { Title } = Typography;

const BASE_WS = process.env.REACT_APP_BACKEND_WS;

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [adminName, setAdminName] = useState('Admin');
  const navigate = useNavigate();

  useEffect(() => {
    const client = new WebSocket(`${BASE_WS}/ws`);

    client.onopen = () => {
      console.log('Connected to notification server');
    };

    client.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'file_uploaded') {
          message.info(`New file uploaded: ${data.file_name} (version: ${data.version})`, 5);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    client.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    client.onclose = () => {
      console.log('Disconnected from notification server');
    };

    return () => {
      client.close();
    };
  }, []);

  useEffect(() => {
    const storedName = localStorage.getItem('username');
    if (storedName) {
      setAdminName(storedName);
    }
  }, []);

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

  const fetchFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await axios.get('/files/all', { withCredentials: true });
      setFiles(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      message.error('Error fetching files');
    } finally {
      setLoadingFiles(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await axios.get('/auditlogs', { withCredentials: true });
      setAuditLogs(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      message.error('Error fetching audit logs');
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchFiles();
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchUsers();
      fetchFiles();
      fetchAuditLogs();
    }, 5000);
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
          <Title level={4} style={{ margin: 0 }}>
            Welcome, {adminName}!
          </Title>
          <div>
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
                <Card title="Audit Logs" style={{ borderRadius: '8px' }}>
                  <List
                    dataSource={auditLogs.slice(0, 5)}
                    renderItem={(item) => (
                      <List.Item>
                        <strong>{new Date(item.created_at).toLocaleString()}</strong>
                        : {item.action} - {item.details}
                      </List.Item>
                    )}
                  />
                  <Button type="link" onClick={() => navigate('/admin/audit-logs')}>
                    View All Audit Logs
                  </Button>
                </Card>
              </Col>

              <Col xs={24} md={12}>
                <Card title="User Role Distribution">
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
    </Layout>
  );
};

export default AdminDashboard;

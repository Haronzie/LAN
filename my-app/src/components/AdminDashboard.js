import React, { useState, useEffect, useRef } from 'react';
import {
  Layout,
  Menu,
  Button,
  Typography,
  message,
  ConfigProvider,
  Badge,
  Drawer,
  Avatar
} from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  SettingOutlined,
  FileOutlined,
  MenuOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import axios from 'axios';
import NotificationDropdown from './common/NotificationDropdown';
import UserActivities from './UserActivities';
import AdminInstructionDropdown from './admin/AdminInstructionDropdown';
import './dashboard-fix.css';
import './admin-dashboard-responsive.css';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

// Using relative URLs - proxy in package.json will handle the backend URL

const AdminDashboard = () => {
  const [adminName, setAdminName] = useState('Admin');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const siderRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const pathParts = location.pathname.split('/');
  const currentSection = location.pathname.split('/')[2] || 'dashboard';
  const sectionTitles = {
    dashboard: 'Home Dashboard',
    users: 'User Management',
    files: 'File Manager',
    settings: 'Settings'
  };

  const pageTitle = sectionTitles[currentSection] || 'Dashboard';

  useEffect(() => {
    const storedName = localStorage.getItem('username');
    if (storedName) setAdminName(storedName);
  }, []);

  const handleLogout = async () => {
    try {
      const baseUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
      await axios.post(`${baseUrl}/logout`, {}, { 
        withCredentials: true,
        timeout: 5000 // Add timeout to prevent long-waiting requests
      });

      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      message.success('Logout successful');
      navigate('/login');
    } catch (error) {
      console.log('Logout error:', error);
      message.warning('Logout from server failed, but you\'ve been logged out locally.');
      navigate('/login');
    }
  };

  const toggleMenu = () => {
    if (isMobile) {
      setDrawerVisible(!drawerVisible);
    }
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 992;
      setIsMobile(mobile);
      if (!mobile) {
        setDrawerVisible(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: <span style={{ cursor: 'pointer' }} onClick={() => navigate('/admin')}>Dashboard</span>,
    },
    {
      key: 'users',
      icon: <UserOutlined />,
      label: <span style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/users')}>User Management</span>,
    },
    {
      key: 'files',
      icon: <FileOutlined />,
      label: <span style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/files')}>File Manager</span>,
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: <span style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/settings')}>Settings</span>,
    }
  ];

  return (
    <ConfigProvider warning={{ strict: false }}>
      <Layout className="admin-dashboard-container">
        {/* Mobile Drawer - Only for mobile view */}
        {isMobile && (
          <Drawer
            title="Menu"
            placement="left"
            width={250}
            onClose={() => setDrawerVisible(false)}
            visible={drawerVisible}
            bodyStyle={{ padding: 0 }}
            className="mobile-drawer"
            closable={true}
          >
            <div className="user-info">
              <Avatar size={64} icon={<UserOutlined />} />
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 'bold' }}>{adminName}</div>
                <div style={{ color: '#666' }}>Administrator</div>
              </div>
            </div>
            <Menu
              theme="light"
              mode="inline"
              selectedKeys={[currentSection]}
              items={menuItems}
              onClick={() => setDrawerVisible(false)}
            />
          </Drawer>
        )}

        {/* Desktop Sider - Static and non-collapsible */}
        {!isMobile && (
          <div className="sider-container">
            <Sider
              className="admin-sider"
              width={280}
              theme="light"
              style={{
                overflow: 'auto',
                height: '100vh',
                position: 'fixed',
                left: 0,
                top: 0,
                bottom: 0,
                boxShadow: '2px 0 8px 0 rgba(0, 0, 0, 0.1)'
              }}
            >
              <div className="admin-logo" style={{ padding: '16px 24px' }}>
                <h1 style={{ margin: 0, fontSize: '20px', color: '#1890ff' }}>LAN Admin</h1>
              </div>
              <div className="user-info" style={{ padding: '24px', textAlign: 'center' }}>
                <Avatar size={80} icon={<UserOutlined style={{ fontSize: '32px' }} />} />
                <div style={{ marginTop: '16px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{adminName}</div>
                  <div style={{ color: '#666', fontSize: '14px' }}>Administrator</div>
                </div>
              </div>
              <Menu
                theme="light"
                mode="inline"
                selectedKeys={[currentSection]}
                items={menuItems}
                style={{ padding: '0 8px' }}
              />
            </Sider>
          </div>
        )}

        <Layout className="site-layout" style={{ marginLeft: isMobile ? 0 : 280 }}>
          <Header className="site-layout-background" style={{ 
            padding: '0 24px',
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            alignItems: 'center',
            height: '64px',
            position: 'sticky',
            top: 0,
            zIndex: 1,
            background: '#fff',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.1)',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {isMobile && (
                <Button type="text" icon={<MenuOutlined />} onClick={toggleMenu} style={{ marginRight: 16 }} />
              )}
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              width: '100%'
            }}>
              <div style={{
                background: 'linear-gradient(90deg, #1890ff, #36cfc9)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 600,
                fontSize: '18px',
                letterSpacing: '0.5px',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                whiteSpace: 'nowrap',
                padding: '0 20px'
              }}>
                Welcome to Admin Dashboard
              </div>
            </div>
            <div className="header-right" style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              marginLeft: 'auto'
            }}>
              <AdminInstructionDropdown />
              <Button 
                type="text" 
                icon={<LogoutOutlined />} 
                onClick={handleLogout}
                className="logout-btn"
                style={{ 
                  zIndex: 1,
                  color: '#ff4d4f',
                  borderColor: '#ff4d4f',
                  marginLeft: '8px'
                }}
              >
                <span className="logout-text">Logout</span>
              </Button>
            </div>
          </Header>
          <Content className="admin-content">
            <div className="content-inner">
              {location.pathname.endsWith('/user-activities') ? (
                <UserActivities />
              ) : (
                <Outlet />
              )}
            </div>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
};

export default AdminDashboard;
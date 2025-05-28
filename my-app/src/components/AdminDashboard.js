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
  const [collapsed, setCollapsed] = useState(false);
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
    } else {
      setCollapsed(!collapsed);
      
      // Force a reflow to ensure the animation works
      const sider = document.querySelector('.admin-sider');
      if (sider) {
        sider.style.transition = 'all 0.2s ease';
      }
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

        {/* Desktop Sider - Only for desktop view */}
        {!isMobile && (
          <div className="sider-container">
            <Sider
              className="admin-sider"
              collapsible
              collapsed={collapsed}
              onCollapse={setCollapsed}
              width={250}
              theme="light"
              trigger={null}
              collapsedWidth={0}
              breakpoint="lg"
            >
              <div className="admin-logo">
                <h1>LAN Admin</h1>
              </div>
              <div className="user-info">
                <Avatar size={64} icon={<UserOutlined />} />
                {!collapsed && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 'bold' }}>{adminName}</div>
                    <div style={{ color: '#666' }}>Administrator</div>
                  </div>
                )}
              </div>
              <Menu
                theme="light"
                mode="inline"
                selectedKeys={[currentSection]}
                items={menuItems}
              />
            </Sider>
            <div 
              className={`sider-toggle ${collapsed ? 'collapsed' : ''}`}
              onClick={toggleMenu}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </div>
          </div>
        )}

        <Layout className="site-layout">
          <Header className="admin-header">
            <div className="header-content">
              <div className="header-left">
                <div 
                  className={`sider-toggle ${collapsed ? 'collapsed' : ''}`}
                  onClick={toggleMenu}
                >
                  {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                </div>
                <div className="welcome-message">
                  <div className="welcome-text">Welcome to the Admin Dashboard</div>
                </div>
              </div>
              <div className="header-right">
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
import React, { useState, useEffect, useRef } from 'react';
import {
  Layout,
  Menu,
  Button,
  Typography,
  message,
  ConfigProvider
} from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  SettingOutlined,
  FileOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import axios from 'axios';
import NotificationDropdown from './common/NotificationDropdown';
import UserActivities from './UserActivities';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

// Using relative URLs - proxy in package.json will handle the backend URL

const AdminDashboard = () => {
  const [adminName, setAdminName] = useState('Admin');
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
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

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: <Link to="">Dashboard</Link>,
    },
    {
      key: 'users',
      icon: <UserOutlined />,
      label: <Link to="users">User Management</Link>,
    },
    {
      key: 'files',
      icon: <FileOutlined />,
      label: <Link to="files">File Manager</Link>,
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: <Link to="settings">Settings</Link>,
    }
  ];

  return (
    <ConfigProvider warning={{ strict: false }}>
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
          <div style={{ height: 64, background: 'rgba(255,255,255,0.04)', margin: 12, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 20, color: '#fff' }}>
            Resilio Admin
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[currentSection]}
            items={menuItems}
            style={{ borderRight: 0 }}
          />
        </Sider>
        <Layout>
          <Header
            style={{
              background: '#fff',
              padding: isMobile ? '0 16px' : '0 32px',
              display: 'flex',
              alignItems: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              height: '64px',
            }}
          >

            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={toggleSidebar}
                style={{ position: 'absolute', left: 16 }}
              />
            )}
            <div style={{ flex: 1 }} />
            <Button type="primary" size="large" onClick={handleLogout} style={{ marginLeft: 'auto', marginRight: 32, fontWeight: 600, letterSpacing: 1 }}>
              Logout
            </Button>
          </Header>
          <Content style={{ margin: 0, minHeight: 280, background: '#f5f6fa' }}>
            {/* Routing for /admin/user-activities */}
            {location.pathname.endsWith('/user-activities') ? (
              <UserActivities />
            ) : (
              <Outlet />
            )}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
};

export default AdminDashboard;
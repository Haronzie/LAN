import React, { useState, useEffect, useRef } from 'react';
import {
  Layout,
  Menu,
  Button,
  Typography,
  message,
  ConfigProvider,
  Badge
} from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  SettingOutlined,
  FileOutlined,
  MenuOutlined
} from '@ant-design/icons';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import axios from 'axios';
import NotificationDropdown from './common/NotificationDropdown';
import UserActivities from './UserActivities';
import AdminInstructionDropdown from './admin/AdminInstructionDropdown';
import './dashboard-fix.css'; // Import dashboard CSS fixes

// Welcome Message Component
const WelcomeMessage = ({ name }) => {
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    // Show the message after a short delay when the component mounts
    const timer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div 
      style={{
        position: 'fixed',
        top: '80px',
        right: '20px',
        padding: '12px 24px',
        backgroundColor: '#1890ff',
        color: 'white',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        opacity: visible ? 1 : 0,
        transition: 'all 0.5s ease-out',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}
    >
      <span>👋</span>
      <span>Welcome back, <strong>{name}</strong>!</span>
    </div>
  );
};

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

  // Use programmatic navigation with the navigate function instead of Link components
  const handleMenuClick = (path) => {
    navigate(path);
  };

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: <span style={{ cursor: 'pointer' }} onClick={() => handleMenuClick('/admin')}>Dashboard</span>,
    },
    {
      key: 'users',
      icon: <UserOutlined />,
      label: <span style={{ cursor: 'pointer' }} onClick={() => handleMenuClick('/admin/users')}>User Management</span>,
    },
    {
      key: 'files',
      icon: <FileOutlined />,
      label: <span style={{ cursor: 'pointer' }} onClick={() => handleMenuClick('/admin/files')}>File Manager</span>,
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: <span style={{ cursor: 'pointer' }} onClick={() => handleMenuClick('/admin/settings')}>Settings</span>,
    }
  ];

  // Show welcome message only on initial load
  const [showWelcome, setShowWelcome] = useState(true);
  
  useEffect(() => {
    // Hide welcome message after 5 seconds
    const timer = setTimeout(() => setShowWelcome(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ConfigProvider warning={{ strict: false }}>
      {showWelcome && <WelcomeMessage name={adminName} />}
      <Layout className="admin-layout" style={{ fontFamily: 'Roboto, sans-serif' }}>
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
            
            {/* Admin Instructions Dropdown */}
            <AdminInstructionDropdown />
            
            <Button 
              type="primary" 
              size="large" 
              onClick={handleLogout} 
              style={{ 
                fontWeight: 600, 
                letterSpacing: 1,
                backgroundColor: '#ff4d4f',
                borderColor: '#ff4d4f',
                marginRight: '16px',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1.1)',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                position: 'relative',
                overflow: 'hidden',
                zIndex: 1
              }}
              className="logout-button"
            >
              <style>
                {`
                  .logout-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
                  }
                  .logout-button:active {
                    transform: translateY(0);
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                  }
                  .logout-button::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(255, 255, 255, 0.1);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    z-index: -1;
                  }
                  .logout-button:hover::after {
                    opacity: 1;
                  }
                `}
              </style>
              Logout
            </Button>
          </Header>
          <Content className="ant-layout-content" style={{ background: '#f5f6fa' }}>
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
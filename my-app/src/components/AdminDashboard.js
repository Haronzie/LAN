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

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

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
      await axios.post(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080'}/logout`, {}, { withCredentials: true });
      navigate('/login');
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
            selectedKeys={[currentSection]}
            items={menuItems}
            style={{ width: '100%', borderRight: 0 }}
          />
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
            <div style={{ flex: 1, textAlign: 'center' }}>
              <Title level={3} style={{ margin: 0 }}>{pageTitle}</Title>
            </div>
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={toggleSidebar}
                style={{ position: 'absolute', left: 16 }}
              />
            )}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <NotificationDropdown />
              <Button type="primary" size="small" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </Header>

          <Content style={{ margin: 0, padding: 0, overflowY: 'auto' }}>
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
};

export default AdminDashboard;
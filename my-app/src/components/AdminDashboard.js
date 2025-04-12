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
import { Link, useNavigate, Outlet } from 'react-router-dom';
import axios from 'axios';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const AdminDashboard = () => {
  const [adminName, setAdminName] = useState('Admin');
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const siderRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const storedName = localStorage.getItem('username');
    if (storedName) setAdminName(storedName);
  }, []);

  const handleLogout = async () => {
    try {
      await axios.post('/logout', {}, { withCredentials: true });
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
            defaultSelectedKeys={['dashboard']}
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

          <Content style={{ margin: 0, padding: 0, overflowY: 'auto' }}>
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
};

export default AdminDashboard;
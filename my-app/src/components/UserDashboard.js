import React, { useEffect, useState, useRef } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, message, Typography } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import axios from 'axios';
import UserDashboardHome from './UserDashboardHome';
import TrainingDashboard from './TrainingDashboard';
import OperationDashboard from './OperationDashboard';
import ResearchDashboard from './ResearchDashboard';
import InventoryDashboard from './InventoryDashboard';
import UserSettings from './UserSettings';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const UserDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userRole, setUserRole] = useState(null);
  const [username, setUsername] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const siderRef = useRef(null);

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const res = await axios.get('/user-role', { withCredentials: true });
        if (res.data.role === 'admin') {
          navigate('/admin');
        } else if (res.data.role === 'user') {
          setUserRole('user');
          const storedUsername = localStorage.getItem('username');
          if (storedUsername) {
            setUsername(storedUsername);
          }
        } else {
          message.error('Access Denied. Redirecting to login.');
          navigate('/login');
        }
      } catch (error) {
        message.error('Not authenticated. Redirecting to login.');
        navigate('/login');
      }
    };
    checkUserRole();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await axios.post('/logout', {}, { withCredentials: true });
      message.success('Logged out successfully.');
      navigate('/login');
    } catch (error) {
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

  if (!userRole) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden'
      }}>Loading...</div>
    );
  }

  const pathParts = location.pathname.split('/');
  const currentRoute = pathParts[2] || 'home';

  return (
    <Layout style={{ minHeight: '100vh', overflow: 'hidden' }}>
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
        collapsible
        collapsed={collapsed}
        onBreakpoint={handleBreakpoint}
        onCollapse={setCollapsed}
        style={{
          position: isMobile ? 'fixed' : 'relative',
          zIndex: 2,
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px', color: '#fff', fontSize: '20px', textAlign: 'center' }}>
          User Dashboard
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[currentRoute]}
          defaultSelectedKeys={['home']}
          style={{ height: 'calc(100vh - 64px)', overflowY: 'auto' }}
        >
          <Menu.Item key="home">
            <Link to="/user/home">Home</Link>
          </Menu.Item>
          <Menu.Item key="operation">
            <Link to="/user/operation">Operation</Link>
          </Menu.Item>
          <Menu.Item key="training">
            <Link to="/user/training">Training</Link>
          </Menu.Item>
          <Menu.Item key="research">
            <Link to="/user/research">Research</Link>
          </Menu.Item>
          <Menu.Item key="inventory">
            <Link to="/user/inventory">Inventory</Link>
          </Menu.Item>
          <Menu.Item key="settings">
            <Link to="/user/settings">Settings</Link>
          </Menu.Item>
        </Menu>
      </Sider>

      <Layout>
        <Header style={{
          background: '#fff',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          height: 64,
          flexShrink: 0,
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        }}>
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={toggleSidebar}
              style={{ marginRight: 16 }}
            />
          )}
          <Title level={4} style={{ margin: 0 }}>
            Welcome, <strong>{username || 'Guest'}</strong>!
          </Title>
          <div style={{ flex: 1 }} />
          <Button type="primary" onClick={handleLogout}>
            Logout
          </Button>
        </Header>

        <Content style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: 24,
            background: '#fff',
            minHeight: 'calc(100vh - 64px)',
            overflow: 'auto'
          }}>
            <Routes>
              <Route path="home" element={<UserDashboardHome />} />
              <Route path="operation" element={<OperationDashboard />} />
              <Route path="training" element={<TrainingDashboard />} />
              <Route path="research" element={<ResearchDashboard />} />
              <Route path="inventory" element={<InventoryDashboard />} />
              <Route path="settings" element={<UserSettings />} />
              <Route index element={<UserDashboardHome />} />
              <Route path="*" element={<div>Page not found</div>} />
            </Routes>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default UserDashboard;

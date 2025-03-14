import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, message } from 'antd';
import axios from 'axios';
import UserDashboardHome from './UserDashboardHome';
import TrainingDashboard from './TrainingDashboard';
import OperationDashboard from './OperationDashboard';
import ResearchDashboard from './ResearchDashboard';
import InventoryDashboard from './InventoryDashboard';
// Make sure to import your UserSettings component:
import UserSettings from './UserSettings';

const { Header, Content, Sider } = Layout;

const UserDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const res = await axios.get('/user-role', { withCredentials: true });
        if (res.data.role !== 'user') {
          message.error('Access Denied. Redirecting to login.');
          navigate('/login');
        } else {
          setUserRole(res.data.role);
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

  if (!userRole) {
    return <p>Loading...</p>;
  }

  // Determine which menu item should be highlighted based on the current path
  const pathParts = location.pathname.split('/');
  const currentRoute = pathParts[2] || 'home';  // e.g. "/user/home" => pathParts[2] is "home"

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div style={{ padding: '16px', color: '#fff', fontSize: '24px', textAlign: 'center' }}>
          User Dashboard
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[currentRoute]}
          defaultSelectedKeys={['home']}
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

          {/* NEW: Settings menu item */}
          <Menu.Item key="settings">
            <Link to="/user/settings">Settings</Link>
          </Menu.Item>
        </Menu>
      </Sider>

      <Layout>
        <Header style={{ background: '#fff', padding: '0 20px', textAlign: 'right' }}>
          <Button type="primary" onClick={handleLogout}>
            Logout
          </Button>
        </Header>

        <Content style={{ margin: '24px 16px 0' }}>
          <div style={{ padding: 24, background: '#fff', minHeight: 360 }}>
            <Routes>
              <Route path="home" element={<UserDashboardHome />} />
              <Route path="operation" element={<OperationDashboard />} />
              <Route path="training" element={<TrainingDashboard />} />
              <Route path="research" element={<ResearchDashboard />} />
              <Route path="inventory" element={<InventoryDashboard />} />

              {/* NEW: Settings route */}
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

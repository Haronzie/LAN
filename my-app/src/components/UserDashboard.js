import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Layout, Menu, Button, message } from 'antd';
import axios from 'axios';
import UserDashboardHome from './UserDashboardHome';
import TrainingDashboard from './TrainingDashboard';
import OperationDashboard from './OperationDashboard';
import ResearchDashboard from './ResearchDashboard';
import InventoryDashboard from './InventoryDashboard'; // Make sure you have this component or a placeholder

const { Header, Content, Sider } = Layout;

const UserDashboard = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        console.log("Fetching user role...");
        const res = await axios.get('/user-role', { withCredentials: true });
        console.log("User role response:", res.data);
        if (res.data.role !== 'user') {
          message.error('Access Denied. Redirecting to login.');
          navigate('/login');
        } else {
          setUserRole(res.data.role);
        }
      } catch (error) {
        console.error("Error fetching user role:", error.response || error);
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

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div style={{ padding: '16px', color: '#fff', fontSize: '24px', textAlign: 'center' }}>
          User Dashboard
        </div>
        <Menu theme="dark" mode="inline" defaultSelectedKeys={['home']}>
          <Menu.Item key="home">
            <Link to="home">Home</Link>
          </Menu.Item>
          <Menu.Item key="operation">
            <Link to="operation">Operation</Link>
          </Menu.Item>
          <Menu.Item key="training">
            <Link to="training">Training</Link>
          </Menu.Item>
          <Menu.Item key="research">
            <Link to="research">Research</Link>
          </Menu.Item>
          <Menu.Item key="inventory">
            <Link to="inventory">Inventory</Link>
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
              <Route index element={<UserDashboardHome />} />
            </Routes>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default UserDashboard;

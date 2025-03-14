import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Typography, message, Modal, Tooltip } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Home.css';

const { Header, Content, Footer } = Layout;
const { Title, Paragraph } = Typography;

const Home = () => {
  const [adminExists, setAdminExists] = useState(false);
  const navigate = useNavigate();

  // Check if an admin exists
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await axios.get('/admin-exists'); // ✅ Uses proxy
        setAdminExists(res.data.exists);
      } catch (error) {
        message.error('Failed to check admin status.');
      }
    };
    checkAdmin();
  }, []);

  // Handler for Login button click
  const handleLoginClick = () => {
    if (!adminExists) {
      // Show a modal alerting the user that no admin exists yet
      Modal.info({
        title: 'No Admin Account Found',
        content: (
          <div>
            <p>No admin account has been created yet.</p>
            <p>Please register as the first admin before logging in.</p>
          </div>
        ),
        onOk() {
          navigate('/register');
        },
      });
    } else {
      navigate('/login');
    }
  };

  return (
    <Layout className="home-layout">
      <Header className="home-header">
        <div className="logo">
          <img src="/cdrrmo.jpg" alt="CDRMO Logo" className="logo-image" />
          <span className="logo-text">CDRMO Official System</span>
        </div>
        <Menu theme="dark" mode="horizontal" defaultSelectedKeys={['1']}>
          <Menu.Item key="1">
            <Link to="/">Home</Link>
          </Menu.Item>
          <Menu.Item key="2" onClick={handleLoginClick}>
            <Tooltip title="Click here to log in">
              <span>Login</span>
            </Tooltip>
          </Menu.Item>
          {!adminExists && (
            <Menu.Item key="3">
              <Tooltip title="Click here to register">
                <Link to="/register">Register</Link>
              </Tooltip>
            </Menu.Item>
          )}
        </Menu>
      </Header>
      <Content className="home-content">
        <div className="site-layout-content">
          <Title level={2}>Welcome to the CDRRMO File Sharing System</Title>
          <Paragraph className="amazing-paragraph">
            The official secure system for managing and sharing files across your organization.
            Please log in or register to access your dashboard and manage your documents.
          </Paragraph>
          <div className="button-group" style={{ marginTop: 24 }}>
            <Tooltip title="Click here to log in">
              <Button type="primary" size="large" style={{ marginRight: '10px' }} onClick={handleLoginClick}>
                Login
              </Button>
            </Tooltip>
            {!adminExists && (
              <Tooltip title="Click here to register">
                <Link to="/register">
                  <Button type="default" size="large">Register</Button>
                </Link>
              </Tooltip>
            )}
          </div>
        </div>
      </Content>
      <Footer style={{ textAlign: 'center' }}>
        © {new Date().getFullYear()} CDRRMO Official. All rights reserved.
      </Footer>
    </Layout>
  );
};

export default Home;

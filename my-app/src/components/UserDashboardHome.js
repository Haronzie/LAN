import React, { useState, useEffect } from 'react';
import { Layout, Row, Col, Card, Typography, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  FireOutlined,
  RadarChartOutlined,
  TeamOutlined,
  DatabaseOutlined,
  SettingOutlined
} from '@ant-design/icons';
const { Title } = Typography;
const { Content } = Layout;

const UserDashboardHome = () => {
  const [username, setUsername] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Retrieve the username from local storage
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  const dashboards = [
    {
      key: 'operation',
      title: 'Operation Dashboard',
      icon: <FireOutlined style={{ fontSize: '48px', color: '#d4380d' }} />,
      route: '/user/operation',
    },
    {
      key: 'research',
      title: 'Research Dashboard',
      icon: <RadarChartOutlined style={{ fontSize: '48px', color: '#1890ff' }} />,
      route: '/user/research',
    },
    {
      key: 'training',
      title: 'Training Dashboard',
      icon: <TeamOutlined style={{ fontSize: '48px', color: '#52c41a' }} />,
      route: '/user/training',
    },
    {
      key: 'inventory',
      title: 'Inventory Dashboard',
      icon: <DatabaseOutlined style={{ fontSize: '48px', color: '#faad14' }} />,
      route: '/user/inventory',
    },
  ];
  
  return (
    <Layout style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      <Content style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header row with title, welcome message, and Settings button */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={2} style={{ margin: 0 }}>
              User Dashboard
            </Title>
          </Col>
          <Col>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Title level={5} style={{ margin: 0, marginRight: 16 }}>
                Welcome, <strong>{username || 'Guest'}</strong>!
              </Title>
              <Button
                type="primary"
                icon={<SettingOutlined />}
                onClick={() => navigate('/user/settings')}
              >
                Settings
              </Button>
            </div>
          </Col>
        </Row>

        {/* Dashboard Cards */}
        <Row gutter={[24, 24]} justify="center">
          {dashboards.map((dashboard) => (
            <Col xs={24} sm={12} md={6} key={dashboard.key}>
              <Card
                hoverable
                onClick={() => navigate(dashboard.route)}
                style={{ textAlign: 'center' }}
              >
                {dashboard.icon}
                <Title level={4} style={{ marginTop: 16 }}>
                  {dashboard.title}
                </Title>
              </Card>
            </Col>
          ))}
        </Row>
      </Content>
    </Layout>
  );
};

export default UserDashboardHome;

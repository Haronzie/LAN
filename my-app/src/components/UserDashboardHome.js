import React, { useState, useEffect } from 'react';
import { Layout, Row, Col, Card, Typography, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { BarChartOutlined, ReadOutlined, BookOutlined, DatabaseOutlined, SettingOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title } = Typography;
const { Content } = Layout;

const UserDashboardHome = () => {
  const [username, setUsername] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get('/api/user/profile', { withCredentials: true });
        setUsername(res.data.username);
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };
    fetchProfile();
  }, []);

  const dashboards = [
    {
      key: 'operation',
      title: 'Operation Dashboard',
      icon: <BarChartOutlined style={{ fontSize: '48px', color: '#1890ff' }} />,
      route: '/user/operation',
    },
    {
      key: 'research',
      title: 'Research Dashboard',
      icon: <ReadOutlined style={{ fontSize: '48px', color: '#52c41a' }} />,
      route: '/user/research',
    },
    {
      key: 'training',
      title: 'Training Dashboard',
      icon: <BookOutlined style={{ fontSize: '48px', color: '#faad14' }} />,
      route: '/user/training',
    },
    {
      key: 'inventory',
      title: 'Inventory Dashboard',
      icon: <DatabaseOutlined style={{ fontSize: '48px', color: '#eb2f96' }} />,
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
            {username && (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Title level={5} style={{ margin: 0, marginRight: 16 }}>
                  Welcome, <strong>{username}</strong>!
                </Title>
                <Button
                  type="primary"
                  icon={<SettingOutlined />}
                  onClick={() => navigate('/user/settings')}
                >
                  Settings
                </Button>
              </div>
            )}
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

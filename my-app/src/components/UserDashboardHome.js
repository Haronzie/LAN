import React, { useEffect, useState } from 'react';
import { Layout, Row, Col, Card, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { BarChartOutlined, ReadOutlined, BookOutlined, DatabaseOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const { Content } = Layout;

const UserDashboardHome = () => {
  const [username, setUsername] = useState('');
  const navigate = useNavigate();

  // Fetch the user's profile to get the username
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const res = await axios.get('/api/user/profile', { withCredentials: true });
        if (res.data.username) {
          setUsername(res.data.username);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };
    fetchUserProfile();
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
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        
        {/* Top "Header" Section */}
        <div
          style={{
            marginBottom: 24,
            padding: '16px',
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          }}
        >
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={2} style={{ margin: 0 }}>
                User Dashboard
              </Title>
            </Col>
            <Col>
              {username && (
                <Text style={{ fontSize: '16px' }}>
                  Welcome, <strong>{username}</strong>!
                </Text>
              )}
            </Col>
          </Row>
        </div>

        {/* Dashboard Cards */}
        <Row gutter={[24, 24]} justify="center">
          {dashboards.map((dashboard) => (
            <Col xs={24} sm={12} md={6} key={dashboard.key}>
              <Card
                hoverable
                onClick={() => navigate(dashboard.route)}
                style={{ textAlign: 'center', borderRadius: '8px' }}
              >
                {dashboard.icon}
                <Title level={4} style={{ marginTop: 16, marginBottom: 0 }}>
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

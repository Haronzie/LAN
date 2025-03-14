import React from 'react';
import { Layout, Row, Col, Card, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { BarChartOutlined, ReadOutlined, BookOutlined, DatabaseOutlined } from '@ant-design/icons';

const { Title } = Typography;

const UserDashboardHome = () => {
  const navigate = useNavigate();

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
      <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
        <Title level={2}>User Dashboard</Title>
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
      </div>
    </Layout>
  );
};

export default UserDashboardHome;

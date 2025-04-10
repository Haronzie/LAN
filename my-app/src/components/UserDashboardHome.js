import React, { useState, useEffect } from 'react';
import { Layout, Row, Col, Card, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  FireOutlined,
  RadarChartOutlined,
  TeamOutlined,
  DatabaseOutlined
} from '@ant-design/icons';

const { Title } = Typography;

const UserDashboardHome = () => {
  const [username, setUsername] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  const dashboards = [
    {
      key: 'operation',
      title: 'Operation Dashboard',
      icon: <FireOutlined style={{ fontSize: '70px', color: '#d4380d' }} />,
      route: '/user/operation',
    },
    {
      key: 'research',
      title: 'Research Dashboard',
      icon: <RadarChartOutlined style={{ fontSize: '70px', color: '#1890ff' }} />,
      route: '/user/research',
    },
    {
      key: 'training',
      title: 'Training Dashboard',
      icon: <TeamOutlined style={{ fontSize: '70px', color: '#52c41a' }} />,
      route: '/user/training',
    },
    {
      key: 'inventory',
      title: 'Inventory Dashboard',
      icon: <DatabaseOutlined style={{ fontSize: '70px', color: '#faad14' }} />,
      route: '/user/inventory',
    },
  ];

  return (
    <div style={{ 
      height: 'calc(100vh - 112px)',
      padding: '24px',
      background: '#f0f2f5',
      overflow: 'auto',
      boxSizing: 'border-box'
    }}>
      <div style={{ 
        maxWidth: '1200px',
        margin: '0 auto',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ 
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          <Title level={2} style={{ margin: 0 }}>
            User Dashboard
          </Title>
        </div>

        {/* Dashboard Cards */}
        <div style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingTop: '50px',
        }}>
          <Row 
            gutter={[32, 32]} 
            justify="center"
            style={{
              width: '100%',
              maxWidth: '1100px',
              paddingBottom: '24px'
            }}
          >
            {dashboards.map((dashboard) => (
              <Col 
                key={dashboard.key}
                xs={24}
                sm={12}
                md={12}
                lg={6}
                style={{
                  display: 'flex',
                  justifyContent: 'center'
                }}
              >
                <Card
                  hoverable
                  onClick={() => navigate(dashboard.route)}
                  styles={{
                    // Base styles
                    root: {
                      width: '100%',
                      minWidth: '220px',
                      maxWidth: '260px',
                      height: '240px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                    },
                    // Hover styles (Ant Design v5+ syntax)
                    hoverable: {
                      '&:hover': {
                        transform: 'scale(1.07) translateY(-5px)',
                        boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
                        borderColor: '#1890ff',
                        '& .ant-card-body': {
                          backgroundColor: 'rgba(24, 144, 255, 0.03)' // subtle blue tint
                        }
                      }
                    }
                  }}
                  bodyStyle={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    padding: '20px',
                    transition: 'background-color 0.3s ease'
                  }}
                >
                  {dashboard.icon}
                  <Title level={4} style={{ 
                    marginTop: '20px', 
                    marginBottom: 0,
                    textAlign: 'center',
                    fontSize: '25px',
                    transition: 'color 0.3s ease'
                  }}>
                    {dashboard.title}
                  </Title>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </div>
    </div>
  );
};

export default UserDashboardHome;
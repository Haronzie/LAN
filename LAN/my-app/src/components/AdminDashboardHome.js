import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Statistic, List, Button, Typography, message } from 'antd';
import { Column } from '@ant-design/charts';
import { UserOutlined, FileOutlined, TeamOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Text, Title } = Typography;

// ✅ Dynamic backend API base URL
const BASE_URL = `${window.location.protocol}//${window.location.hostname}:8081`;

const AdminDashboardHome = () => {
  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const navigate = useNavigate();

  const totalUsers = users.length;
  const totalFiles = files.length;
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const regularCount = users.filter((u) => u.role === 'user').length;

  const userStats = [
    { type: 'Admin Users', count: adminCount },
    { type: 'Regular Users', count: regularCount },
  ];

  const chartConfig = {
    data: userStats,
    xField: 'type',
    yField: 'count',
    height: 220,
    columnStyle: { radius: [4, 4, 0, 0] },
    color: ['#1890ff', '#13c2c2'],
    label: {
      position: 'top',
      style: {
        fill: '#FFFFFF',
        opacity: 0.7,
      },
    },
    yAxis: {
      min: 0,
      tickInterval: 1,
    },
    meta: {
      type: { alias: 'User Role' },
      count: { alias: 'Number of Users' },
    },
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await axios.get(`${BASE_URL}/users`, { withCredentials: true });
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch {
      message.error('Error fetching users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await axios.get(`${BASE_URL}/files`, { withCredentials: true });
      setFiles(Array.isArray(res.data) ? res.data : []);
    } catch {
      message.error('Error fetching files');
    } finally {
      setLoadingFiles(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/auditlogs`, { withCredentials: true });
      setAuditLogs(Array.isArray(res.data) ? res.data : []);
    } catch {
      message.error('Error fetching audit logs');
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchFiles();
    fetchAuditLogs();
  }, []);

  return (
    <div style={{ padding: '16px 24px', maxWidth: 1200, margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 24, textAlign: 'center' }}>Dashboard</Title>
      
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card bodyStyle={{ padding: '24px' }} style={{ borderRadius: 8 }} hoverable>
            <Statistic 
              title="Total Users" 
              value={totalUsers} 
              loading={loadingUsers}
              valueStyle={{ fontSize: 32, fontWeight: 600 }}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={8}>
          <Card bodyStyle={{ padding: '24px' }} style={{ borderRadius: 8 }} hoverable>
            <Statistic 
              title="Total Files" 
              value={totalFiles} 
              loading={loadingFiles}
              valueStyle={{ fontSize: 32, fontWeight: 600 }}
              prefix={<FileOutlined />}
            />
          </Card>
        </Col>
        
        <Col xs={24} md={8}>
          <Card bodyStyle={{ padding: '24px' }} style={{ borderRadius: 8 }} hoverable>
            <Statistic 
              title="Admin Users" 
              value={adminCount} 
              loading={loadingUsers}
              valueStyle={{ fontSize: 32, fontWeight: 600 }}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card 
            title="User Role Distribution"
            style={{ borderRadius: 8 }}
            headStyle={{ borderBottom: 0 }}
            bodyStyle={{ padding: '16px 24px' }}
          >
            <Column {...chartConfig} />
          </Card>
        </Col>
        
        <Col xs={24} lg={12}>
          <Card 
            title="Recent Audit Logs"
            style={{ borderRadius: 8 }}
            headStyle={{ borderBottom: 0 }}
            bodyStyle={{ padding: '16px 24px' }}
            extra={
              <Button 
                type="link" 
                size="small" 
                onClick={() => navigate('audit-logs')}
              >
                View All
              </Button>
            }
          >
            {auditLogs.length > 0 ? (
              <List
                size="small"
                dataSource={auditLogs.slice(0, 5)}
                renderItem={(item) => (
                  <List.Item style={{ padding: '8px 0' }}>
                    <div>
                      <Text strong>{new Date(item.created_at).toLocaleString()}</Text><br />
                      <Text type="secondary">{item.details}</Text>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">No audit logs available</Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AdminDashboardHome;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Statistic, List, Button, Typography, message } from 'antd';
import { Column } from '@ant-design/charts';
import axios from 'axios';

const { Text } = Typography;

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
    height: 180,
    columnStyle: { radius: [4, 4, 0, 0] },
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
      const res = await axios.get('/users', { withCredentials: true });
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
      const res = await axios.get('/files', { withCredentials: true });
      setFiles(Array.isArray(res.data) ? res.data : []);
    } catch {
      message.error('Error fetching files');
    } finally {
      setLoadingFiles(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await axios.get('/auditlogs', { withCredentials: true });
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
    <div style={{ padding: 24 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic title="Total Users" value={totalUsers} loading={loadingUsers} />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic title="Total Files" value={totalFiles} loading={loadingFiles} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} md={12}>
          <Card title="Audit Logs">
            <List
              size="small"
              dataSource={auditLogs.slice(0, 5)}
              renderItem={(item) => (
                <List.Item>
                  <Text>
                    <strong>{new Date(item.created_at).toLocaleTimeString()}</strong>: {item.details}
                  </Text>
                </List.Item>
              )}
            />
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <Button type="link" size="small" onClick={() => navigate('audit-logs')}>
                View All
              </Button>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="User Role Distribution">
            <Column {...chartConfig} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AdminDashboardHome;
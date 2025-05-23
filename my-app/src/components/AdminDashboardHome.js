import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Statistic, List, Button, Typography, message } from 'antd';
import { Column } from '@ant-design/charts';
import { UserOutlined, FileOutlined, TeamOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Text, Title } = Typography;

const AdminDashboardHome = () => {
  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const navigate = useNavigate();

  const getRole = (user) => user.role || user.userRole || user.type || '';

  const totalUsers = users.length;
  const totalFiles = files.length;
  const adminCount = users.filter((u) => getRole(u) === 'admin').length;
  const regularCount = users.filter((u) => getRole(u) === 'user').length;

  // Prepare chart data: uploads per user per month
  const getMonthYear = (dateString) => {
    const date = new Date(dateString);
    return `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
  };

  // Group files by uploader and month
  const uploadsPerUserMonth = {};
  files.forEach(file => {
    if (!file.uploader) return;
    // Use uploaded_at if available, otherwise fallback to created_at
    const dateField = file.uploaded_at || file.created_at;
    if (!dateField) return;
    const monthYear = getMonthYear(dateField);
    if (!uploadsPerUserMonth[monthYear]) uploadsPerUserMonth[monthYear] = {};
    if (!uploadsPerUserMonth[monthYear][file.uploader]) uploadsPerUserMonth[monthYear][file.uploader] = 0;
    uploadsPerUserMonth[monthYear][file.uploader] += 1;
  });

  // Flatten to array for chart
  const chartData = [];
  Object.entries(uploadsPerUserMonth).forEach(([monthYear, userCounts]) => {
    Object.entries(userCounts).forEach(([uploader, count]) => {
      chartData.push({ month: monthYear, user: uploader, uploads: count });
    });
  });

  // Sort months for better chart display
  chartData.sort((a, b) => {
    const [aMonth, aYear] = a.month.split(' ');
    const [bMonth, bYear] = b.month.split(' ');
    const monthOrder = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    if (aYear !== bYear) return parseInt(aYear) - parseInt(bYear);
    return monthOrder.indexOf(aMonth) - monthOrder.indexOf(bMonth);
  });

  const chartConfig = {
    data: chartData,
    isGroup: true,
    xField: 'month',
    yField: 'uploads',
    seriesField: 'user',
    height: 260,
    columnStyle: { radius: [4, 4, 0, 0] },
    color: ['#1890ff', '#13c2c2', '#faad14', '#52c41a', '#eb2f96', '#722ed1'],
    label: {
      position: 'top',
      style: {
        fill: '#333',
        fontWeight: 600,
        opacity: 0.9,
      },
    },
    xAxis: {
      title: { text: 'Month' },
      label: { autoHide: true, autoRotate: false },
    },
    yAxis: {
      title: { text: 'Uploads' },
      min: 0,
      tickInterval: 1,
    },
    meta: {
      month: { alias: 'Month' },
      user: { alias: 'User' },
      uploads: { alias: 'Number of Uploads' },
    },
    tooltip: {
      showMarkers: true,
      shared: true,
    },
    legend: { position: 'top' },
  };


  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await axios.get('/users', { withCredentials: true });
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error fetching users:', error);
      message.error('Failed to fetch users: ' + (error.message || 'Unknown error'));
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await axios.get('/files/all', { withCredentials: true });
      setFiles(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error fetching files:', error);
      message.error('Failed to fetch files: ' + (error.message || 'Unknown error'));
    } finally {
      setLoadingFiles(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await axios.get('/auditlogs', { withCredentials: true });
      setAuditLogs(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      message.error('Failed to fetch audit logs: ' + (error.message || 'Unknown error'));
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await axios.get('/activities', { withCredentials: true });
      setActivities(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error fetching activities:', error);
      message.error('Failed to fetch activities: ' + (error.message || 'Unknown error'));
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchFiles();
    fetchAuditLogs();
    fetchActivities();
  }, []);

  return (
    <div style={{ padding: '16px 24px', maxWidth: 1200, margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 24, textAlign: 'center' }}>
        Welcome to the Admin Dashboard
      </Title>
      
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card 
            bodyStyle={{ padding: '24px' }}
            style={{ height: '100%', borderRadius: 8 }}
            hoverable
          >
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
          <Card 
            bodyStyle={{ padding: '24px' }}
            style={{ height: '100%', borderRadius: 8 }}
            hoverable
          >
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
          <Card 
            bodyStyle={{ padding: '24px' }}
            style={{ height: '100%', borderRadius: 8 }}
            hoverable
          >
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
            title="Uploads Per User Per Month"
            style={{ borderRadius: 8 }}
            headStyle={{ borderBottom: 0, padding: '16px 24px 8px' }}
            bodyStyle={{ padding: '16px 24px' }}
          >
            {chartData.length > 0 ? (
              <Column {...chartConfig} />
            ) : (
              <Text type="secondary">No uploads available</Text>
            )}
          </Card>
        </Col>
        
        <Col xs={24} lg={12}>
          <Card 
            title="Recent Audit Logs"
            style={{ borderRadius: 8, marginBottom: 24 }}
            headStyle={{ borderBottom: 0, padding: '16px 24px 8px' }}
            bodyStyle={{ padding: '16px 24px' }}
            extra={
              <Button 
                type="link" 
                size="small" 
                onClick={() => navigate('audit-logs')}
                style={{ padding: '0 4px' }}
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
                    <div style={{ width: '100%' }}>
                      <Text strong style={{ display: 'block' }}>
                        {new Date(item.created_at).toLocaleString()}
                      </Text>
                      <Text type="secondary" style={{ display: 'block' }}>
                        {item.details}
                      </Text>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">No audit logs available</Text>
            )}
          </Card>
          
          <Card 
            title="Recent User Activities"
            style={{ borderRadius: 8 }}
            headStyle={{ borderBottom: 0, padding: '16px 24px 8px' }}
            bodyStyle={{ padding: '16px 24px' }}
            extra={
              <Button 
                type="link" 
                size="small" 
                onClick={() => navigate('user-activities')}
                style={{ padding: '0 4px' }}
              >
                View All
              </Button>
            }
          >
            {activities.length > 0 ? (
              <List
                size="small"
                dataSource={activities.slice(0, 3)}
                renderItem={(item) => (
                  <List.Item style={{ padding: '8px 0' }}>
                    <div style={{ width: '100%' }}>
                      <Text strong style={{ display: 'block' }}>
                        {new Date(item.timestamp).toLocaleString()}
                      </Text>
                      <Text type="secondary" style={{ display: 'block' }}>
                        {item.event}
                      </Text>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">No user activities available</Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AdminDashboardHome;

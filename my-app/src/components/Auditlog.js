import React, { useEffect, useState } from 'react';
import { Layout, Table, Button, message, Typography, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Content } = Layout;
const { Title } = Typography;

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

const AuditLog = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // ✅ Fetch audit logs instead of activities
  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/auditlogs`, { withCredentials: true });  // Correct endpoint
      setAuditLogs(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      message.error('Error fetching audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch on component mount
    fetchAuditLogs();

    // Set up polling to fetch audit logs every 5 seconds (5000 ms)
    const interval = setInterval(() => {
      fetchAuditLogs();
    }, 5000);

    // Clean up the interval when the component unmounts
    return () => clearInterval(interval);
  }, []);

  const columns = [
    {
      title: 'Timestamp',
      dataIndex: 'created_at',   // ✅ Use `created_at` for audit logs
      key: 'created_at',
      render: (timestamp) => new Date(timestamp).toLocaleString(),
      width: 250,
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
    },
    {
      title: 'User',
      dataIndex: 'user_username',   // ✅ Display the username from audit log
      key: 'user_username',
      render: (val, record) => {
        // If user_username is null (user deleted), use username_at_action
        const displayName = val || record.username_at_action || '<deleted user>';
        return <span style={{ fontSize: '16px' }}>{displayName}</span>;
      }
    },
    {
      title: 'Action',
      dataIndex: 'action',         // ✅ Display the action
      key: 'action',
      render: (action) => <span style={{ fontSize: '16px' }}>{action}</span>,
    },
    {
      title: 'Details',
      dataIndex: 'details',        // ✅ Display the details of the action
      key: 'details',
      render: (details) => <span style={{ fontSize: '16px' }}>{details}</span>,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content
        style={{
          margin: '24px',
          padding: '24px',
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <Title level={2} style={{ marginBottom: '24px' }}>
          Audit Logs
        </Title>
        <Table
          loading={loading}
          columns={columns}
          dataSource={auditLogs}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['5', '10', '20'],
          }}
          style={{ marginBottom: '24px' }}
        />
        <Space>
          <Button type="primary" onClick={() => navigate('/admin')}>
            Back to Dashboard
          </Button>
        </Space>
      </Content>
    </Layout>
  );
};

export default AuditLog;

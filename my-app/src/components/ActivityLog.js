import React, { useEffect, useState } from 'react';
import { Layout, Table, Button, message, Typography, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Content } = Layout;
const { Title } = Typography;

const ActivityLog = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/activities', { withCredentials: true });
      setActivities(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      message.error('Error fetching activity logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const columns = [
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp) => new Date(timestamp).toLocaleString(),
      width: 250,
      sorter: (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
    },
    {
      title: 'Event',
      dataIndex: 'event',
      key: 'event',
      render: (event) => <span style={{ fontSize: '16px' }}>{event}</span>,
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
          Activity Log
        </Title>
        <Table
          loading={loading}
          columns={columns}
          dataSource={activities}
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

export default ActivityLog;

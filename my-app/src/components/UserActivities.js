import React, { useState, useEffect } from 'react';
import { Layout, Table, Button, Typography, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Content } = Layout;
const { Title } = Typography;

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

const UserActivities = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/activities`, { withCredentials: true });
      setActivities(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setActivities([]);
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
      render: (ts) => new Date(ts).toLocaleString(),
      sorter: (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
      defaultSortOrder: 'descend',
      sortDirections: ['descend', 'ascend'],
    },
    {
      title: 'Event',
      dataIndex: 'event',
      key: 'event',
      render: (text) => <span style={{ fontSize: '16px' }}>{text}</span>,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#fff' }}>
      <Content style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
        <Title level={3} style={{ marginBottom: 24 }}>User Activities</Title>
        <Table
          loading={loading}
          columns={columns}
          dataSource={activities}
          rowKey={(record, idx) => record.id || record.timestamp + idx}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['5', '10', '20'],
          }}
          style={{ marginBottom: '24px' }}
        />
        <Space>
          <Button type="primary" onClick={() => navigate('/admin')}>Back to Dashboard</Button>
        </Space>
      </Content>
    </Layout>
  );
};

export default UserActivities;

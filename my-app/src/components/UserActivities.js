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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <Title level={2} style={{ margin: 0 }}>User Activities</Title>
          <Button 
            type="primary" 
            onClick={() => navigate('/admin')}
            style={{ marginLeft: '16px' }}
          >
            Back to Dashboard
          </Button>
        </div>
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
      </Content>
    </Layout>
  );
};

export default UserActivities;

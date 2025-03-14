import React, { useEffect, useState } from 'react';
import { Layout, List, Button, message, Typography } from 'antd';
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
      // Ensure the response is an array; otherwise fallback to an empty array.
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

  return (
    <Layout style={{ minHeight: '100vh', padding: '24px', background: '#f0f2f5' }}>
      <Content style={{ maxWidth: 1200, margin: '0 auto', background: '#fff', padding: '24px', borderRadius: '8px' }}>
        <Title level={2}>Activity Log</Title>
        <List
          loading={loading}
          itemLayout="vertical"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['5', '10', '20'],
          }}
          dataSource={activities}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={new Date(item.timestamp).toLocaleString()}
                description={item.event}
              />
            </List.Item>
          )}
        />
        <Button type="primary" onClick={() => navigate('/admin')} style={{ marginTop: '16px' }}>
          Back to Dashboard
        </Button>
      </Content>
    </Layout>
  );
};

export default ActivityLog;

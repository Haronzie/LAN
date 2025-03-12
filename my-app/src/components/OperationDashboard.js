import React, { useState, useEffect } from 'react';
import { Typography, Button, Row, Col, Card, Statistic, Divider, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { WarningOutlined, CheckCircleOutlined, BarChartOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Paragraph } = Typography;

const OperationDashboard = () => {
  const navigate = useNavigate();
  // Example state for operational metrics
  const [metrics, setMetrics] = useState({
    pendingOperations: 0,
    completedOperations: 0,
    errorRate: 0,
  });

  // Fetch operational metrics from an API endpoint
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // Replace this URL with your real endpoint
        const res = await axios.get('/operation-metrics', { withCredentials: true });
        setMetrics(res.data);
      } catch (error) {
        message.error('Error fetching operational metrics');
      }
    };

    fetchMetrics();
  }, []);

  const handleGoToDetails = () => {
    // Navigate to a dedicated operation details page
    navigate('/user/operation/details');
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ textAlign: 'center', marginBottom: 16 }}>
        Operation Dashboard
      </Title>
      <Paragraph style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 24px' }}>
        View operational metrics, performance reports, and workflow status to monitor your system's efficiency.
      </Paragraph>

      <Row gutter={[16, 16]} justify="center">
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Pending Operations"
              value={metrics.pendingOperations}
              prefix={<WarningOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Completed Operations"
              value={metrics.completedOperations}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Error Rate (%)"
              value={metrics.errorRate}
              precision={2}
              prefix={<BarChartOutlined style={{ color: '#ff4d4f' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Divider />

      <Row justify="center">
        <Button type="primary" size="large" onClick={handleGoToDetails}>
          View Detailed Operations
        </Button>
      </Row>
    </div>
  );
};

export default OperationDashboard;

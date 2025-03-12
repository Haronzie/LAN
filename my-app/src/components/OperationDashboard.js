// src/components/OperationDashboard.js
import React from 'react';
import { Typography, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph } = Typography;

const OperationDashboard = () => {
  const navigate = useNavigate();

  const handleGoToDetails = () => {
    // Navigate to a dedicated operation details page
    navigate('/user/operation/details');
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <Title level={3}>Operation Dashboard</Title>
      <Paragraph>
        View operational metrics, performance reports, and workflow status.
      </Paragraph>
      <Button type="primary" onClick={handleGoToDetails}>
        Go to Operation Details
      </Button>
    </div>
  );
};

export default OperationDashboard;

// src/components/ResearchDashboard.js
import React from 'react';
import { Typography, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph } = Typography;

const ResearchDashboard = () => {
  const navigate = useNavigate();

  const handleGoToDetails = () => {
    // Navigate to a dedicated research details page
    navigate('/user/research/details');
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <Title level={3}>Research Dashboard</Title>
      <Paragraph>
        Explore research data, project reports, and analytical insights.
      </Paragraph>
      <Button type="primary" onClick={handleGoToDetails}>
        Go to Research Details
      </Button>
    </div>
  );
};

export default ResearchDashboard;

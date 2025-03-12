// src/components/TrainingDashboard.js
import React from 'react';
import { Typography, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph } = Typography;

const TrainingDashboard = () => {
  const navigate = useNavigate();

  const handleGoToDetails = () => {
    // Navigate to a dedicated training details page
    navigate('/user/training/details');
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <Title level={3}>Training Dashboard</Title>
      <Paragraph>
        Access training materials, courses, and resources to enhance your skills.
      </Paragraph>
      <Button type="primary" onClick={handleGoToDetails}>
        Go to Training Details
      </Button>
    </div>
  );
};

export default TrainingDashboard;

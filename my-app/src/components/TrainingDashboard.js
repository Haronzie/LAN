import React, { useState, useEffect } from 'react';
import { Layout, Row, Col, Card, Statistic, Typography, Button, Divider, List, message } from 'antd';
import { BookOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Content } = Layout;
const { Title } = Typography;

const TrainingDashboard = () => {
  const navigate = useNavigate();
  
  // State for training metrics and courses
  const [metrics, setMetrics] = useState({
    totalCourses: 0,
    completedCourses: 0,
    upcomingCourses: 0,
  });
  const [courses, setCourses] = useState([]);

  // Fetch training metrics from your API endpoint
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await axios.get('/training-metrics', { withCredentials: true });
        setMetrics(res.data);
      } catch (error) {
        message.error('Error fetching training metrics');
        // Fallback dummy data
        setMetrics({
          totalCourses: 12,
          completedCourses: 7,
          upcomingCourses: 5,
        });
      }
    };
    fetchMetrics();
  }, []);

  // Fetch courses from your API endpoint
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await axios.get('/training-courses', { withCredentials: true });
        setCourses(res.data);
      } catch (error) {
        message.error('Error fetching training courses');
        // Fallback dummy data
        setCourses([
          { id: 1, title: "React Basics", description: "Introduction to React", progress: "Completed" },
          { id: 2, title: "Advanced React", description: "Hooks, Context, and more", progress: "In Progress" },
          { id: 3, title: "Node.js Fundamentals", description: "Backend with Node.js", progress: "Upcoming" },
        ]);
      }
    };
    fetchCourses();
  }, []);

  const handleGoToDetails = () => {
    navigate('/user/training/details');
  };

  return (
    <Content style={{ padding: '24px', background: '#f0f2f5' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
        <Title level={2}>Training Dashboard</Title>
        <Typography.Paragraph style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 24px' }}>
          Access a wide range of training courses and resources designed to enhance your skills.
        </Typography.Paragraph>

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Total Courses"
                value={metrics.totalCourses}
                prefix={<BookOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Completed Courses"
                value={metrics.completedCourses}
                prefix={<BookOutlined style={{ color: '#52c41a' }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Upcoming Courses"
                value={metrics.upcomingCourses}
                prefix={<BookOutlined style={{ color: '#faad14' }} />}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} justify="center">
          {courses.map(course => (
            <Col xs={24} sm={12} md={8} key={course.id}>
              <Card
                title={course.title}
                extra={<Button type="link" onClick={handleGoToDetails}><ArrowRightOutlined /></Button>}
                hoverable
              >
                <Typography.Paragraph>{course.description}</Typography.Paragraph>
                <Typography.Paragraph strong>Status: {course.progress}</Typography.Paragraph>
              </Card>
            </Col>
          ))}
        </Row>

        <Divider />

        <div style={{ marginTop: 24 }}>
          <Button type="primary" size="large" onClick={handleGoToDetails}>
            View Detailed Training Information
          </Button>
        </div>
      </div>
    </Content>
  );
};

export default TrainingDashboard;

import React, { useState, useEffect } from 'react';
import { Layout, Row, Col, Card, Statistic, Typography, Button, Divider, List, message } from 'antd';
import { FileSearchOutlined, BarChartOutlined, ReadOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Content } = Layout;
const { Title, Paragraph } = Typography;

const ResearchDashboard = () => {
  const navigate = useNavigate();

  // States for research metrics and projects
  const [metrics, setMetrics] = useState({
    totalProjects: 0,
    ongoingProjects: 0,
    publishedReports: 0,
  });
  const [projects, setProjects] = useState([]);

  // Fetch research metrics from an API endpoint
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await axios.get('/research-metrics', { withCredentials: true });
        setMetrics(res.data);
      } catch (error) {
        message.error('Error fetching research metrics');
        // Fallback dummy data
        setMetrics({
          totalProjects: 20,
          ongoingProjects: 8,
          publishedReports: 12,
        });
      }
    };
    fetchMetrics();
  }, []);

  // Fetch research projects from an API endpoint
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await axios.get('/research-projects', { withCredentials: true });
        setProjects(res.data);
      } catch (error) {
        message.error('Error fetching research projects');
        // Fallback dummy data
        setProjects([
          { id: 1, title: "Climate Change Impact", description: "Study on climate change and its effects", status: "Ongoing" },
          { id: 2, title: "Urban Development", description: "Analysis of urban growth patterns", status: "Published" },
          { id: 3, title: "Renewable Energy", description: "Research on renewable energy adoption", status: "Ongoing" },
        ]);
      }
    };
    fetchProjects();
  }, []);

  const handleGoToDetails = () => {
    navigate('/user/research/details');
  };

  return (
    <Content style={{ padding: '24px', background: '#f0f2f5' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
        <Title level={2}>Research Dashboard</Title>
        <Paragraph style={{ maxWidth: 600, margin: '0 auto 24px' }}>
          Explore our latest research data, project reports, and analytical insights to help drive informed decisions.
        </Paragraph>
        
        {/* Metrics Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }} justify="center">
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Total Projects"
                value={metrics.totalProjects}
                prefix={<FileSearchOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Ongoing Projects"
                value={metrics.ongoingProjects}
                prefix={<BarChartOutlined style={{ color: '#faad14' }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Published Reports"
                value={metrics.publishedReports}
                prefix={<ReadOutlined style={{ color: '#52c41a' }} />}
              />
            </Card>
          </Col>
        </Row>
        
        <Divider />
        
        {/* Research Projects Grid */}
        <Row gutter={[16, 16]} justify="center">
          {projects.map(project => (
            <Col xs={24} sm={12} md={8} key={project.id}>
              <Card
                title={project.title}
                extra={
                  <Button type="link" onClick={handleGoToDetails}>
                    <ArrowRightOutlined />
                  </Button>
                }
                hoverable
              >
                <Paragraph>{project.description}</Paragraph>
                <Paragraph strong>Status: {project.status}</Paragraph>
              </Card>
            </Col>
          ))}
        </Row>
        
        <div style={{ marginTop: 24 }}>
          <Button type="primary" size="large" onClick={handleGoToDetails}>
            View Detailed Research Information
          </Button>
        </div>
      </div>
    </Content>
  );
};

export default ResearchDashboard;

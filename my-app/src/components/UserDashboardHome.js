import React, { useState, useEffect } from 'react';
import { Layout, Row, Col, Card, Typography, Badge, Button, Space, Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  FireOutlined,
  RadarChartOutlined,
  TeamOutlined,
  DatabaseOutlined,
  FileOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';

const { Title } = Typography;

const UserDashboardHome = () => {
  const [username, setUsername] = useState('');
  const [filesWithTasks, setFilesWithTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }
    fetchFilesWithTasks();

    // Set up polling to check for new tasks every 30 seconds
    const interval = setInterval(fetchFilesWithTasks, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchFilesWithTasks = async () => {
    setLoading(true);
    try {
      // Get the current username from state or localStorage
      const currentUsername = username || localStorage.getItem('username');
      if (!currentUsername) {
        console.error('UserDashboardHome: No username found');
        return;
      }

      console.log(`UserDashboardHome: Fetching files with tasks for user: ${currentUsername}...`);

      // Add a timestamp to prevent caching
      const timestamp = new Date().getTime();
      const res = await axios.get(`/files-with-messages?_t=${timestamp}`, {
        withCredentials: true,
        // Add a timeout to prevent hanging requests
        timeout: 10000
      });

      console.log('UserDashboardHome: Files with tasks response:', res.data);

      // Ensure we have an array, even if empty
      const tasksData = Array.isArray(res.data) ? res.data : [];
      setFilesWithTasks(tasksData);

      // Check if there are any tasks
      if (tasksData.length === 0) {
        console.log('UserDashboardHome: No files with tasks found');
      } else {
        console.log(`UserDashboardHome: Found ${tasksData.length} files with tasks`);

        // Count total messages and pending tasks
        let totalMessages = 0;
        let pendingTasks = 0;

        tasksData.forEach(file => {
          if (Array.isArray(file.messages)) {
            totalMessages += file.messages.length;
            pendingTasks += file.messages.filter(msg => !msg.is_done).length;
          }
        });

        console.log(`UserDashboardHome: Total messages: ${totalMessages}, Pending tasks: ${pendingTasks}`);
      }

      // If we expected tasks but didn't find any, log additional debug info
      if (tasksData.length === 0) {
        // Make a separate request to check if the user has any messages in the database
        try {
          const checkRes = await axios.get('/user-role', { withCredentials: true });
          console.log('UserDashboardHome: User role check:', checkRes.data);
        } catch (checkErr) {
          console.error('UserDashboardHome: Error checking user role:', checkErr);
        }
      }
    } catch (error) {
      console.error('UserDashboardHome: Error fetching files with tasks:', error);
      if (error.response) {
        console.error('UserDashboardHome: Response data:', error.response.data);
        console.error('UserDashboardHome: Response status:', error.response.status);
      } else if (error.request) {
        console.error('UserDashboardHome: No response received:', error.request);
      } else {
        console.error('UserDashboardHome: Error setting up request:', error.message);
      }
      message.error('Failed to load your assigned tasks');
    } finally {
      setLoading(false);
    }
  };

  const dashboards = [
    {
      key: 'operation',
      title: 'Operation Dashboard',
      icon: <FireOutlined style={{ fontSize: '70px', color: '#d4380d' }} />,
      route: '/user/operation',
    },
    {
      key: 'research',
      title: 'Research Dashboard',
      icon: <RadarChartOutlined style={{ fontSize: '70px', color: '#1890ff' }} />,
      route: '/user/research',
    },
    {
      key: 'training',
      title: 'Training Dashboard',
      icon: <TeamOutlined style={{ fontSize: '70px', color: '#52c41a' }} />,
      route: '/user/training',
    },
    {
      key: 'inventory',
      title: 'Inventory Dashboard',
      icon: <DatabaseOutlined style={{ fontSize: '70px', color: '#faad14' }} />,
      route: '/user/inventory',
    },
  ];

  // Function to navigate to the file's directory
  const navigateToFile = (directory) => {
    // Extract the main folder from the directory path
    const mainFolder = directory.split('/')[0].toLowerCase();

    // Navigate to the appropriate dashboard based on the main folder
    if (mainFolder === 'operation') {
      navigate('/user/operation');
    } else if (mainFolder === 'research') {
      navigate('/user/research');
    } else if (mainFolder === 'training') {
      navigate('/user/training');
    } else {
      // Default to operation if we can't determine
      navigate('/user/operation');
    }
  };

  // Function to mark a task as done
  const markTaskAsDone = async (messageId) => {
    try {
      await axios.patch(
        `/file/message/${messageId}/done`,
        {},
        { withCredentials: true }
      );
      message.success('Task marked as done');
      fetchFilesWithTasks(); // Refresh the list
    } catch (err) {
      console.error('Error marking task as done:', err);
      message.error('Failed to mark task as done');
    }
  };

  return (
    <div style={{
      height: 'calc(100vh - 112px)',
      padding: '24px',
      background: '#f0f2f5',
      overflow: 'auto',
      boxSizing: 'border-box'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Assigned Tasks Section */}
        {filesWithTasks.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <Title level={3} style={{ marginBottom: '16px' }}>
              Your Assigned Tasks
            </Title>
            <Row gutter={[16, 16]}>
              {loading ? (
                <Col span={24} style={{ textAlign: 'center', padding: '20px' }}>
                  <Spin size="large" />
                </Col>
              ) : (
                filesWithTasks.map(file => (
                  <Col xs={24} sm={24} md={12} lg={8} key={file.id}>
                    <Card
                      title={
                        <Space>
                          <FileOutlined />
                          <span>{file.name}</span>
                          <Badge
                            count={file.messages.filter(msg => !msg.is_done).length}
                            style={{ backgroundColor: '#1890ff' }}
                          />
                        </Space>
                      }
                      extra={
                        <Button
                          type="link"
                          onClick={() => navigateToFile(file.directory)}
                        >
                          View
                        </Button>
                      }
                      style={{ marginBottom: 16 }}
                    >
                      {file.messages.map(msg => (
                        <div
                          key={msg.id}
                          style={{
                            padding: '8px',
                            marginBottom: '8px',
                            background: msg.is_done ? '#f6ffed' : '#f0f5ff',
                            borderLeft: `3px solid ${msg.is_done ? '#52c41a' : '#1890ff'}`,
                            borderRadius: '4px'
                          }}
                        >
                          <div style={{ marginBottom: '4px' }}>
                            <strong>Task:</strong> {msg.message}
                          </div>
                          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                            From: {msg.sender} · {new Date(msg.created_at).toLocaleString()}
                          </div>
                          <div>
                            {msg.is_done ? (
                              <span style={{ color: '#52c41a' }}>
                                <CheckCircleOutlined /> Completed
                              </span>
                            ) : (
                              <Space>
                                <span style={{ color: '#1890ff' }}>
                                  <ClockCircleOutlined /> Pending
                                </span>
                                <Button
                                  type="primary"
                                  size="small"
                                  onClick={() => markTaskAsDone(msg.id)}
                                >
                                  Mark as Done
                                </Button>
                              </Space>
                            )}
                          </div>
                        </div>
                      ))}
                    </Card>
                  </Col>
                ))
              )}
            </Row>
          </div>
        )}

        {/* Dashboard Cards */}
        <div style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingTop: filesWithTasks.length > 0 ? '20px' : '50px',
        }}>
          <Row
            gutter={[32, 32]}
            justify="center"
            style={{
              width: '100%',
              maxWidth: '1100px',
              paddingBottom: '24px'
            }}
          >
            {dashboards.map((dashboard) => (
              <Col
                key={dashboard.key}
                xs={24}
                sm={12}
                md={12}
                lg={6}
                style={{
                  display: 'flex',
                  justifyContent: 'center'
                }}
              >
                <Card
                  hoverable
                  onClick={() => navigate(dashboard.route)}
                  styles={{
                    // Base styles
                    root: {
                      width: '100%',
                      minWidth: '220px',
                      maxWidth: '260px',
                      height: '240px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                    },
                    // Hover styles (Ant Design v5+ syntax)
                    hoverable: {
                      '&:hover': {
                        transform: 'scale(1.07) translateY(-5px)',
                        boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
                        borderColor: '#1890ff',
                        '& .ant-card-body': {
                          backgroundColor: 'rgba(24, 144, 255, 0.03)' // subtle blue tint
                        }
                      }
                    }
                  }}
                  bodyStyle={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    padding: '20px',
                    transition: 'background-color 0.3s ease'
                  }}
                >
                  {dashboard.icon}
                  <Title level={4} style={{
                    marginTop: '20px',
                    marginBottom: 0,
                    textAlign: 'center',
                    fontSize: '25px',
                    transition: 'color 0.3s ease'
                  }}>
                    {dashboard.title}
                  </Title>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </div>
    </div>
  );
};

export default UserDashboardHome;
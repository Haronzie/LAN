import React, { useState, useEffect } from 'react';
import { Badge, Dropdown, List, Avatar, Button, Space, Typography, Empty } from 'antd';
import { BellOutlined, FileOutlined, CheckOutlined, ClockCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

const NotificationDropdown = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    
    // Set up polling to check for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    
    // Add event listener for file deletion or other actions that should trigger a refresh
    const handleRefreshEvent = () => {
      console.log('Received notification refresh event - refreshing notifications');
      fetchNotifications();
    };
    
    window.addEventListener('refreshNotifications', handleRefreshEvent);
    
    // Clean up event listeners and intervals on component unmount
    return () => {
      clearInterval(interval);
      window.removeEventListener('refreshNotifications', handleRefreshEvent);
    };
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      // Get the current username for debugging
      const username = localStorage.getItem('username');
      if (!username) {
        console.error('No username found in localStorage');
        return;
      }

      console.log(`Fetching notifications for user: ${username}...`);

      // Add a timestamp to prevent caching
      const timestamp = new Date().getTime();
      const res = await axios.get(`/files-with-messages?_t=${timestamp}`, {
        withCredentials: true,
        // Add a timeout to prevent hanging requests
        timeout: 10000
      });

      console.log('Notifications response:', res.data);

      // Ensure we have an array, even if empty
      const notificationData = Array.isArray(res.data) ? res.data : [];
      setNotifications(notificationData);

      // Count pending tasks
      const pendingCount = notificationData.reduce((count, file) => {
        return count + (file.messages || []).filter(msg => !msg.is_done).length;
      }, 0);

      console.log(`Current user: ${username}, Pending tasks count: ${pendingCount}`);

      // If we have no notifications but expected some, log this for debugging
      if (notificationData.length === 0) {
        console.log('No notifications found for the current user');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received:', error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error setting up request:', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const markTaskAsDone = async (messageId) => {
    try {
      await axios.patch(
        `/file/message/${messageId}/done`,
        {},
        { withCredentials: true }
      );
      fetchNotifications(); // Refresh notifications after marking as done
    } catch (err) {
      console.error('Error marking task as done:', err);
    }
  };

  const navigateToFile = (file) => {
    console.log('Navigating to file in dropdown:', file);
    
    // Force a reload approach to ensure a clean navigation state
    // First, let's set up the required information in localStorage
    
    // Store ALL the details about the file and directory
    localStorage.setItem('openFileAfterNavigation', JSON.stringify({
      id: file.id,
      name: file.name,
      directory: file.directory,
      type: 'file',
      timestamp: new Date().getTime(), // Add timestamp to ensure it's treated as a new request
      source: 'notification', // Mark that this navigation came from a notification
      pathSegments: file.directory.split('/'), // Store path segments for step navigation
      exactLocation: true, // Flag to indicate we want to go to the exact location
      fullPath: file.directory // Store the complete path for direct navigation
    }));
    
    // Enable force flags with higher priority
    localStorage.setItem('forceOpenFile', 'true');
    localStorage.setItem('notificationNavigation', 'true');
    localStorage.setItem('directNavigation', 'true'); // New flag for direct navigation
    
    // Extract the main folder from the directory path
    const pathParts = file.directory.split('/');
    const mainFolder = pathParts[0].toLowerCase();
    console.log('Main folder determined as:', mainFolder);
    console.log('Full directory path:', file.directory);
    console.log('Path segments:', pathParts);
    
    // Navigate to the appropriate dashboard based on the main folder
    if (mainFolder === 'operation') {
      navigate('/user/operation');
    } else if (mainFolder === 'research') {
      navigate('/user/research');
    } else if (mainFolder === 'training') {
      navigate('/user/training');
    } else {
      // Default to operation if we can't determine
      console.log('Could not determine folder, defaulting to operation');
      navigate('/user/operation');
    }
  };

  // Count pending tasks (messages that are not marked as done)
  const pendingTasksCount = notifications.reduce((count, file) => {
    return count + file.messages.filter(msg => !msg.is_done).length;
  }, 0);

  const items = [
    {
      key: '1',
      label: (
        <div style={{ width: 350, maxHeight: 400, overflow: 'auto' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
            <Text strong>Task Notifications</Text>
          </div>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center' }}>Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <Empty
              description="No pending tasks"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ padding: '20px 0' }}
            />
          ) : (
            <List
              itemLayout="horizontal"
              dataSource={notifications}
              renderItem={file => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<FileOutlined />} style={{ backgroundColor: '#1890ff' }} />}
                    title={<a onClick={() => navigateToFile(file)}>{file.name}</a>}
                    description={
                      <div>
                        {file.messages.map(msg => (
                          <div key={msg.id} style={{
                            marginBottom: 8,
                            padding: 8,
                            background: msg.is_done ? '#f6ffed' : '#f0f5ff',
                            borderRadius: 4,
                            borderLeft: `3px solid ${msg.is_done ? '#52c41a' : '#1890ff'}`
                          }}>
                            <div>
                              <a 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('Notification message clicked, navigating to:', file.name, 'in', file.directory);
                                  // Ensure we navigate with high priority
                                  localStorage.setItem('highPriorityNavigation', 'true');
                                  navigateToFile(file);
                                }}
                                style={{ cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}
                              >
                                {msg.message}
                              </a>
                            </div>
                            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                              From: {msg.sender} · {new Date(msg.created_at).toLocaleString()}
                            </div>
                            <div style={{ marginTop: 8 }}>
                              {msg.is_done ? (
                                <Space>
                                  <CheckOutlined style={{ color: '#52c41a' }} />
                                  <Text type="success">Completed</Text>
                                </Space>
                              ) : (
                                <Space>
                                  <ClockCircleOutlined style={{ color: '#1890ff' }} />
                                  <Text type="secondary">Pending</Text>
                                  <Button
                                    type="primary"
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markTaskAsDone(msg.id);
                                    }}
                                  >
                                    Mark as Done
                                  </Button>
                                </Space>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <Dropdown
      menu={{ items }}
      placement="bottomRight"
      arrow
      trigger={['click']}
    >
      <Badge count={pendingTasksCount} overflowCount={99}>
        <Button
          type="text"
          icon={<BellOutlined style={{ fontSize: '20px' }} />}
          style={{ marginRight: 8 }}
        />
      </Badge>
    </Dropdown>
  );
};

export default NotificationDropdown;

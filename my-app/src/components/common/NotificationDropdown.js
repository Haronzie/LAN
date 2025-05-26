import React, { useState, useEffect, useCallback } from 'react';
import { Badge, Dropdown, List, Avatar, Button, Space, Typography, Empty, Tag } from 'antd';
import { 
  BellOutlined, 
  FileOutlined, 
  CheckOutlined, 
  ClockCircleOutlined, 
  MessageOutlined,
  InfoCircleOutlined 
} from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleString();
  } catch (e) {
    return '';
  }
};

const NotificationDropdown = () => {
  const [notifications, setNotifications] = useState([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    console.log('Fetching notifications...');
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
      
      // First, try to get file messages
      const messagesRes = await axios.get(`/files-with-messages?_t=${timestamp}`, {
        withCredentials: true,
        timeout: 10000
      });

      // Process file messages
      const messageNotifications = Array.isArray(messagesRes?.data) ? messagesRes.data : [];
      
      // Initialize instruction notifications as empty array
      let instructionNotifications = [];
      
      // Try to get file instructions if the endpoint exists
      try {
        const instructionsRes = await axios.get(`/file-instructions?status=pending&_t=${timestamp}`, {
          withCredentials: true,
          timeout: 5000 // Shorter timeout for this optional request
        });
        
        // Process file instructions
        instructionNotifications = Array.isArray(instructionsRes?.data) 
          ? instructionsRes.data.map(instruction => ({
              ...instruction,
              isInstruction: true,
              messages: [{
                id: `inst_${instruction.id}`,
                message: instruction.instructions || instruction.message || 'New instruction',
                sender: instruction.sender,
                receiver: instruction.receiver,
                is_done: instruction.status === 'completed',
                created_at: instruction.created_at,
                isInstruction: true
              }]
            }))
          : [];
      } catch (error) {
        console.log('Could not fetch file instructions, continuing without them', error.message);
      }

      // Combine both types of notifications
      const allNotifications = [...messageNotifications, ...instructionNotifications];
      setNotifications(allNotifications);

      // Count pending tasks (both messages and instructions)
      const pendingCount = allNotifications.reduce((count, item) => {
        return count + (item.messages || []).filter(msg => !msg.is_done).length;
      }, 0);

      console.log(`Current user: ${username}, Pending tasks count: ${pendingCount}`);

      // If we have no notifications but expected some, log this for debugging
      if (allNotifications.length === 0) {
        console.log('No notifications found for the current user');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      } else if (error.request) {
        console.error('No response received:', error.request);
      } else {
        console.error('Error setting up request:', error.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

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
  }, [fetchNotifications]);

  const markTaskAsDone = async (messageId, isInstruction = false) => {
    try {
      if (isInstruction) {
        // Handle marking instruction as completed
        await axios.patch(
          `/file-instructions/${messageId.replace('inst_', '')}/complete`,
          {},
          { withCredentials: true }
        );
      } else {
        // Handle regular message
        await axios.patch(
          `/file/message/${messageId}/done`,
          {},
          { withCredentials: true }
        );
      }
      fetchNotifications(); // Refresh notifications after marking as done
    } catch (err) {
      console.error('Error marking task as done:', err);
    }
  };

  const navigateToFile = async (file, e = null) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    console.log('Navigating to file in dropdown:', file);
    
    // Clear any previous navigation state
    localStorage.removeItem('openFileAfterNavigation');
    localStorage.removeItem('forceOpenFile');
    localStorage.removeItem('notificationNavigation');
    localStorage.removeItem('directNavigation');
    localStorage.removeItem('highPriorityNavigation');
    
    // For instructions, we might not have a file to navigate to
    if (file.isInstruction && file.file_id) {
      console.log('This is a file instruction, navigating to file');
      // If we have a file_id, try to navigate to it
      return navigateToFile({
        ...file,
        id: file.file_id,
        directory: file.directory || ''
      }, e);
    }
    
    // Process the directory path to handle nested folders
    const directory = (file.directory || '').trim();
    const pathSegments = directory.split('/').filter(Boolean);
    const mainFolder = pathSegments[0]?.toLowerCase() || 'operation';
    
    // Create a unique ID for this navigation to prevent caching issues
    const navigationId = `nav-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store the complete navigation state
    const navigationState = {
      id: file.id,
      name: file.name,
      directory: directory,
      type: 'file',
      timestamp: Date.now(),
      source: 'notification',
      pathSegments: pathSegments,
      exactLocation: true,
      fullPath: directory,
      navigationId: navigationId,
      // Store the complete path including the file
      completePath: pathSegments.length > 0 
        ? `${directory}/${file.name}`
        : file.name
    };
    
    console.log('Navigation state:', navigationState);
    
    // Store in localStorage for the file manager to pick up
    localStorage.setItem('openFileAfterNavigation', JSON.stringify(navigationState));
    localStorage.setItem('forceOpenFile', 'true');
    localStorage.setItem('notificationNavigation', 'true');
    localStorage.setItem('directNavigation', 'true');
    localStorage.setItem('highPriorityNavigation', 'true');
    
    // Determine the target route based on the main folder
    let targetRoute = '/user/operation'; // Default
    
    switch(mainFolder) {
      case 'research':
        targetRoute = '/user/research';
        break;
      case 'training':
        targetRoute = '/user/training';
        break;
      case 'inventory':
        targetRoute = '/user/inventory';
        break;
      case 'operation':
      default:
        targetRoute = '/user/operation';
    }
    
    console.log(`Navigating to ${targetRoute} for file in ${directory}`);
    
    // Add a small delay to ensure localStorage is updated before navigation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Navigate to the target route
    navigate(targetRoute, {
      state: {
        fromNotification: true,
        fileToOpen: navigationState,
        timestamp: Date.now()
      }
    });
  };

  // Filter notifications based on showCompleted state
  const filteredNotifications = showCompleted 
    ? notifications
    : notifications.map(file => ({
        ...file,
        messages: (file.messages || []).filter(msg => !msg.is_done)
      })).filter(file => file.messages.length > 0);

  // Count pending tasks (messages and instructions that are not marked as done)
  const pendingTasksCount = notifications.reduce((count, file) => {
    return count + (file.messages || []).filter(msg => !msg.is_done).length;
  }, 0);

  const items = [
    {
      key: '1',
      label: (
        <div style={{ width: 350, maxHeight: 500, overflow: 'auto' }}>
          <div style={{ 
            padding: '8px 12px', 
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Text strong>Task Notifications</Text>
            <Button 
              type="text" 
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setShowCompleted(!showCompleted);
              }}
              style={{ fontSize: '12px' }}
            >
              {showCompleted ? 'Hide Completed' : 'Show Completed'}
            </Button>
          </div>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center' }}>Loading notifications...</div>
          ) : filteredNotifications.length === 0 ? (
            <Empty
              description="No pending tasks"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ padding: '20px 0' }}
            />
          ) : (
            <List
              itemLayout="horizontal"
              dataSource={filteredNotifications}
              renderItem={file => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<FileOutlined />} style={{ backgroundColor: '#1890ff' }} />}
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <a 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigateToFile(file, e);
                          }}
                          style={{
                            color: '#1890ff',
                            cursor: 'pointer',
                            ':hover': {
                              textDecoration: 'underline'
                            }
                          }}
                        >
                          {file.name || 'File Instruction'}
                        </a>
                        {file.isInstruction && (
                          <Tag color="blue" icon={<InfoCircleOutlined />}>
                            Instruction
                          </Tag>
                        )}
                      </div>
                    }
                    description={
                      <div>
                        {file.messages?.map(msg => (
                          <div 
                            key={msg.id} 
                            style={{
                              marginBottom: 8,
                              padding: 8,
                              background: msg.is_done ? '#f6ffed' : (msg.isInstruction ? '#fff7e6' : '#f0f5ff'),
                              borderRadius: 4,
                              borderLeft: `3px solid ${
                                msg.is_done ? '#52c41a' : 
                                msg.isInstruction ? '#faad14' : '#1890ff'
                              }`
                            }}
                          >
                            <div>
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!msg.isInstruction) {
                                    console.log('Notification message clicked, navigating to:', file.name, 'in', file.directory);
                                    localStorage.setItem('highPriorityNavigation', 'true');
                                    navigateToFile(file, e);
                                  } else if (file.file_id) {
                                    // For instructions with file_id, navigate to the file
                                    navigateToFile({
                                      ...file,
                                      id: file.file_id,
                                      directory: file.directory || ''
                                    }, e);
                                  }
                                }}
                                style={{ 
                                  cursor: 'pointer',
                                  textDecoration: 'none',
                                  fontWeight: 'bold',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  ':hover': {
                                    textDecoration: 'underline'
                                  }
                                }}
                              >
                                {msg.isInstruction ? (
                                  <MessageOutlined style={{ color: '#faad14' }} />
                                ) : (
                                  <FileOutlined style={{ color: '#1890ff' }} />
                                )}
                                <span style={{ color: msg.isInstruction ? '#faad14' : '#1890ff' }}>
                                  {msg.message}
                                </span>
                              </div>
                            </div>
                            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                              {msg.sender && `From: ${msg.sender} · `}
                              {msg.created_at && new Date(msg.created_at).toLocaleString()}
                            </div>
                            <div style={{ marginTop: 8 }}>
                              {msg.is_done ? (
                                <Space>
                                  <CheckOutlined style={{ color: '#52c41a' }} />
                                  <Text type="success">Completed</Text>
                                </Space>
                              ) : (
                                <Space>
                                  <ClockCircleOutlined style={{ 
                                    color: msg.isInstruction ? '#faad14' : '#1890ff' 
                                  }} />
                                  <Text type={msg.isInstruction ? 'warning' : 'secondary'}>
                                    {msg.isInstruction ? 'Instruction Pending' : 'Pending'}
                                  </Text>
                                  {!msg.isInstruction && (
                                    <Button
                                      type="primary"
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        markTaskAsDone(msg.id, msg.isInstruction);
                                      }}
                                    >
                                      Mark as Done
                                    </Button>
                                  )}
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

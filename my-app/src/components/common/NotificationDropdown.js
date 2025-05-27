import React, { useState, useEffect, useCallback } from 'react';
import { Badge, Dropdown, List, Avatar, Button, Space, Typography, Empty, Tag, Tooltip, message } from 'antd';
import { 
  BellOutlined, 
  BellFilled,
  FileOutlined, 
  CheckOutlined, 
  ClockCircleOutlined, 
  MessageOutlined,
  InfoCircleOutlined,
  FolderOpenOutlined
} from '@ant-design/icons';
import styled, { keyframes, css } from 'styled-components';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

// Animation for the bell icon
const ring = keyframes`
  0% { transform: rotate(0); }
  25% { transform: rotate(15deg); }
  50% { transform: rotate(-15deg); }
  75% { transform: rotate(10deg); }
  100% { transform: rotate(0); }
`;

const BellIconWrapper = styled.span`
  display: inline-block;
  position: relative;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: all 0.3s;
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }
  
  ${props => props.$hasNotification && css`
    animation: ${ring} 0.5s ease-in-out;
  `}
`;

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

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
      
      // Get all files with messages for the current user
      const messagesRes = await axios.get(
        `${BASE_URL}/files-with-messages?_t=${timestamp}`,
        {
          withCredentials: true,
          timeout: 10000
        }
      );

      // Process file messages
      const messageNotifications = Array.isArray(messagesRes?.data) 
        ? messagesRes.data.map(file => ({
            ...file,
            messages: file.messages || [],
            isInstruction: false
          }))
        : [];

      // Set the notifications
      setNotifications(messageNotifications);

      // Count pending tasks
      const pendingCount = messageNotifications.reduce((count, item) => {
        return count + (item.messages || []).filter(msg => !msg.is_done).length;
      }, 0);

      console.log(`Current user: ${username}, Pending tasks count: ${pendingCount}`);

      // If we have no notifications but expected some, log this for debugging
      if (messageNotifications.length === 0) {
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
          `${BASE_URL}/file-instructions/${messageId.replace('inst_', '')}/complete`, // updated
          {},
          { withCredentials: true }
        );
      } else {
        // Handle regular message
        await axios.patch(
          `${BASE_URL}/file/message/${messageId}/done`, // updated
          {},
          { withCredentials: true }
        );
      }
      fetchNotifications(); // Refresh notifications after marking as done
    } catch (err) {
      console.error('Error marking task as done:', err);
    }
  };

  const markAsRead = async (fileId) => {
    try {
      await axios.patch(
        `${BASE_URL}/files/notifications/${fileId}/read`,
        {},
        { withCredentials: true }
      );
      // Update local state to reflect the read status
      setNotifications(prev => 
        prev.map(item => ({
          ...item,
          messages: item.messages?.map(msg => 
            msg.id === fileId ? { ...msg, is_read: true } : msg
          )
        }))
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const navigateToFile = async (file, e = null) => {
    try {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      
      console.log('🔍 [Notification] Preparing to navigate to file:', file);
      
      // Mark the notification as read if it's unread
      if (!file.is_read && file.id) {
        await markAsRead(file.id);
      }
      
      // Parse the file path to handle nested folders
      const filePath = file.directory || '';
      let pathSegments = filePath.split('/').filter(Boolean);
      
      // Ensure we have a valid path
      if (pathSegments.length === 0) {
        // If no path segments, default to operation
        pathSegments = ['operation'];
      }
      
      // Ensure the first segment is a valid main folder
      const validMainFolders = ['operation', 'research', 'training', 'inventory'];
      const mainFolder = validMainFolders.includes(pathSegments[0].toLowerCase()) 
        ? pathSegments[0].toLowerCase() 
        : 'operation';
      
      // If the first segment wasn't a valid main folder, prepend 'operation/'
      if (mainFolder === 'operation' && !validMainFolders.includes(pathSegments[0]?.toLowerCase())) {
        pathSegments = ['operation', ...pathSegments];
      }
      
      const cleanPath = pathSegments.join('/');
      const fullPath = cleanPath ? `${cleanPath}/${file.name}` : file.name;
      
      // Create a unique ID for this navigation to prevent caching issues
      const navigationId = `nav-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = Date.now();
      
      // Create navigation state with all necessary information
      const navigationState = {
        id: file.id || navigationId,
        name: file.name,
        directory: cleanPath,
        fullPath: fullPath,
        type: 'file',
        timestamp: timestamp,
        source: 'notification',
        pathSegments: pathSegments,
        isDeepLink: true,
        targetFile: file.name,
        fileMetadata: {
          size: file.size,
          type: file.contentType || 'file',
          lastModified: file.updatedAt || file.createdAt || new Date().toISOString(),
          name: file.name,
          path: cleanPath,
          id: file.id || navigationId
        },
        _forceOpen: true,
        _highPriority: true,
        _navigationId: navigationId,
        _fromNotification: true,
        _timestamp: timestamp,
        _scrollTarget: file.name,
        _filePath: fullPath,
        _directory: cleanPath
      };
      
      console.log('📁 [Notification] Navigation details:', {
        path: cleanPath,
        file: file.name,
        fullPath: fullPath,
        navigationId: navigationId,
        pathSegments: pathSegments
      });
      
      // Clear any previous navigation state
      const keysToRemove = [
        'openFileAfterNavigation',
        'forceOpenFile',
        'notificationNavigation',
        'directNavigation',
        'highPriorityNavigation',
        'deepLinkPath',
        'deepLinkTarget',
        'fileNavigationState',
        'scrollToFile',
        'fileNavigationPath',
        'fileNavigationTarget',
        'deepLinkSegments'
      ];
      
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (err) {
          console.warn(`Failed to remove ${key} from localStorage:`, err);
        }
      });
      
      // Store the enhanced navigation state
      const enhancedState = {
        ...navigationState,
        _scrollToFile: true,
        _timestamp: timestamp
      };
      
      // Store navigation state in multiple formats for compatibility
      localStorage.setItem('openFileAfterNavigation', JSON.stringify(enhancedState));
      localStorage.setItem('fileNavigationState', JSON.stringify(enhancedState));
      localStorage.setItem('forceOpenFile', 'true');
      localStorage.setItem('notificationNavigation', 'true');
      localStorage.setItem('highPriorityNavigation', 'true');
      localStorage.setItem('deepLinkPath', cleanPath);
      localStorage.setItem('deepLinkTarget', file.name);
      
      // Store path segments for breadcrumb navigation
      if (pathSegments.length > 0) {
        localStorage.setItem('deepLinkSegments', JSON.stringify(pathSegments));
      }
      
      // Store the full file path for the FileManager to use
      localStorage.setItem('fileNavigationPath', cleanPath);
      localStorage.setItem('fileNavigationTarget', file.name);
    
      // Determine the target route based on the main folder
      const routeMap = {
        'research': '/user/research',
        'training': '/user/training',
        'inventory': '/user/inventory',
        'operation': '/user/operation'
      };
      
      const targetRoute = routeMap[mainFolder] || '/user/operation';
      
      console.log(`🔄 [Notification] Navigating to ${targetRoute} for file: ${file.name}`);
      console.log('📂 [Notification] Full path segments:', pathSegments);
      
      // Add a small delay to ensure localStorage is updated before navigation
      await new Promise(resolve => setTimeout(resolve, 50));
      
      try {
        // Navigate to the target route with complete state
        navigate(targetRoute, {
          state: {
            ...navigationState,
            fromNotification: true,
            fileToOpen: file.name,
            directory: cleanPath,
            timestamp: timestamp,
            isDeepLink: true,
            pathSegments: pathSegments,
            targetFile: file.name,
            forceOpen: true,
            navigationId: navigationId,
            _fromNotification: true,
            _highPriority: true,
            _scrollToFile: true
          },
          replace: false
        });
        
        console.log('✅ [Notification] Navigation initiated successfully');
        
        // Force a reload if we're already on the same route
        if (window.location.pathname === targetRoute) {
          console.log('♻️ [Notification] Already on target route, forcing reload');
          window.location.reload();
        }
      } catch (navError) {
        console.error('❌ [Notification] Navigation error:', navError);
        // Fallback to window.location if programmatic navigation fails
        window.location.href = targetRoute;
      }
    } catch (error) {
      console.error('❌ [Notification] Error in navigateToFile:', error);
      // Show error message to user
      message.error('Failed to navigate to file. Please try again.');
    }
  };

  // Filter and sort notifications based on showCompleted state and creation date
  const filteredNotifications = (showCompleted ? notifications : notifications.map(file => ({
    ...file,
    messages: (file.messages || []).filter(msg => !msg.is_done)
  }))).filter(file => file.messages.length > 0)
  .sort((a, b) => {
    // Get the latest message timestamp from each file
    const getLatestTimestamp = (file) => {
      if (!file.messages || file.messages.length === 0) return 0;
      return Math.max(...file.messages.map(msg => 
        msg.created_at ? new Date(msg.created_at).getTime() : 0
      ));
    };
    
    const timeA = getLatestTimestamp(a);
    const timeB = getLatestTimestamp(b);
    
    // Sort in descending order (newest first)
    return timeB - timeA;
  });

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
                                style={{ 
                                  marginBottom: 4,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between'
                                }}
                              >
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
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}
                                >
                                  <FileOutlined style={{ marginRight: 8 }} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {file.name || 'File Instruction'}
                                  </span>
                                </div>
                                <Tooltip title="Open file location">
                                  <Button 
                                    type="text" 
                                    size="small" 
                                    icon={<FolderOpenOutlined />} 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigateToFile(file, e);
                                    }}
                                  />
                                </Tooltip>
                              </div>
                              {/* File path with clickable segments */}
                              {file.directory && (
                                <div style={{ 
                                  fontSize: '12px', 
                                  color: '#666',
                                  marginBottom: 8,
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  alignItems: 'center'
                                }}>
                                  <span style={{ marginRight: 4 }}>Path:</span>
                                  {file.directory.split('/').filter(Boolean).map((segment, idx, arr) => {
                                    const pathSoFar = arr.slice(0, idx + 1).join('/');
                                    return (
                                      <React.Fragment key={idx}>
                                        <span 
                                          style={{ 
                                            color: '#1890ff', 
                                            cursor: 'pointer',
                                            ':hover': { textDecoration: 'underline' }
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigateToFile({
                                              ...file,
                                              directory: pathSoFar
                                            }, e);
                                          }}
                                        >
                                          {segment}
                                        </span>
                                        {idx < arr.length - 1 && <span style={{ margin: '0 4px' }}>/</span>}
                                      </React.Fragment>
                                    );
                                  })}
                                </div>
                              )}
                              <div 
                                style={{ 
                                  marginBottom: 4,
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                  display: 'flex',
                                  gap: 8,
                                  alignItems: 'center'
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

  // Use the existing pendingTasksCount that's already calculated above
  const hasNotifications = pendingTasksCount > 0;

  return (
    <Dropdown
      menu={{ items }}
      placement="bottomRight"
      arrow
      trigger={['click']}
    >
      <BellIconWrapper $hasNotification={hasNotifications}>
        <Badge count={pendingTasksCount} overflowCount={99}>
          {hasNotifications ? (
            <BellFilled style={{ fontSize: '20px', color: '#ff4d4f' }} />
          ) : (
            <BellOutlined style={{ fontSize: '20px' }} />
          )}
        </Badge>
      </BellIconWrapper>
    </Dropdown>
  );

};

export default NotificationDropdown;

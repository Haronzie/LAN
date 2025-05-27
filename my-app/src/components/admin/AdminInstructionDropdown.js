import React, { useState, useEffect, useCallback } from 'react';
import { Badge, Dropdown, List, Avatar, Button, Space, Typography, Empty, Tag, Tooltip, message } from 'antd';
import { 
  MessageOutlined, 
  CheckOutlined, 
  ClockCircleOutlined, 
  UserOutlined,
  FileOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

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

const AdminInstructionDropdown = () => {
  const [instructions, setInstructions] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchInstructions = useCallback(async () => {
    setLoading(true);
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        console.error('No username found in localStorage');
        return;
      }

      // Check if user is admin by getting current user info
      const userRes = await axios.get(
        `${BASE_URL}/user-role`,
        { withCredentials: true }
      );

      if (userRes.data.role !== 'admin') {
        console.log('User is not an admin, not fetching instructions');
        return;
      }

      // Fetch all file messages (admin can see all messages)
      const response = await axios.get(
        `${BASE_URL}/file/messages`,
        { withCredentials: true }
      );
      setInstructions(Array.isArray(response.data) ? response.data : []);

      // Process instructions data
      const processedInstructions = Array.isArray(response.data) 
        ? response.data.map(inst => ({
            ...inst,
            isInstruction: true,
            created_at: inst.created_at || new Date().toISOString(),
            is_done: inst.is_done || false
          }))
        : [];

      setInstructions(processedInstructions);
    } catch (error) {
      console.error('Error fetching instructions:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      message.error('Failed to load instructions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstructions();
    
    // Set up polling to check for new instructions every 30 seconds
    const interval = setInterval(fetchInstructions, 30000);
    
    // Clean up interval on component unmount
    return () => clearInterval(interval);
  }, [fetchInstructions]);

  const markInstructionAsDone = async (messageId) => {
    try {
      await axios.patch(
        `${BASE_URL}/file/message/${messageId}/done`,
        {},
        { withCredentials: true }
      );
      
      // Update local state
      setInstructions(prev => 
        prev.map(inst => 
          inst.id === messageId ? { ...inst, is_done: true } : inst
        )
      );
      
      message.success('Instruction marked as completed');
    } catch (err) {
      console.error('Error marking instruction as done:', err);
      if (err.response) {
        console.error('Response data:', err.response.data);
        console.error('Response status:', err.response.status);
      }
      message.error('Failed to update instruction status');
    }
  };

  const navigateToFile = (fileId, filePath) => {
    if (!filePath) return;
    
    // Parse the file path to navigate to the correct location
    const pathSegments = filePath.split('/').filter(Boolean);
    const mainFolder = pathSegments[0]?.toLowerCase();
    
    if (mainFolder) {
      navigate(`/dashboard/${mainFolder}?highlight=${fileId}`);
    }
  };

  const instructionCount = instructions.filter(i => !i.is_done).length;

  const menu = (
    <div style={{ width: 350, maxHeight: '60vh', overflowY: 'auto' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <strong>File Instructions Sent</strong>
      </div>
      
      <List
        itemLayout="horizontal"
        dataSource={instructions}
        loading={loading}
        locale={{
          emptyText: (
            <Empty 
              image={Empty.PRESENTED_IMAGE_SIMPLE} 
              description="No instructions sent yet" 
            />
          )
        }}
        renderItem={instruction => (
          <List.Item
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #f0f0f0',
              cursor: 'pointer',
              backgroundColor: instruction.is_read ? '#fff' : '#f6f9ff'
            }}
            onClick={() => navigateToFile(instruction.file_id, instruction.file_path)}
          >
            <List.Item.Meta
              avatar={
                <Avatar 
                  icon={<UserOutlined />} 
                  style={{ backgroundColor: '#1890ff' }} 
                />
              }
              title={
                <Space>
                  <Text strong>To: {instruction.receiver}</Text>
                  <Tag 
                    color={instruction.is_done ? 'success' : 'processing'}
                    icon={instruction.is_done ? <CheckOutlined /> : <ClockCircleOutlined />}
                  >
                    {instruction.is_done ? 'Completed' : 'Pending'}
                  </Tag>
                </Space>
              }
              description={
                <div style={{ marginTop: 4 }}>
                  <div style={{ marginBottom: 4 }}>
                    <FileOutlined style={{ marginRight: 8 }} />
                    <Text ellipsis={{ tooltip: instruction.file_path }}>
                      {instruction.file_path?.split('/').pop() || 'File'}
                    </Text>
                  </div>
                  <div style={{ margin: '8px 0' }}>
                    <Text>{instruction.message}</Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatDate(instruction.created_at)}
                  </Text>
                </div>
              }
            />
            
            {!instruction.is_done && (
              <Button 
                type="text" 
                size="small" 
                icon={<CheckOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  markInstructionAsDone(instruction.id);
                }}
              >
                Mark as Done
              </Button>
            )}
          </List.Item>
        )}
      />
      
      <div style={{ 
        padding: '8px 16px', 
        textAlign: 'center',
        borderTop: '1px solid #f0f0f0'
      }}>
        <Button 
          type="link" 
          onClick={() => navigate('/admin/instructions')}
        >
          View All Instructions
        </Button>
      </div>
    </div>
  );

  return (
    <Dropdown 
      overlay={menu} 
      trigger={['click']}
      overlayStyle={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
      placement="bottomRight"
    >
      <Button 
        type="text" 
        icon={
          <Badge 
            count={instructionCount} 
            size="small"
            offset={[5, -5]}
          >
            <MessageOutlined style={{ fontSize: 18 }} />
          </Badge>
        }
        style={{ marginLeft: 8 }}
      >
        Instructions
      </Button>
    </Dropdown>
  );
};

export default AdminInstructionDropdown;

import React, { useState, useEffect, useCallback } from 'react';
import { Badge, Dropdown, List, Avatar, Button, Space, Typography, Empty, Tag, Tooltip, message } from 'antd';
import { 
  MessageOutlined, 
  CheckOutlined, 
  ClockCircleOutlined, 
  UserOutlined,
  FileOutlined,
  BellOutlined,
  BellFilled
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
    color: #1890ff;
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
    <div style={{ 
      width: 400, 
      maxHeight: '70vh', 
      overflowY: 'auto',
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderRadius: 8,
      boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)'
    }}>
      <div style={{ 
        padding: '16px', 
        borderBottom: '1px solid #f0f0f0',
        backgroundColor: '#fafafa',
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        position: 'sticky',
        top: 0,
        zIndex: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Text strong style={{ fontSize: '16px' }}>File Instructions Sent</Text>
        <Badge count={instructionCount} style={{ backgroundColor: '#1890ff' }} />
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
              padding: '16px',
              borderBottom: '1px solid #f0f0f0',
              cursor: 'pointer',
              transition: 'all 0.3s',
              backgroundColor: instruction.is_read ? '#fff' : 'rgba(24, 144, 255, 0.04)',
              ':hover': {
                backgroundColor: 'rgba(24, 144, 255, 0.08)'
              }
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
      placement="bottomRight"
      overlayStyle={{ zIndex: 1050 }}
    >
      <BellIconWrapper $hasNotification={instructionCount > 0}>
        <Badge count={instructionCount} size="small" offset={[-5, 5]}>
          {instructionCount > 0 ? (
            <BellFilled style={{ fontSize: '20px', color: '#1890ff' }} />
          ) : (
            <BellOutlined style={{ fontSize: '20px' }} />
          )}
        </Badge>
      </BellIconWrapper>
    </Dropdown>
  );
};

export default AdminInstructionDropdown;

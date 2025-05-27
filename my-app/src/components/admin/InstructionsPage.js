import React, { useState, useEffect } from 'react';
import { List, Avatar, Button, Typography, Tag, Empty, message, Card, Badge } from 'antd';
import { MessageOutlined, CheckOutlined, ClockCircleOutlined, UserOutlined, FileOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

const InstructionsPage = () => {
  const [instructions, setInstructions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchInstructions = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${BASE_URL}/file/messages`,
        { withCredentials: true }
      );
      
      const processedInstructions = Array.isArray(response.data) 
        ? response.data.map(inst => ({
            ...inst,
            created_at: inst.created_at || new Date().toISOString(),
            is_done: inst.is_done || false
          }))
        : [];

      setInstructions(processedInstructions);
    } catch (error) {
      console.error('Error fetching instructions:', error);
      message.error('Failed to load instructions');
    } finally {
      setLoading(false);
    }
  };

  const markAsDone = async (messageId) => {
    try {
      await axios.patch(
        `${BASE_URL}/file/message/${messageId}/done`,
        {},
        { withCredentials: true }
      );
      
      setInstructions(prev => 
        prev.map(inst => 
          inst.id === messageId ? { ...inst, is_done: true } : inst
        )
      );
      
      message.success('Instruction marked as completed');
    } catch (err) {
      console.error('Error marking instruction as done:', err);
      message.error('Failed to update instruction status');
    }
  };

  const navigateToFile = (fileId, filePath) => {
    if (!filePath) return;
    const pathSegments = filePath.split('/').filter(Boolean);
    const mainFolder = pathSegments[0]?.toLowerCase();
    if (mainFolder) {
      navigate(`/dashboard/${mainFolder}?highlight=${fileId}`);
    }
  };

  useEffect(() => {
    fetchInstructions();
  }, []);

  const pendingCount = instructions.filter(i => !i.is_done).length;
  const completedCount = instructions.length - pendingCount;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3}>File Instructions</Title>
        <div>
          <Tag color="blue" style={{ marginRight: '8px' }}>
            Pending: <Badge count={pendingCount} style={{ backgroundColor: '#1890ff' }} />
          </Tag>
          <Tag color="green">
            Completed: <Badge count={completedCount} style={{ backgroundColor: '#52c41a' }} />
          </Tag>
        </div>
      </div>

      <Card>
        <List
          itemLayout="vertical"
          size="large"
          dataSource={instructions}
          loading={loading}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No instructions found"
              />
            )
          }}
          renderItem={instruction => (
            <List.Item
              style={{
                padding: '16px',
                borderBottom: '1px solid #f0f0f0',
                backgroundColor: instruction.is_done ? '#fafafa' : '#fff',
                opacity: instruction.is_done ? 0.8 : 1,
                transition: 'all 0.3s',
                ':hover': {
                  backgroundColor: instruction.is_done ? '#f5f5f5' : '#f9f9f9'
                }
              }}
            >
              <List.Item.Meta
                avatar={
                  <Avatar 
                    icon={<UserOutlined />} 
                    style={{ backgroundColor: instruction.sender ? '#1890ff' : '#d9d9d9' }} 
                  />
                }
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <Text strong>To: {instruction.receiver}</Text>
                      {instruction.sender && (
                        <Text type="secondary" style={{ marginLeft: '8px' }}>
                          (From: {instruction.sender})
                        </Text>
                      )}
                    </div>
                    <Tag 
                      color={instruction.is_done ? 'success' : 'processing'}
                      icon={instruction.is_done ? <CheckOutlined /> : <ClockCircleOutlined />}
                    >
                      {instruction.is_done ? 'Completed' : 'Pending'}
                    </Tag>
                  </div>
                }
                description={
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <FileOutlined style={{ marginRight: '8px' }} />
                      <Text 
                        onClick={() => navigateToFile(instruction.file_id, instruction.file_path)}
                        style={{ cursor: 'pointer', color: '#1890ff' }}
                      >
                        {instruction.file_path?.split('/').pop() || 'File'}
                      </Text>
                    </div>
                    <div style={{ margin: '12px 0' }}>
                      <Text>{instruction.message}</Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {new Date(instruction.created_at).toLocaleString()}
                    </Text>
                  </div>
                }
              />
              
              {!instruction.is_done && (
                <div style={{ marginTop: '12px', textAlign: 'right' }}>
                  <Button 
                    type="primary" 
                    size="small"
                    icon={<CheckOutlined />}
                    onClick={() => markAsDone(instruction.id)}
                  >
                    Mark as Done
                  </Button>
                </div>
              )}
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};

export default InstructionsPage;

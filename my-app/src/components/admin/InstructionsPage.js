import React, { useState, useEffect } from 'react';
import { List, Avatar, Button, Typography, Tag, Empty, message, Card, Badge } from 'antd';
import { MessageOutlined, CheckOutlined, ClockCircleOutlined, UserOutlined, FileOutlined, ArrowLeftOutlined } from '@ant-design/icons';
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
    <div style={{ 
      padding: '24px',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <div style={{ marginBottom: '24px' }}>
        <Button 
          type="primary" 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/admin')}
          style={{ 
            marginBottom: '24px',
            padding: '0 20px',
            height: '40px',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(24, 144, 255, 0.2)'
          }}
        >
          Back to Dashboard
        </Button>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '24px',
          padding: '0 4px'
        }}>
          <div>
            <Title level={3} style={{ margin: 0, color: '#1f1f1f' }}>File Instructions</Title>
            <Text type="secondary" style={{ fontSize: '14px' }}>
              Manage and track all file-related instructions
            </Text>
          </div>
          <div>
            <div style={{ 
              display: 'flex', 
              gap: '12px',
              backgroundColor: '#fafafa',
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #f0f0f0'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '4px' }}>PENDING</div>
                <Badge 
                  count={pendingCount} 
                  style={{ 
                    backgroundColor: '#1890ff',
                    fontSize: '16px',
                    fontWeight: 600,
                    minWidth: '32px',
                    height: '32px',
                    lineHeight: '32px',
                    borderRadius: '16px'
                  }} 
                />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '4px' }}>COMPLETED</div>
                <Badge 
                  count={completedCount} 
                  style={{ 
                    backgroundColor: '#52c41a',
                    fontSize: '16px',
                    fontWeight: 600,
                    minWidth: '32px',
                    height: '32px',
                    lineHeight: '32px',
                    borderRadius: '16px'
                  }} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <Card 
        style={{
          borderRadius: '8px',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
          border: '1px solid #f0f0f0'
        }}
        bodyStyle={{ padding: 0 }}
      >
        <List
          itemLayout="vertical"
          size="large"
          dataSource={instructions}
          loading={loading}
          style={{ borderRadius: '8px' }}
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
                padding: '20px 24px',
                borderBottom: '1px solid #f0f0f0',
                backgroundColor: instruction.is_done ? '#fafafa' : '#fff',
                transition: 'all 0.3s',
                borderLeft: `4px solid ${instruction.is_done ? '#52c41a' : '#1890ff'}`,
                margin: '4px 0',
                borderRadius: '4px',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
                ':hover': {
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  transform: 'translateY(-1px)'
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

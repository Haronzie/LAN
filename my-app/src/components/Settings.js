import React, { useState } from 'react';
import { Layout, Card, Form, Input, Button, Switch, InputNumber, message, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Content } = Layout;
const { Title, Paragraph } = Typography;

const Settings = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = (values) => {
    setLoading(true);
    // Here you would typically send your settings data to your backend API.
    // For demonstration purposes, we'll simulate an API call with a timeout.
    setTimeout(() => {
      setLoading(false);
      message.success('Settings updated successfully!');
      // Optionally, navigate back to the dashboard here if desired.
    }, 1000);
  };

  return (
    <Layout style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      <Content style={{ maxWidth: 800, margin: '0 auto' }}>
        <Button 
          type="link" 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/admin')}
          style={{ marginBottom: '16px', fontSize: '16px' }}
        >
          Back to Dashboard
        </Button>
        <Card 
          title="Admin Settings" 
          bordered={false} 
          style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
        >
          <Title level={4}>System Configuration</Title>
          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item
              label="Change Admin Password"
              name="newPassword"
              rules={[{ required: true, message: 'Please input your new password' }]}
            >
              <Input.Password placeholder="Enter new password" />
            </Form.Item>
            <Form.Item
              label="Enable Maintenance Mode"
              name="maintenanceMode"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              label="Maximum File Upload Size (MB)"
              name="maxUploadSize"
              rules={[{ required: true, message: 'Please set the maximum file upload size' }]}
            >
              <InputNumber 
                min={1} 
                max={1000} 
                style={{ width: '100%' }} 
                placeholder="Enter max upload size" 
              />
            </Form.Item>
            <Form.Item
              label="Shared Folder Path"
              name="sharedFolderPath"
              rules={[{ required: true, message: 'Please input the shared folder path' }]}
            >
              <Input placeholder="Enter shared folder path" />
            </Form.Item>
            <Form.Item
              label="Enable Detailed Logging"
              name="detailedLogging"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>
                Save Settings
              </Button>
            </Form.Item>
          </Form>
          <Paragraph type="secondary">
            These settings allow you to configure your LAN-based file sharing system for optimal performance and security. Adjust the maximum file upload size, specify the shared folder location, and enable detailed logging to monitor system activities.
          </Paragraph>
        </Card>
      </Content>
    </Layout>
  );
};

export default Settings;

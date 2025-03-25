import React, { useState } from 'react';
import { Layout, Card, Form, Input, Button, Switch, InputNumber, message, Typography, Divider } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Content } = Layout;
const { Title, Paragraph, Text } = Typography;

const Settings = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = (values) => {
    setLoading(true);
    // Simulate API call for settings update
    setTimeout(() => {
      setLoading(false);
      message.success('Settings updated successfully!');
    }, 1000);
  };

  return (
    <Layout style={{ padding: '40px 24px', background: '#f0f2f5', minHeight: '100vh' }}>
      <Content style={{ maxWidth: 800, margin: '0 auto' }}>
        <Button 
          type="primary" 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/admin')}
          style={{ marginBottom: '24px', fontSize: '16px' }}
        >
          Back to Dashboard
        </Button>

        <Card 
          bordered={false}
          style={{ 
            borderRadius: '10px', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', 
            padding: '24px'
          }}
        >
          <Title level={3} style={{ marginBottom: '8px' }}>Admin Settings</Title>
          <Text type="secondary">
            Configure system parameters for optimal performance and security.
          </Text>
          <Divider style={{ margin: '24px 0' }} />
          <Form 
            layout="vertical" 
            onFinish={onFinish}
            initialValues={{
              maintenanceMode: false,
              detailedLogging: false,
            }}
          >
            <Form.Item
              label="Change Admin Password"
              name="newPassword"
              rules={[{ required: true, message: 'Please input your new password' }]}
            >
              <Input.Password placeholder="Enter new password" size="large" />
            </Form.Item>

            <Form.Item
              label="Enable Maintenance Mode"
              name="maintenanceMode"
              valuePropName="checked"
            >
              <Switch size="small" />
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
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="Shared Folder Path"
              name="sharedFolderPath"
              rules={[{ required: true, message: 'Please input the shared folder path' }]}
            >
              <Input placeholder="Enter shared folder path" size="large" />
            </Form.Item>

            <Form.Item
              label="Enable Detailed Logging"
              name="detailedLogging"
              valuePropName="checked"
            >
              <Switch size="small" />
            </Form.Item>

            <Form.Item style={{ marginTop: '24px' }}>
              <Button type="primary" htmlType="submit" loading={loading} size="large" block>
                Save Settings
              </Button>
            </Form.Item>
          </Form>
          <Paragraph type="secondary" style={{ marginTop: '24px', fontSize: '14px' }}>
            These settings allow you to configure your LAN-based file sharing system for optimal performance and security.
            Adjust the maximum file upload size, specify the shared folder location, and enable detailed logging to monitor system activities.
          </Paragraph>
        </Card>
      </Content>
    </Layout>
  );
};

export default Settings;

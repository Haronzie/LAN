import React, { useState } from 'react';
import { Layout, Card, Form, Input, Button, Switch, InputNumber, message, Typography, Divider } from 'antd';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

const Settings = () => {
  const [loading, setLoading] = useState(false);

  const onFinish = (values) => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      message.success('Settings updated successfully!');
    }, 1000);
  };

  return (
    <Layout style={{ padding: '14px 16px', background: '#f0f2f5', minHeight: '100%' }}>
      <Content style={{ maxWidth: 700, margin: '0 auto' }}>
        <Card 
          bordered={false}
          style={{ 
            borderRadius: '6px', 
            boxShadow: '0 1px 6px rgba(0,0,0,0.08)', 
            padding: '14px 16px'
          }}
        >
          <Title level={4} style={{ 
            marginBottom: '6px', 
            textAlign: 'center', 
            fontSize: '16px',
            fontWeight: 500
          }}>
            Admin Settings
          </Title>
          <Text type="secondary" style={{ 
            fontSize: '12px', 
            display: 'block', 
            textAlign: 'center',
            marginBottom: '10px'
          }}>
            Configure system parameters
          </Text>
          
          <Divider style={{ margin: '10px 0' }} />
          
          <Form 
            layout="vertical" 
            onFinish={onFinish}
            initialValues={{
              maintenanceMode: false,
              detailedLogging: false,
            }}
          >
            <Form.Item
              label={<span style={{ fontSize: '12px' }}>Admin Password</span>}
              name="newPassword"
              rules={[{ required: true, message: 'Required' }]}
              style={{ marginBottom: '14px' }}
            >
              <Input.Password 
                placeholder="Enter new password" 
                size="middle" 
                style={{ fontSize: '13px' }}
              />
            </Form.Item>

            <Form.Item
              label={<span style={{ fontSize: '12px' }}>Maintenance Mode</span>}
              name="maintenanceMode"
              valuePropName="checked"
              style={{ marginBottom: '14px' }}
            >
              <Switch size="small" />
            </Form.Item>

            <Form.Item
              label={<span style={{ fontSize: '12px' }}>Max Upload Size (MB)</span>}
              name="maxUploadSize"
              rules={[{ required: true, message: 'Required' }]}
              style={{ marginBottom: '14px' }}
            >
              <InputNumber 
                min={1} 
                max={1000} 
                style={{ width: '100%', fontSize: '13px' }} 
                placeholder="Enter size" 
                size="middle"
              />
            </Form.Item>

            <Form.Item
              label={<span style={{ fontSize: '12px' }}>Shared Folder Path</span>}
              name="sharedFolderPath"
              rules={[{ required: true, message: 'Required' }]}
              style={{ marginBottom: '14px' }}
            >
              <Input 
                placeholder="Enter path" 
                size="middle" 
                style={{ fontSize: '13px' }}
              />
            </Form.Item>

            <Form.Item
              label={<span style={{ fontSize: '12px' }}>Detailed Logging</span>}
              name="detailedLogging"
              valuePropName="checked"
              style={{ marginBottom: '16px' }}
            >
              <Switch size="small" />
            </Form.Item>

            <Form.Item style={{ marginTop: '10px', marginBottom: '8px' }}>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading} 
                size="middle" 
                block
                style={{ fontSize: '13px' }}
              >
                Save Settings
              </Button>
            </Form.Item>
          </Form>
          
          <Paragraph 
            type="secondary" 
            style={{ 
              marginTop: '10px', 
              fontSize: '11px',
              lineHeight: '1.4',
              marginBottom: '4px'
            }}
          >
            Configure your LAN file sharing system. Adjust upload limits, storage paths, and logging preferences.
          </Paragraph>
        </Card>
      </Content>
    </Layout>
  );
};

export default Settings;
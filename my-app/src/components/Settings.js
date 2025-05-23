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
            fontSize: '18px',
            fontWeight: 600
          }}>
            Reset Admin Password
          </Title>
          <Text type="secondary" style={{
            fontSize: '13px',
            display: 'block',
            textAlign: 'center',
            marginBottom: '14px'
          }}>
            For security, please use a strong password. You will need to re-login after resetting.
          </Text>
          <Divider style={{ margin: '14px 0' }} />
          <Form
            layout="vertical"
            onFinish={onFinish}
            style={{ maxWidth: 380, margin: '0 auto' }}
          >
            <Form.Item
              label={<span style={{ fontSize: '13px', fontWeight: 500 }}>New Password</span>}
              name="newPassword"
              rules={[
                { required: true, message: 'Please enter a new password' },
                { min: 8, message: 'Password must be at least 8 characters' },
                { pattern: /^(?=.*[A-Z])(?=.*\d).+$/, message: 'Must include an uppercase letter and a number' }
              ]}
              hasFeedback
              style={{ marginBottom: '18px' }}
            >
              <Input.Password
                placeholder="Enter new password"
                size="large"
                style={{ fontSize: '14px' }}
                autoComplete="new-password"
              />
            </Form.Item>
            <Form.Item
              label={<span style={{ fontSize: '13px', fontWeight: 500 }}>Confirm Password</span>}
              name="confirmPassword"
              dependencies={["newPassword"]}
              hasFeedback
              rules={[
                { required: true, message: 'Please confirm your password' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Passwords do not match!'));
                  },
                }),
              ]}
              style={{ marginBottom: '20px' }}
            >
              <Input.Password
                placeholder="Confirm new password"
                size="large"
                style={{ fontSize: '14px' }}
                autoComplete="new-password"
              />
            </Form.Item>
            <Form.Item style={{ marginTop: '10px', marginBottom: '0' }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                size="large"
                block
                style={{ fontSize: '15px', fontWeight: 500 }}
              >
                Reset Password
              </Button>
            </Form.Item>
          </Form>
          <Paragraph
            type="secondary"
            style={{
              marginTop: '18px',
              fontSize: '11.5px',
              lineHeight: '1.6',
              marginBottom: '4px',
              textAlign: 'center',
              color: '#888'
            }}
          >
            Make sure your password is memorable and secure. Contact the system administrator if you encounter issues.
          </Paragraph>
        </Card>
      </Content>
    </Layout>
  );
};

export default Settings;
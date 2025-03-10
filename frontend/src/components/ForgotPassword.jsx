// src/components/ForgotPassword.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, message, Card } from 'antd';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async (values) => {
    const { username, newPassword } = values;
    setLoading(true);
    try {
      const response = await fetch('/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, new_password: newPassword }),
      });
      if (!response.ok) {
        const data = await response.json();
        message.error(data.message || 'Failed to reset password.');
      } else {
        const data = await response.json();
        message.success(data.message);
        navigate('/login');
      }
    } catch (err) {
      message.error(`An error occurred: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f0f2f5',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '1rem',
      }}
    >
      <Card
        title="Reset Password"
        variant="inner"  // Use variant instead of bordered={false}
        style={{
          width: 400,
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        }}
      >
        <Form layout="vertical" onFinish={handleForgotPassword}>
          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: true, message: 'Please input your username!' }]}
          >
            <Input placeholder="Enter your username" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="New Password"
            rules={[{ required: true, message: 'Please input your new password!' }]}
          >
            <Input.Password placeholder="Enter your new password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Reset Password
            </Button>
          </Form.Item>
          <Form.Item>
            <Button type="link" onClick={() => navigate('/login')} block>
              Back to Login
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ForgotPassword;

// src/components/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, message } from 'antd';

const Login = () => {
  const navigate = useNavigate();
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (values) => {
    const { username, password } = values;
    setLoading(true);
    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        message.error('Invalid username or password.');
      } else {
        const data = await response.json();
        message.success(data.message);
        // Store username and role in localStorage
        localStorage.setItem('loggedInUser', JSON.stringify({ username: data.username, role: data.role }));
        // Redirect based on role
        if (data.role === 'admin') {
          navigate('/admin-dashboard');
        } else {
          navigate('/user-dashboard');
        }
      }
    } catch (err) {
      message.error(`An error occurred: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (values) => {
    const { newPassword } = values;
    setLoading(true);
    try {
      const response = await fetch('/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        message.error(data.message || 'Failed to reset password.');
      } else {
        const data = await response.json();
        message.success(data.message);
        // Optionally redirect back to login after a successful reset
        navigate('/');
      }
    } catch (err) {
      message.error(`An error occurred: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: 'auto', padding: '1rem' }}>
      <h2>Login</h2>
      {!isForgotPassword ? (
        <Form layout="vertical" onFinish={handleLogin}>
          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: true, message: 'Please input your username!' }]}
          >
            <Input placeholder="Enter your username" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Please input your password!' }]}
          >
            <Input.Password placeholder="Enter your password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Login
            </Button>
          </Form.Item>
          <Form.Item>
            <Button type="link" onClick={() => setIsForgotPassword(true)} block>
              Forgot Password?
            </Button>
          </Form.Item>
        </Form>
      ) : (
        <Form layout="vertical" onFinish={handleForgotPassword}>
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
            <Button type="link" onClick={() => setIsForgotPassword(false)} block>
              Back to Login
            </Button>
          </Form.Item>
        </Form>
      )}
    </div>
  );
};

export default Login;

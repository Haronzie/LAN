import React from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

const LoginForm = () => {
  const navigate = useNavigate();

  const onFinish = async (values) => {
    // Show loading message
    const hideLoading = message.loading('Logging in...', 0);

    try {
      const res = await axios.post('/login', values, { withCredentials: true });

      hideLoading();
      message.success(res.data.message || 'Login successful');

      // Always store the username in localStorage so OperationDashboard can use it
      localStorage.setItem('username', res.data.username);

      // Redirect based on role
      if (res.data.role === 'admin') {
        navigate('/admin'); // Admin dashboard
      } else {
        navigate('/user');  // Regular user dashboard
      }
    } catch (error) {
      hideLoading();

      if (error.response) {
        if (error.response.status === 401) {
          message.error('Invalid username or password. Please try again.');
        } else {
          message.error(error.response.data.message || 'Login failed. Please try again later.');
        }
      } else {
        message.error('Server error. Please check your connection.');
      }
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f0f2f5',
        fontFamily: '"Roboto", sans-serif'
      }}
    >
      <Card
        style={{
          width: 350,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderRadius: 8
        }}
      >
        <Title
          level={3}
          style={{
            textAlign: 'center',
            marginBottom: 24,
            fontFamily: '"Roboto", sans-serif',
            fontWeight: 700,
            color: '#1890ff'
          }}
        >
          CDRRMO Login
        </Title>
        <Form name="login" layout="vertical" onFinish={onFinish}>
          <Form.Item
            label="Username"
            name="username"
            rules={[{ required: true, message: 'Please input your username!' }]}
          >
            <Input placeholder="Enter your username" autoFocus />
          </Form.Item>
          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Please input your password!' }]}
          >
            <Input.Password placeholder="Enter your password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Log in
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default LoginForm;

import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Modal } from 'antd';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

const LoginForm = () => {
  const navigate = useNavigate();

  // We store the typed username so we can pass it to the forgot password flow
  const [typedUsername, setTypedUsername] = useState('');
  // Toggles the forgot password form
  const [showForgotForm, setShowForgotForm] = useState(false);

  // Handle input changes in the username field
  const handleUsernameChange = (e) => {
    setTypedUsername(e.target.value.trim());
  };

  // Normal login flow
  const onFinish = async (values) => {
    const hideLoading = message.loading('Logging in...', 0);
    try {
      const res = await axios.post('/login', values, { withCredentials: true });
      hideLoading();
      message.success(res.data.message || 'Login successful');
      localStorage.setItem('username', res.data.username);
      if (res.data.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/user');
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

  // Attempt to show the Forgot Password form
  // 1. We check if typedUsername is admin. If yes, show the form. Otherwise, show an error.
  const handleForgotPasswordClick = async () => {
    if (!typedUsername) {
      message.error('Please type your username first.');
      return;
    }
    try {
      const res = await axios.get(`/get-user-role?username=${typedUsername}`);
      if (res.data.role === 'admin') {
        setShowForgotForm(true);
      } else {
        message.error('Only admin can use Forgot Password.');
      }
    } catch (error) {
      message.error('User not found or server error.');
    }
  };

  // Submit the forgot password form
  const onForgotFinish = async (values) => {
    const { newPassword, confirmPassword } = values;
    // typedUsername is from state
    const body = {
      username: typedUsername,
      newPassword,
      confirmPassword
    };

    const hideLoading = message.loading('Resetting password...', 0);
    try {
      const res = await axios.post('/forgot-password', body);
      hideLoading();
      message.success(res.data.message || 'Password updated successfully');
      setShowForgotForm(false);
    } catch (error) {
      hideLoading();
      if (error.response?.data?.error) {
        message.error(error.response.data.error);
      } else {
        message.error('Failed to reset password. Please try again.');
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

        {!showForgotForm ? (
          // LOGIN FORM
          <Form name="login" layout="vertical" onFinish={onFinish}>
            <Form.Item
              label="Username"
              name="username"
              rules={[{ required: true, message: 'Please input your username!' }]}
            >
              <Input
                placeholder="Enter your username"
                autoFocus
                onChange={handleUsernameChange}
              />
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

            {/* "Forgot Password?" always visible */}
            <div style={{ textAlign: 'right' }}>
              <Button type="link" onClick={handleForgotPasswordClick}>
                Forgot Password?
              </Button>
            </div>
          </Form>
        ) : (
          // FORGOT PASSWORD FORM
          <Form name="forgotForm" layout="vertical" onFinish={onForgotFinish}>
            <Form.Item
              label="New Password"
              name="newPassword"
              rules={[{ required: true, message: 'Please input your new password!' }]}
            >
              <Input.Password placeholder="Enter new password" />
            </Form.Item>
            <Form.Item
              label="Confirm New Password"
              name="confirmPassword"
              dependencies={['newPassword']}
              hasFeedback
              rules={[
                { required: true, message: 'Please confirm your new password!' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Passwords do not match!'));
                  }
                })
              ]}
            >
              <Input.Password placeholder="Confirm new password" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block>
                Reset Password
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'right' }}>
              <Button type="link" onClick={() => setShowForgotForm(false)}>
                Back to Login
              </Button>
            </div>
          </Form>
        )}
      </Card>
    </div>
  );
};

export default LoginForm;

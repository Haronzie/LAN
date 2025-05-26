import React, { useState } from 'react';
import { Layout, Card, Form, Input, Button, message, Typography, Divider, Modal } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

const Settings = () => {
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const checkCurrentPassword = async (username, newPassword) => {
    try {
      const response = await axios.post(
        `${BASE_URL}/check-current-password`,
        { username, password: newPassword },
        { withCredentials: true }
      );
      return response.data?.isCurrentPassword || false;
    } catch (error) {
      console.error('Error checking current password:', error);
      return false;
    }
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      // Get the current username from local storage
      const username = localStorage.getItem('username');
      if (!username) {
        // Fallback to sessionStorage if localStorage is not available
        const sessionUser = sessionStorage.getItem('user');
        if (sessionUser) {
          const userData = JSON.parse(sessionUser);
          if (userData && userData.username) {
            localStorage.setItem('username', userData.username);
            return { username: userData.username };
          }
        }
        throw new Error('User not found in session. Please log in again.');
      }
      
      // Check if new password is the same as current password
      const isCurrentPassword = await checkCurrentPassword(username, values.newPassword);
      if (isCurrentPassword) {
        throw new Error('New password cannot be the same as your current password');
      }
      
      const user = { username };
      
      console.log('Attempting to reset password for user:', user.username);
      const requestData = {
        username: user.username,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword
      };
      console.log('Sending request data:', JSON.stringify(requestData, null, 2));
      
      // Call the forgot-password endpoint with the current username
      const response = await axios.post(
        `${BASE_URL}/forgot-password`,
        requestData,
        { 
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Password reset response:', response.data);
      
      // If we get here, the password was updated successfully
      Modal.success({
        title: 'Password Reset Successful',
        content: 'Your password has been updated successfully. You will be logged out to apply changes.',
        onOk: () => {
          // Clear any existing user session
          localStorage.removeItem('user');
          // Redirect to login page
          navigate('/login');
        }
      });
    } catch (error) {
      console.error('Password reset error:', error);
      let errorMessage = 'Failed to update password. Please try again.';
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
        
        if (error.response.data && error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.status === 400) {
          errorMessage = 'Invalid request. Please check your input and try again.';
        } else if (error.response.status === 403) {
          errorMessage = 'You do not have permission to perform this action.';
        } else if (error.response.status === 404) {
          errorMessage = 'User not found.';
        }
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received:', error.request);
        errorMessage = 'No response from server. Please check your connection.';
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Request setup error:', error.message);
        errorMessage = `Request error: ${error.message}`;
      }
      
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
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
import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, message, Spin, Popover } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

const passwordPolicyContent = (
  <div style={{ maxWidth: 250 }}>
    <p>Your password should have:</p>
    <ul style={{ paddingLeft: '20px' }}>
      <li>At least 8 characters</li>
      <li>One uppercase letter</li>
      <li>One lowercase letter</li>
      <li>One digit</li>
      <li>One special character (e.g., !@#$)</li>
    </ul>
  </div>
);

const BASE_URL = `${window.location.protocol}//${window.location.hostname}:8080`;

const RegisterForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [adminExists, setAdminExists] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/admin-exists`, { withCredentials: true });
        setAdminExists(res.data.exists);
      } catch (error) {
        message.error('Failed to check admin status.');
      } finally {
        setLoading(false);
      }
    };
    checkAdmin();
  }, []);

  const onFinish = async (values) => {
    try {
      const res = await axios.post('http://localhost:8080/register', values, { withCredentials: true });
      message.success(res.data.message);
      navigate('/login');
    } catch (error) {
      message.error(error.response?.data?.error || 'Registration failed');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (adminExists) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <Title level={3}>Admin account already exists.</Title>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      <Card style={{ width: 350, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: 8 }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>Register</Title>
        <Form name="register" layout="vertical" onFinish={onFinish}>
          <Form.Item
            label="Username"
            name="username"
            rules={[{ required: true, message: 'Please input your username!' }]}
          >
            <Input placeholder="Enter your username" autoFocus />
          </Form.Item>

          <Form.Item
            label={
              <span>
                Password
                <Popover content={passwordPolicyContent} title="Password Requirements">
                  <InfoCircleOutlined style={{ marginLeft: 8, color: '#1890ff', cursor: 'pointer' }} />
                </Popover>
              </span>
            }
            name="password"
            rules={[{ required: true, message: 'Please input your password!' }]}
            hasFeedback
          >
            <Input.Password placeholder="Enter your password" />
          </Form.Item>

          <Form.Item
            label="Confirm Password"
            name="confirmPassword"
            dependencies={['password']}
            hasFeedback
            rules={[
              { required: true, message: 'Please confirm your password!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || getFieldValue('password') === value
                    ? Promise.resolve()
                    : Promise.reject(new Error('Passwords do not match!'));
                }
              })
            ]}
          >
            <Input.Password placeholder="Confirm your password" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Register
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default RegisterForm;

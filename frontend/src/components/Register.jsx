// src/components/Register.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, message } from 'antd';

const Register = () => {
  const [isRegistrationClosed, setIsRegistrationClosed] = useState(false);
  const navigate = useNavigate();

  // Check if an admin is already registered on mount
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/admin-status');
        if (response.ok) {
          const data = await response.json();
          setIsRegistrationClosed(data.adminExists);
        } else {
          console.error('Failed to check admin status');
        }
      } catch (err) {
        console.error('Error checking admin status:', err);
      }
    };

    checkAdminStatus();
  }, []);

  // Handle form submission
  const handleRegister = async (values) => {
    const { username, password } = values;
    try {
      const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        message.error(errorText || 'Registration failed.');
      } else {
        const data = await response.json();
        message.success(data.message);
        // Redirect to Login after a successful registration
        navigate('/login');
      }
    } catch (err) {
      message.error(`An error occurred: ${err.message}`);
    }
  };

  if (isRegistrationClosed) {
    return (
      <div style={{ maxWidth: '400px', margin: 'auto', padding: '1rem' }}>
        <h2>Register</h2>
        <p style={{ color: 'red' }}>Admin already registered. Registration is closed.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '400px', margin: 'auto', padding: '1rem' }}>
      <h2>Register</h2>
      <Form layout="vertical" onFinish={handleRegister}>
        <Form.Item
          label="Username"
          name="username"
          rules={[{ required: true, message: 'Please input your username!' }]}
        >
          <Input placeholder="Enter your username" />
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
            Register
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default Register;

// src/components/Register.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, message, Modal } from 'antd';

const Register = () => {
  const [isRegistrationClosed, setIsRegistrationClosed] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const navigate = useNavigate();

  // Check if an admin is already registered on mount
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/admin-status');
        if (response.ok) {
          const data = await response.json();
          console.log("adminExists:", data.adminExists); // Debug log
          setIsRegistrationClosed(data.adminExists);
          if (data.adminExists) {
            setModalVisible(true);
          }
        } else {
          console.error('Failed to check admin status');
        }
      } catch (err) {
        console.error('Error checking admin status:', err);
      }
    };

    checkAdminStatus();
  }, []);

  // Handle form submission for registration
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
        navigate('/login');
      }
    } catch (err) {
      message.error(`An error occurred: ${err.message}`);
    }
  };

  return (
    <>
      {/* Modal for registration closed */}
      <Modal
        open={modalVisible}
        title="Registration Closed"
        onOk={() => {
          setModalVisible(false);
          navigate('/login');
        }}
        cancelButtonProps={{ style: { display: 'none' } }}
        okText="Go to Login"
      >
        <p>Admin already registered. Registration is closed.</p>
      </Modal>

      {/* Render registration form only if registration is not closed */}
      {!isRegistrationClosed && (
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
      )}
    </>
  );
};

export default Register;

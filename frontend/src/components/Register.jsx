// src/components/Register.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, message, Modal, Card } from 'antd';

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
          setIsRegistrationClosed(data.adminExists);
          if (data.adminExists) {
            // Show a modal popup informing the user that registration is closed.
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
      {/* Modal popup that informs the user registration is closed */}
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

      {/* If registration is closed, display a friendly message with a button to go to login.
          This ensures that if a user accesses the registration page from the navigation bar,
          they receive clear feedback rather than a hidden page. */}
      {isRegistrationClosed ? (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f0f2f5',
            padding: '1rem',
          }}
        >
          <Card
            title="Registration Closed"
            bordered={false}
            style={{
              width: 400,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              borderRadius: '8px',
            }}
          >
            <p>Admin already registered. Registration is closed.</p>
            <Button type="primary" block onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          </Card>
        </div>
      ) : (
        // Registration form is displayed if no admin exists.
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f0f2f5',
            padding: '1rem',
          }}
        >
          <Card
            title="Register"
            bordered={false}
            style={{
              width: 400,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              borderRadius: '8px',
            }}
          >
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
          </Card>
        </div>
      )}
    </>
  );
};

export default Register;

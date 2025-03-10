// src/components/HomePage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'antd';

function HomePage() {
  return (
    <div style={{ padding: '1rem', textAlign: 'center' }}>
      <h2>Welcome to Our LAN File Sharing App</h2>
      <p>Please log in or register to continue.</p>
      <p>
        <Link to="/login">
          <Button type="primary" style={{ marginRight: '1rem' }}>
            Login
          </Button>
        </Link>
        <Link to="/register">
          <Button>Register</Button>
        </Link>
      </p>
    </div>
  );
}

export default HomePage;

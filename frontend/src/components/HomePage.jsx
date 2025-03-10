// src/components/HomePage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'antd';

function HomePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          maxWidth: '400px',
          textAlign: 'center',
        }}
      >
        <h2 style={{ marginBottom: '1rem' }}>Welcome to Our LAN File Sharing App</h2>
        <p style={{ marginBottom: '2rem', color: '#888' }}>
          Please log in or register to continue.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link to="/login">
            <Button type="primary">Login</Button>
          </Link>
          <Link to="/register">
            <Button>Register</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default HomePage;

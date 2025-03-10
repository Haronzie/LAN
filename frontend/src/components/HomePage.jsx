// src/components/HomePage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'antd';
import './HomePage.css';  // Import your CSS file

function HomePage() {
  return (
    <div className="homepage">
      <div className="homepage__card">
        <h2 className="homepage__title">Welcome to Our LAN File Sharing App</h2>
        <p className="homepage__subtitle">Please log in or register to continue.</p>
        <div className="homepage__buttons">
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

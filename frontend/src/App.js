import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Register from './components/Register';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';

function App() {
  return (
    <Router>
      <nav style={{ padding: '1rem', background: '#f0f0f0' }}>
        <Link to="/register" style={{ marginRight: '1rem' }}>Register</Link>
        <Link to="/login" style={{ marginRight: '1rem' }}>Login</Link>
        <Link to="/admin-dashboard">Admin Dashboard</Link>
      </nav>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/" element={
          <div style={{ padding: '1rem' }}>
            <h2>Welcome to Our App</h2>
            <p>Please choose an option above.</p>
          </div>
        } />
      </Routes>
    </Router>
  );
}

export default App;

// src/App.jsx
import React from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Register from './components/Register';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import RegisterRoute from './components/RegisterRoute';
import LoginRoute from './components/LoginRoute';

function App() {
  return (
    <Router>
      {/* Navigation Bar */}
      <nav aria-label="Main Navigation" style={{ padding: '1rem', background: '#f0f0f0' }}>
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'row',   // Change this to 'row'
            gap: '1rem',           // Space between links
            alignItems: 'center'   // Optional, aligns items vertically in center
          }}
        >
          <li>
            <Link to="/register" style={{ textDecoration: 'none', color: '#333' }}>
              Register
            </Link>
          </li>
          <li>
            <Link to="/login" style={{ textDecoration: 'none', color: '#333' }}>
              Login
            </Link>
          </li>
          <li>
            <Link to="/admin-dashboard" style={{ textDecoration: 'none', color: '#333' }}>
              Admin Dashboard
            </Link>
          </li>
          <li>
            <Link to="/user-dashboard" style={{ textDecoration: 'none', color: '#333' }}>
              User Dashboard
            </Link>
          </li>
        </ul>
      </nav>

      {/* Container for routed content */}
      <div className="container">
        <Routes>
          {/* Registration Route */}
          <Route
            path="/register"
            element={
              <RegisterRoute>
                <Register />
              </RegisterRoute>
            }
          />

          {/* Login Route */}
          <Route
            path="/login"
            element={
              <LoginRoute>
                <Login />
              </LoginRoute>
            }
          />

          {/* Admin Dashboard: Only accessible to logged-in admin users */}
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* User Dashboard: Only accessible to logged-in non-admin users */}
          <Route
            path="/user-dashboard"
            element={
              <ProtectedRoute disallowedRole="admin">
                <UserDashboard />
              </ProtectedRoute>
            }
          />

          {/* Home / Fallback */}
          <Route
            path="/"
            element={
              <div style={{ padding: '1rem' }}>
                <h2>Welcome to Our App</h2>
                <p>Please choose an option above.</p>
              </div>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

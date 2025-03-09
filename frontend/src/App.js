// src/App.jsx
import React from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Register from './components/Register';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';

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
            flexDirection: 'column',
          }}
        >
          <li style={{ marginBottom: '0.5rem' }}>
            <Link to="/register" style={{ textDecoration: 'none', color: '#333' }}>
              Register
            </Link>
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <Link to="/login" style={{ textDecoration: 'none', color: '#333' }}>
              Login
            </Link>
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
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
          {/* Registration Route: Only show "Registration is closed" when applicable */}
          <Route
            path="/register"
            element={
              <GuestRoute>
                <Register />
              </GuestRoute>
            }
          />

          {/* Login Route: Only block logged-in users from accessing */}
          <Route
            path="/login"
            element={
              <GuestRoute>
                <Login />
              </GuestRoute>
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

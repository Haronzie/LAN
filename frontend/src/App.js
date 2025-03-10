// src/App.jsx
import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from 'react-router-dom';
import { Layout, Menu } from 'antd';
import HomePage from './components/HomePage';
import Register from './components/Register';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import RegisterRoute from './components/RegisterRoute';
import LoginRoute from './components/LoginRoute';

const { Header, Content } = Layout;

function App() {
  const location = useLocation();

  const menuItems = [
    { key: '/', label: <Link to="/">Home</Link> },
    { key: '/register', label: <Link to="/register">Register</Link> },
    { key: '/login', label: <Link to="/login">Login</Link> },
    { key: '/admin-dashboard', label: <Link to="/admin-dashboard">Admin Dashboard</Link> },
    { key: '/user-dashboard', label: <Link to="/user-dashboard">User Dashboard</Link> },
  ];

  return (
    <Layout>
      <Header style={{ backgroundColor: '#001529' }}>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          style={{ lineHeight: '64px' }}
          items={menuItems}
        />
      </Header>
      <Content
        style={{
          padding: '2rem',
          background: '#fff',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/register"
            element={
              <RegisterRoute>
                <Register />
              </RegisterRoute>
            }
          />
          <Route
            path="/login"
            element={
              <LoginRoute>
                <Login />
              </LoginRoute>
            }
          />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-dashboard"
            element={
              <ProtectedRoute disallowedRole="admin">
                <UserDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Content>
    </Layout>
  );
}

// Wrap App in a Router provider.
function AppWrapper() {
  return (
    <Router>
      <App />
    </Router>
  );
}

export default AppWrapper;

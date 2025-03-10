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
import Register from './components/Register';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import RegisterRoute from './components/RegisterRoute';
import LoginRoute from './components/LoginRoute';

const { Header, Content } = Layout;

function App() {
  // useLocation hook returns an object describing the current URL
  const location = useLocation();

  return (
    <Layout>
      <Header style={{ backgroundColor: '#001529' }}>
        <Menu
          theme="dark"
          mode="horizontal"
          // Use the current pathname as the selected key
          selectedKeys={[location.pathname]}
          style={{ lineHeight: '64px' }}
        >
          <Menu.Item key="/register">
            <Link to="/register">Register</Link>
          </Menu.Item>
          <Menu.Item key="/login">
            <Link to="/login">Login</Link>
          </Menu.Item>
          <Menu.Item key="/admin-dashboard">
            <Link to="/admin-dashboard">Admin Dashboard</Link>
          </Menu.Item>
          <Menu.Item key="/user-dashboard">
            <Link to="/user-dashboard">User Dashboard</Link>
          </Menu.Item>
        </Menu>
      </Header>
      <Content
        style={{
          padding: '2rem',
          background: '#fff',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <Routes>
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
          <Route
            path="/"
            element={
              <div style={{ padding: '1rem', textAlign: 'center' }}>
                <h2>Welcome to Our App</h2>
                <p>Please choose an option above.</p>
              </div>
            }
          />
        </Routes>
      </Content>
    </Layout>
  );
}

// We wrap App in a small component that provides the Router context.
function AppWrapper() {
  return (
    <Router>
      <App />
    </Router>
  );
}

export default AppWrapper;

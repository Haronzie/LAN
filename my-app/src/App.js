import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './components/Home';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import AdminDashboard from './components/AdminDashboard';
import UserManagement from './components/UserManagement';
import FileManager from './components/FileManager';
import AuditLog from './components/Auditlog';
import UserDashboard from './components/UserDashboard';
import UserDashboardHome from './components/UserDashboardHome';
import OperationDashboard from './components/OperationDashboard';
import TrainingDashboard from './components/TrainingDashboard';
import ResearchDashboard from './components/ResearchDashboard';
import InventoryDashboard from './components/InventoryDashboard';
import UserSettings from './components/UserSettings';
import Settings from './components/Settings';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css'; 
import axios from 'axios';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  const [adminExists, setAdminExists] = useState(false);
  const [loading, setLoading] = useState(true);

  // Simulated user state.
  // In your real application, replace this with actual auth logic or context.
  const [user, setUser] = useState({
    isAuthenticated: false,
    role: '', // e.g., 'admin' or 'user'
  });

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await axios.get('/admin-exists'); // Uses proxy
        setAdminExists(res.data.exists);
      } catch (error) {
        console.error('Failed to check admin status.');
      } finally {
        setLoading(false);
      }
    };
    checkAdmin();

    // Simulate user authentication state.
    // Replace with your actual authentication logic.
    // For testing, if you want to test admin routes, change role to 'admin'
    setUser({ isAuthenticated: true, role: 'user' });
  }, []);

  if (loading) return null;

  return (
    <Router>
      <ToastContainer /> {/* Toast container for notifications */}
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginForm />} />
        {!adminExists && <Route path="/register" element={<RegisterForm />} />}

        {/* Protected routes for any authenticated user */}
        <Route
          path="/upload"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              {/* Replace with your actual upload component */}
              <div>Upload Page</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/copy-file"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <div>Copy File Page</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/move-file"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <div>Move File Page</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/download"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <div>Download Page</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/files"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <div>Files Listing</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/share"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <div>Share File Page</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/file/rename"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <div>Rename File Page</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/download-share"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <div>Download Shared File Page</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/get-user-role"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <div>Get User Role Page</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/user-role"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <div>User Role Info Page</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/files/all"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <div>All Files Listing</div>
            </ProtectedRoute>
          }
        />

        {/* Directory Routes */}
        <Route
          path="/directory/create"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <div>Create Directory</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/directory/delete"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <div>Delete Directory</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/directory/rename"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <div>Rename Directory</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/directory/list"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <div>List Directory</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/directory/copy"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <div>Copy Directory</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/directory/tree"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <div>Directory Tree</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/directory/move"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <div>Move Directory</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/download-folder"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <div>Download Folder</div>
            </ProtectedRoute>
          }
        />

        {/* Inventory Routes */}
        <Route
          path="/inventory"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <div>Inventory Listing</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/:id"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <div>Inventory Detail</div>
            </ProtectedRoute>
          }
        />

        {/* Audit Log Route */}
        <Route
          path="/auditlogs"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <AuditLog />
            </ProtectedRoute>
          }
        />

        {/* WebSocket or Other Special Routes */}
        <Route
          path="/ws"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <div>WebSocket Connection</div>
            </ProtectedRoute>
          }
        />

        {/* Admin-specific Routes: Require "admin" role */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute
              isAuthenticated={user.isAuthenticated}
              userRole={user.role}
              requiredRole="admin"
            >
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute
              isAuthenticated={user.isAuthenticated}
              userRole={user.role}
              requiredRole="admin"
            >
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/files"
          element={
            <ProtectedRoute
              isAuthenticated={user.isAuthenticated}
              userRole={user.role}
              requiredRole="admin"
            >
              <FileManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <ProtectedRoute
              isAuthenticated={user.isAuthenticated}
              userRole={user.role}
              requiredRole="admin"
            >
              <AuditLog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute
              isAuthenticated={user.isAuthenticated}
              userRole={user.role}
              requiredRole="admin"
            >
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* User Routes with Nested Routes */}
        <Route
          path="/user/*"
          element={
            <ProtectedRoute isAuthenticated={user.isAuthenticated}>
              <UserDashboard />
            </ProtectedRoute>
          }
        >
          <Route index element={<UserDashboardHome />} />
          <Route path="home" element={<UserDashboardHome />} />
          <Route path="operation" element={<OperationDashboard />} />
          <Route path="training" element={<TrainingDashboard />} />
          <Route path="research" element={<ResearchDashboard />} />
          <Route path="inventory/*" element={<InventoryDashboard />} />
          <Route path="settings" element={<UserSettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;

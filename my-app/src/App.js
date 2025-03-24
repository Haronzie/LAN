import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './components/Home';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import AdminDashboard from './components/AdminDashboard';
import UserManagement from './components/UserManagement';
import FileManager from './components/FileManager';
import AuditLog from './components/Auditlog'; // Ensure this is the correct path
import UserDashboard from './components/UserDashboard';
import UserDashboardHome from './components/UserDashboardHome';
import OperationDashboard from './components/OperationDashboard';
import TrainingDashboard from './components/TrainingDashboard';
import ResearchDashboard from './components/ResearchDashboard';
import InventoryDashboard from './components/InventoryDashboard';
import UserSettings from './components/UserSettings';  // Import your UserSettings component
import Settings from './components/Settings'; // Import your Settings component

import axios from 'axios';

function App() {
  const [adminExists, setAdminExists] = useState(false);
  const [loading, setLoading] = useState(true);

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
  }, []);

  if (loading) return null;

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginForm />} />
        {!adminExists && <Route path="/register" element={<RegisterForm />} />}

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/files" element={<FileManager />} />
        <Route path="/admin/audit-logs" element={<AuditLog />} />
        <Route path="/admin/settings" element={<Settings />} /> {/* <-- Add this route */}

        {/* User Routes with Nested Routes */}
        <Route path="/user/*" element={<UserDashboard />}>
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

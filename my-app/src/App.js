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
import './App.css'; 
import axios from 'axios';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  const [adminExists, setAdminExists] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await axios.get('/admin-exists');
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
      <ToastContainer />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginForm />} />
        {!adminExists && <Route path="/register" element={<RegisterForm />} />}

        <Route path="/upload" element={<div>Upload Page</div>} />
        <Route path="/copy-file" element={<div>Copy File Page</div>} />
        <Route path="/move-file" element={<div>Move File Page</div>} />
        <Route path="/download" element={<div>Download Page</div>} />
        <Route path="/files" element={<div>Files Listing</div>} />
        <Route path="/share" element={<div>Share File Page</div>} />
        <Route path="/file/rename" element={<div>Rename File Page</div>} />
        <Route path="/download-share" element={<div>Download Shared File Page</div>} />
        <Route path="/get-user-role" element={<div>Get User Role Page</div>} />
        <Route path="/user-role" element={<div>User Role Info Page</div>} />
        <Route path="/files/all" element={<div>All Files Listing</div>} />

        <Route path="/directory/create" element={<div>Create Directory</div>} />
        <Route path="/directory/delete" element={<div>Delete Directory</div>} />
        <Route path="/directory/rename" element={<div>Rename Directory</div>} />
        <Route path="/directory/list" element={<div>List Directory</div>} />
        <Route path="/directory/copy" element={<div>Copy Directory</div>} />
        <Route path="/directory/tree" element={<div>Directory Tree</div>} />
        <Route path="/directory/move" element={<div>Move Directory</div>} />
        <Route path="/download-folder" element={<div>Download Folder</div>} />

        <Route path="/inventory" element={<div>Inventory Listing</div>} />
        <Route path="/inventory/:id" element={<div>Inventory Detail</div>} />

        <Route path="/auditlogs" element={<AuditLog />} />
        <Route path="/ws" element={<div>WebSocket Connection</div>} />

        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/files" element={<FileManager />} />
        <Route path="/admin/audit-logs" element={<AuditLog />} />
        <Route path="/admin/settings" element={<Settings />} />

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

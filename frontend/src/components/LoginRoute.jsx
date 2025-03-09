// src/components/LoginRoute.jsx
import React, { useEffect, useState } from 'react';
import { getLoggedInUser } from '../utils/auth';

const LoginRoute = ({ children }) => {
  const [adminExists, setAdminExists] = useState(null);
  const [loading, setLoading] = useState(true);
  const user = getLoggedInUser();

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/admin-status');
        if (response.ok) {
          const data = await response.json();
          // If an admin exists then registration is closed
          setAdminExists(data.adminExists);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      } finally {
        setLoading(false);
      }
    };
    checkAdminStatus();
  }, []);

  if (loading) return <div>Loading...</div>;

  // If no admin exists, then no user is registered yet
  if (!adminExists) {
    return <div>No user exists yet. Please register first.</div>;
  }

  // If a user is already logged in, block access to the login page
  if (user) {
    return <div>You are already logged in. Please log out to access this page.</div>;
  }

  return children;
};

export default LoginRoute;

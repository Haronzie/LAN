// src/components/RegisterRoute.jsx
import React, { useEffect, useState } from 'react';
import { getLoggedInUser } from '../utils/auth';

const RegisterRoute = ({ children }) => {
  const [registrationClosed, setRegistrationClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const user = getLoggedInUser();

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/admin-status');
        if (response.ok) {
          const data = await response.json();
          // If an admin exists then registration is closed
          setRegistrationClosed(data.adminExists);
        }
      } catch (err) {
        console.error('Error checking admin status:', err);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, []);

  if (loading) return <div>Loading...</div>;

  // Registration should be blocked if an admin already exists.
  if (registrationClosed) {
    return <div>Registration is closed: Admin already registered.</div>;
  }

  // Also, if a user is logged in, block access.
  if (user) {
    return <div>You are already logged in. Please log out to access this page.</div>;
  }

  return children;
};

export default RegisterRoute;
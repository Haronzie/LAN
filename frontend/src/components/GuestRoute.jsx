// src/components/GuestRoute.jsx
import React, { useEffect, useState } from 'react';
import { getLoggedInUser } from '../utils/auth';
import { useLocation } from 'react-router-dom';

const GuestRoute = ({ children }) => {
  const [registrationClosed, setRegistrationClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const user = getLoggedInUser();
  const location = useLocation();

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

  // If the current route is "/register", check the registration status first.
  if (location.pathname === '/register') {
    if (registrationClosed) {
      return <div>Registration is closed: Admin already registered.</div>;
    }
  } else {
    // For other routes (like "/login"), if the user is logged in, show error.
    if (user) {
      return <div>You are already logged in. Please log out to access this page.</div>;
    }
  }

  return children;
};

export default GuestRoute;

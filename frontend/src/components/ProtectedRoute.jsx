// src/components/ProtectedRoute.jsx
import React from 'react';
import { getLoggedInUser, isRegistered, isAdmin } from '../utils/auth';

const ProtectedRoute = ({ children, requireAdmin = false, disallowedRole }) => {
  // If no user is logged in, prompt registration.
  if (!isRegistered()) {
    return <div>Please login first to access this page.</div>;
  }

  // If this route requires admin rights and the user isn't an admin:
  if (requireAdmin && !isAdmin()) {
    return <div>You are not authorized to view this page.</div>;
  }

  // If a specific role should not access this route:
  if (disallowedRole) {
    const user = getLoggedInUser();
    if (user && user.role === disallowedRole) {
      return <div>Your role is not allowed to access this page.</div>;
    }
  }

  return children;
};

export default ProtectedRoute;

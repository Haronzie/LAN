// src/components/LoginRoute.jsx
import React from 'react';
import { getLoggedInUser } from '../utils/auth';

const LoginRoute = ({ children }) => {
  const user = getLoggedInUser();
  if (user) {
    return <div>You are already logged in. Please log out to access this page.</div>;
  }
  return children;
};

export default LoginRoute;

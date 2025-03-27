import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';

function ProtectedRoute({ children, isAuthenticated, userRole, requiredRole }) {
  const location = useLocation();

  useEffect(() => {
    // Show a toast if user is not authenticated or doesn't have the required role
    if (!isAuthenticated) {
      toast.error("Please log in to access this page", { position: "top-center" });
    } else if (requiredRole && userRole !== requiredRole) {
      toast.error("You're not authorized to access this page", { position: "top-center" });
    }
  }, [isAuthenticated, userRole, requiredRole]);

  // Determine the fallback page if the user cannot access this route
  const redirectTo = location.state?.from?.pathname || "/";

  // If the user is not authenticated, redirect them to the previous page (or "/")
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  // If a required role is specified and the user's role doesn't match, also redirect
  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to={redirectTo} replace />;
  }

  // Otherwise, render the protected children
  return children;
}

export default ProtectedRoute;

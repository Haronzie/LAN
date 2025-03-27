import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';

function ProtectedRoute({ children, isAuthenticated, userRole, requiredRole }) {
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      toast.error("Please log in to access this page", {
        position: "top-center",
      });
    } else if (requiredRole && userRole !== requiredRole) {
      toast.error("You're not authorized to access this page", {
        position: "top-center",
      });
    }
  }, [isAuthenticated, userRole, requiredRole]);

  // If not authenticated or role doesn't match, try to redirect back.
  const redirectTo = location.state?.from?.pathname || "/";

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }
  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}

export default ProtectedRoute;

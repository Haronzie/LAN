// auth.js
export const getLoggedInUser = () => {
    const storedUser = localStorage.getItem('loggedInUser');
    return storedUser ? JSON.parse(storedUser) : null;
  };
  
  export const isRegistered = () => {
    const user = getLoggedInUser();
    return Boolean(user); // Adjust if you store a flag like user.isRegistered
  };
  
  export const isAdmin = () => {
    const user = getLoggedInUser();
    return user && user.role === 'admin';
  };
  
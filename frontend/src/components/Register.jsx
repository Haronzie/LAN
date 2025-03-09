import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const Register = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // State for toggling password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isRegistrationClosed, setIsRegistrationClosed] = useState(false);

  const navigate = useNavigate(); // Create the navigate instance

  // Check if an admin is already registered on mount
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/admin-status');
        if (response.ok) {
          const data = await response.json();
          setIsRegistrationClosed(data.adminExists);
        } else {
          console.error('Failed to check admin status');
        }
      } catch (err) {
        console.error('Error checking admin status:', err);
      }
    };

    checkAdminStatus();
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!username || !password) {
      setError('Username and password are required.');
      return;
    }

    try {
      const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        setError(errorText || 'Registration failed.');
      } else {
        const data = await response.json();
        setMessage(data.message);
        setUsername('');
        setPassword('');
        // Redirect to Login after a successful registration
        navigate('/login');
      }
    } catch (err) {
      setError(`An error occurred: ${err.message}`);
    }
  };

  if (isRegistrationClosed) {
    return (
      <div style={{ maxWidth: '400px', margin: 'auto' }}>
        <h2>Register</h2>
        <p style={{ color: 'red' }}>Admin already registered. Registration is closed.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '400px', margin: 'auto' }}>
      <h2>Register</h2>
      <form onSubmit={handleRegister}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="username">Username:</label>
          <br />
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ marginBottom: '1rem', position: 'relative' }}>
          <label htmlFor="password">Password:</label>
          <br />
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        <button type="submit">Register</button>
      </form>
      {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}
      {message && <p style={{ color: 'green', marginTop: '1rem' }}>{message}</p>}
    </div>
  );
};

export default Register;

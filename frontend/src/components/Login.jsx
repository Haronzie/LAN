import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FocusableInput from './FocusableInput';
import ClickableButton from './ClickableButton';

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  // New state for toggling password visibility
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!username || !password) {
      setError('Username and password are required.');
      return;
    }

    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        setError('Invalid username or password.');
      } else {
        const data = await response.json();
        setMessage(data.message);
        setUsername('');
        setPassword('');

        // Store username and role in localStorage
        localStorage.setItem('loggedInUser', JSON.stringify({ username: data.username, role: data.role }));

        // Redirect based on role
        if (data.role === 'admin') {
          navigate('/admin-dashboard');
        } else {
          navigate('/user-dashboard');
        }
      }
    } catch (err) {
      setError(`An error occurred: ${err.message}`);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!newPassword) {
      setError('New password is required.');
      return;
    }

    try {
      const response = await fetch('/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || 'Failed to reset password.');
      } else {
        const data = await response.json();
        setMessage(data.message);
        setNewPassword('');
        // Optionally redirect back to login after a successful reset
        navigate('/');
      }
    } catch (err) {
      setError(`An error occurred: ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: 'auto' }}>
      <h2>Login</h2>
      {!isForgotPassword ? (
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="username">Username:</label>
            <br />
            <FocusableInput
              id="username"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <ClickableButton type="submit" ariaLabel="Login">
            Login
          </ClickableButton>
          <p style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setIsForgotPassword(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'blue',
                textDecoration: 'underline',
                cursor: 'pointer'
              }}
            >
              Forgot Password?
            </button>
          </p>
        </form>
      ) : (
        <form onSubmit={handleForgotPassword}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="newPassword">New Password:</label>
            <br />
            <input
              type="password"
              id="newPassword"
              placeholder="Enter your new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <ClickableButton type="submit" ariaLabel="Reset Password">
            Reset Password
          </ClickableButton>
          <p style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setIsForgotPassword(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'blue',
                textDecoration: 'underline',
                cursor: 'pointer'
              }}
            >
              Back to Login
            </button>
          </p>
        </form>
      )}
      {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}
      {message && <p style={{ color: 'green', marginTop: '1rem' }}>{message}</p>}
    </div>
  );
};

export default Login;

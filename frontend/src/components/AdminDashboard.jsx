import React, { useState, useEffect } from 'react';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('users'); // default tab is "View Users"
  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // States for "Add User"
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // States for "Update User"
  const [oldUsername, setOldUsername] = useState('');
  const [updatedUsername, setUpdatedUsername] = useState('');
  const [updatedPassword, setUpdatedPassword] = useState('');

  // State for "Delete User"
  const [deleteUsername, setDeleteUsername] = useState('');

  // State for "Assign Admin"
  const [assignUsername, setAssignUsername] = useState('');

  // Fetch users from the back-end
  const fetchUsers = async () => {
    try {
      const response = await fetch('/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    }
  };

  // Fetch files from the back-end
  const fetchFiles = async () => {
    try {
      const response = await fetch('/files');
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      const data = await response.json();
      setFiles(data);
    } catch (err) {
      setError(err.message);
    }
  };

  // When the active tab changes, refresh data if needed
  useEffect(() => {
    setError('');
    setMessage('');
    if (activeTab === 'users') {
      fetchUsers();
    }
    if (activeTab === 'files') {
      fetchFiles();
    }
  }, [activeTab]);

  // Add User handler
  const handleAddUser = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const response = await fetch('/add-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to add user');
      }
      const data = await response.json();
      setMessage(data.message);
      setNewUsername('');
      setNewPassword('');
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  // Update User handler
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const response = await fetch('/update-user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_username: oldUsername,
          new_username: updatedUsername,
          new_password: updatedPassword,
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to update user');
      }
      const data = await response.json();
      setMessage(data.message);
      setOldUsername('');
      setUpdatedUsername('');
      setUpdatedPassword('');
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  // Delete User handler
  const handleDeleteUser = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const response = await fetch('/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: deleteUsername }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to delete user');
      }
      const data = await response.json();
      setMessage(data.message);
      setDeleteUsername('');
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  // Assign Admin handler
  const handleAssignAdmin = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const response = await fetch('/assign-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: assignUsername }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to assign admin');
      }
      const data = await response.json();
      setMessage(data.message);
      setAssignUsername('');
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Admin Dashboard</h2>
      <nav style={{ marginBottom: '1rem' }}>
        <button onClick={() => setActiveTab('users')}>View Users</button>
        <button onClick={() => setActiveTab('addUser')}>Add User</button>
        <button onClick={() => setActiveTab('updateUser')}>Update User</button>
        <button onClick={() => setActiveTab('deleteUser')}>Delete User</button>
        <button onClick={() => setActiveTab('assignAdmin')}>Assign Admin</button>
        <button onClick={() => setActiveTab('files')}>View Files</button>
      </nav>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {message && <p style={{ color: 'green' }}>{message}</p>}

      {activeTab === 'users' && (
        <div>
          <h3>User List</h3>
          {users.length === 0 ? (
            <p>No users found.</p>
          ) : (
            <ul>
              {users.map((user, index) => (
                <li key={index}>{user}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'addUser' && (
        <div>
          <h3>Add User</h3>
          <form onSubmit={handleAddUser}>
            <div>
              <label>Username: </label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
            </div>
            <div>
              <label>Password: </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <button type="submit">Add User</button>
          </form>
        </div>
      )}

      {activeTab === 'updateUser' && (
        <div>
          <h3>Update User</h3>
          <form onSubmit={handleUpdateUser}>
            <div>
              <label>Old Username: </label>
              <input
                type="text"
                value={oldUsername}
                onChange={(e) => setOldUsername(e.target.value)}
              />
            </div>
            <div>
              <label>New Username: </label>
              <input
                type="text"
                value={updatedUsername}
                onChange={(e) => setUpdatedUsername(e.target.value)}
              />
            </div>
            <div>
              <label>New Password: </label>
              <input
                type="password"
                value={updatedPassword}
                onChange={(e) => setUpdatedPassword(e.target.value)}
              />
            </div>
            <button type="submit">Update User</button>
          </form>
        </div>
      )}

      {activeTab === 'deleteUser' && (
        <div>
          <h3>Delete User</h3>
          <form onSubmit={handleDeleteUser}>
            <div>
              <label>Username: </label>
              <input
                type="text"
                value={deleteUsername}
                onChange={(e) => setDeleteUsername(e.target.value)}
              />
            </div>
            <button type="submit">Delete User</button>
          </form>
        </div>
      )}

      {activeTab === 'assignAdmin' && (
        <div>
          <h3>Assign Admin Role</h3>
          <form onSubmit={handleAssignAdmin}>
            <div>
              <label>Username: </label>
              <input
                type="text"
                value={assignUsername}
                onChange={(e) => setAssignUsername(e.target.value)}
              />
            </div>
            <button type="submit">Assign Admin</button>
          </form>
        </div>
      )}

      {activeTab === 'files' && (
        <div>
          <h3>Files</h3>
          {files.length === 0 ? (
            <p>No files found.</p>
          ) : (
            <ul>
              {files.map((file, index) => (
                <li key={index}>
                  {file.file_name} - {file.size} bytes - Uploaded by: {file.uploader}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Spinner from './Spinner'; // Import your Spinner component

const UserDashboard = () => {
  const navigate = useNavigate();

  // Tabs: "files" or "upload"
  const [activeTab, setActiveTab] = useState('files');
  const [files, setFiles] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  
  // Retrieve logged-in user from localStorage
  const [loggedInUser, setLoggedInUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser) {
      const userObj = JSON.parse(storedUser);
      // If the user has the admin role, redirect away from UserDashboard.
      if (userObj.role && userObj.role === 'admin') {
        navigate('/admin-dashboard');
      } else {
        setLoggedInUser(userObj);
      }
    }
  }, [navigate]);
  

  // Wrap fetchFiles in useCallback so it becomes a stable dependency.
  const fetchFiles = useCallback(async () => {
    if (!loggedInUser) {
      setError('You must be logged in to view files.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/files');
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      const data = await response.json();
      setFiles(data || []); // Default to empty array if data is null
    } catch (err) {
      setError(err.message);
    }
    setIsLoading(false);
  }, [loggedInUser]);

  // Fetch files on component mount and whenever fetchFiles changes
  useEffect(() => {
    if (loggedInUser) { 
      fetchFiles();
    }
  }, [loggedInUser, fetchFiles]);

  // Handle file upload (with login check)
  const handleUpload = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!loggedInUser) {
      setError('You must be logged in to upload a file.');
      return;
    }

    if (!uploadFile) {
      setError('Please select a file to upload.');
      return;
    }
    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to upload file');
      }
      const data = await response.json();
      setMessage(data.message);
      setUploadFile(null);
      fetchFiles(); // Refresh the file list after upload
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    setError('');
    setMessage('');
    try {
      const response = await fetch('/logout', { method: 'POST' });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to logout');
      }
      const data = await response.json();
      setMessage(data.message);
      
      // Clear user data from localStorage
      localStorage.removeItem('loggedInUser');
  
      navigate('/login');
    } catch (err) {
      setError(err.message);
    }
  };
  

  // Handle file download
  const handleDownload = async (fileName) => {
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/download?filename=${encodeURIComponent(fileName)}`);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to download file');
      }
      // Convert the response to a Blob for download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName; // Suggested filename
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMessage(`File "${fileName}" downloaded successfully.`);
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle file deletion (with login check)
  const handleDelete = async (fileName) => {
    setError('');
    setMessage('');
    if (!loggedInUser) {
      setError('You must be logged in to delete a file.');
      return;
    }
    try {
      const response = await fetch('/delete-file', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_name: fileName }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to delete file');
      }
      const data = await response.json();
      setMessage(data.message);
      fetchFiles(); // Refresh file list after deletion
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h2>User Dashboard</h2>
      <button onClick={handleLogout}>Logout</button>

      {/* Navigation for tabs */}
      <nav style={{ margin: '1rem 0' }}>
        <button onClick={() => setActiveTab('files')}>View Files</button>
        <button onClick={() => setActiveTab('upload')}>Upload File</button>
      </nav>

      {/* Display errors or success messages */}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {message && <p style={{ color: 'green' }}>{message}</p>}

      {/* Render content based on active tab */}
      {activeTab === 'files' && (
        <div>
          <h3>Files</h3>
          {isLoading ? (
            <Spinner />  // Spinner displayed when loading
          ) : files.length === 0 ? (
            <p>No files found.</p>
          ) : (
            <ul>
              {files.map((file, index) => (
                <li key={index}>
                  {file.file_name} - {file.size} bytes - Uploaded by: {file.uploader}{' '}
                  <button onClick={() => handleDownload(file.file_name)}>Download</button>
                  {loggedInUser && loggedInUser.username === file.uploader && (
                    <button onClick={() => handleDelete(file.file_name)}>Delete</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'upload' && (
        <div>
          <h3>Upload a New File</h3>
          <form onSubmit={handleUpload}>
            <div>
              <label>Select File: </label>
              <input
                type="file"
                onChange={(e) => setUploadFile(e.target.files[0])}
              />
            </div>
            <button type="submit">Upload</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;

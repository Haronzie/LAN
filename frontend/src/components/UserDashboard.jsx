import React, { useState, useEffect } from 'react';
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
  
  // New: Loading state
  const [isLoading, setIsLoading] = useState(false);

  // NEW: Retrieve logged-in user from localStorage
  const [loggedInUser, setLoggedInUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser) {
      setLoggedInUser(JSON.parse(storedUser));
    }
  }, []);

  // Fetch files from the back-end
  const fetchFiles = async () => {
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
  };

  // Fetch files on component mount
  useEffect(() => {
    fetchFiles();
  }, []);

  // Handle file upload
  const handleUpload = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

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
      // Redirect to login
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

  // Handle file deletion
  const handleDelete = async (fileName) => {
    setError('');
    setMessage('');
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
      <nav style={{ marginBottom: '1rem', marginTop: '1rem' }}>
        <button onClick={() => setActiveTab('files')}>View Files</button>
        <button onClick={() => setActiveTab('upload')}>Upload File</button>
      </nav>

      {/* Display errors or success messages */}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {message && <p style={{ color: 'green' }}>{message}</p>}

      {/* Conditionally render based on active tab */}
      {activeTab === 'files' && (
        <div>
          <h3>Files</h3>
          {isLoading ? (
            <Spinner />  // Spinner displayed when loading
          ) : files.length === 0 ? (
            <p>No files found.</p>
          ) : (
            <ul>
              {files.map((file, index) => {
                console.log('loggedInUser:', loggedInUser, 'file.uploader:', file.uploader);
                return (
                  <li key={index}>
                    {file.file_name} - {file.size} bytes - Uploaded by: {file.uploader}{' '}
                    <button onClick={() => handleDownload(file.file_name)}>Download</button>
                    {loggedInUser && loggedInUser.username === file.uploader && (
                      <button onClick={() => handleDelete(file.file_name)}>Delete</button>
                    )}
                  </li>
                );
              })}
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

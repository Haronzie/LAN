import React, { useEffect, useState } from 'react';
import { Button, Input, List, message, Modal, Upload } from 'antd';
import { FolderAddOutlined, UploadOutlined, FolderOpenOutlined } from '@ant-design/icons';
import axios from 'axios';

const OperationDashboard = () => {
  const [folders, setFolders] = useState([]); // Stores folder list
  const [loading, setLoading] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null); // Tracks opened folder

  // Fetch folders inside 'operation'
  const fetchFolders = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/list-resource?directory=operation');
      setFolders(res.data.filter(item => item.type === 'directory')); // Show only folders
    } catch (error) {
      message.error('Failed to load folders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  // Create a new folder inside 'operation'
  const createFolder = async () => {
    if (!newFolderName) {
      message.error('Folder name cannot be empty');
      return;
    }
    try {
      await axios.post('/create-resource', { name: newFolderName, parent: 'operation', type: 'directory' });
      message.success(`Folder "${newFolderName}" created successfully!`);
      setNewFolderName('');
      setIsCreatingFolder(false);
      fetchFolders();
    } catch (error) {
      message.error('Failed to create folder');
    }
  };

  // Handle file upload
  const uploadProps = {
    name: 'file',
    action: '/upload',
    headers: { authorization: 'Bearer token' },
    data: { directory: 'operation' }, // Ensure files go to the 'operation' directory
    onChange(info) {
      if (info.file.status === 'done') {
        message.success(`${info.file.name} file uploaded successfully`);
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} file upload failed`);
      }
    },
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Operation Dashboard</h2>

      {/* Create Folder Button */}
      <Button
        type="primary"
        icon={<FolderAddOutlined />}
        onClick={() => setIsCreatingFolder(true)}
        style={{ marginBottom: 10 }}
      >
        Create Folder
      </Button>

      {/* Upload File Button */}
      <Upload {...uploadProps}>
        <Button type="primary" icon={<UploadOutlined />} style={{ marginLeft: 10 }}>
          Upload File
        </Button>
      </Upload>

      {/* Folder List */}
      <List
        loading={loading}
        header={<strong>Folders</strong>}
        bordered
        dataSource={folders}
        renderItem={(folder) => (
          <List.Item
            onClick={() => setSelectedFolder(folder.name)}
            style={{ cursor: 'pointer' }}
          >
            <FolderOpenOutlined style={{ marginRight: 10 }} />
            {folder.name}
          </List.Item>
        )}
      />

      {/* Create Folder Modal */}
      <Modal
        title="Create New Folder"
        visible={isCreatingFolder}
        onOk={createFolder}
        onCancel={() => setIsCreatingFolder(false)}
        okText="Create"
      >
        <Input
          placeholder="Enter folder name"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default OperationDashboard;

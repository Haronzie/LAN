import React, { useState, useEffect } from 'react';
import { Layout, Button, Table, Input, Row, Col, Breadcrumb, message } from 'antd';
import { FolderAddOutlined, UploadOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import path from 'path-browserify';

// Import common modals
import { 
  CreateFolderModal, 
  RenameModal, 
  MoveModal, 
  UploadModal, 
  CopyModal, 
  FileInfoModal 
} from '../common/FileModals';

const { Content } = Layout;

const ResearchDashboardExample = () => {
  // State variables
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredItems, setFilteredItems] = useState([]);
  const [directories, setDirectories] = useState([]);
  const [currentUser, setCurrentUser] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Modal state variables
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [renameNewName, setRenameNewName] = useState('');
  
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [moveDestination, setMoveDestination] = useState('');
  
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [copyNewName, setCopyNewName] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');
  
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [selectedFileInfo, setSelectedFileInfo] = useState(null);

  // Initial load
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    const storedRole = localStorage.getItem('role');
    if (storedUsername) setCurrentUser(storedUsername);
    if (storedRole === 'admin') setIsAdmin(true);
    fetchDirectories();
    // eslint-disable-next-line
  }, []);

  // Fetch directories
  const fetchDirectories = async () => {
    try {
      const res = await axios.get('/directory/tree?container=research', { withCredentials: true });
      setDirectories(res.data || []);
    } catch (error) {
      console.error('Error fetching directories:', error);
    }
  };

  // Fetch items (directories + files)
  const fetchItems = async () => {
    setLoading(true);
    try {
      const dirParam = encodeURIComponent(currentPath);
  
      // 1. Fetch folders
      const dirRes = await axios.get(`/directory/list?directory=${dirParam}`, { withCredentials: true });
      const folders = (dirRes.data || []).map((folder) => ({
        id: `folder-${folder.name}`,
        name: folder.name,
        type: 'directory',
        created_by: folder.created_by || '',
      }));
  
      // 2. Fetch files
      const fileRes = await axios.get(`/files?directory=${dirParam}`, { withCredentials: true });
      const files = (fileRes.data || []).map((file) => ({
        id: file.id,
        name: file.name,
        type: 'file',
        size: file.size,
        formattedSize: formatFileSize(file.size),
        uploader: file.uploader,
      }));
  
      setItems([...folders, ...files]);
    } catch (error) {
      console.error('Error fetching items:', error);
      message.error('Failed to load directory contents');
    } finally {
      setLoading(false);
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Filter items based on search term
  useEffect(() => {
    const filtered = items.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredItems(filtered);
  }, [items, searchTerm]);

  // Create folder handler
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      message.error('Folder name cannot be empty');
      return;
    }
    try {
      await axios.post(
        '/directory/create',
        { name: newFolderName, parent: currentPath, container: 'research' },
        { withCredentials: true }
      );
      message.success('Folder created successfully');
      setCreateFolderModal(false);
      setNewFolderName('');
      fetchItems();
      fetchDirectories();
    } catch (error) {
      console.error('Create folder error:', error);
      message.error(error.response?.data?.error || 'Error creating folder');
    }
  };

  // Rename handler
  const handleRenameConfirm = async () => {
    if (!renameNewName.trim()) {
      message.error('New name cannot be empty');
      return;
    }
    try {
      if (selectedItem.type === 'directory') {
        await axios.put(
          '/directory/rename',
          {
            old_name: selectedItem.name,
            new_name: renameNewName,
            parent: currentPath
          },
          { withCredentials: true }
        );
        fetchDirectories();
      } else {
        await axios.put(
          '/file/rename',
          {
            old_filename: selectedItem.name,
            new_filename: renameNewName,
            directory: currentPath
          },
          { withCredentials: true }
        );
      }
      message.success('Item renamed successfully');
      setRenameModalVisible(false);
      setSelectedItem(null);
      fetchItems();
    } catch (error) {
      console.error('Rename error:', error);
      message.error(error.response?.data?.error || 'Error renaming item');
    }
  };

  // Move handler
  const handleMoveConfirm = async () => {
    if (!moveDestination) {
      message.error('Please select a destination folder');
      return;
    }
    try {
      if (selectedItem.type === 'directory') {
        await axios.post(
          '/directory/move',
          {
            name: selectedItem.name,
            old_parent: currentPath,
            new_parent: moveDestination
          },
          { withCredentials: true }
        );
      } else {
        await axios.post(
          '/file/move',
          {
            filename: selectedItem.name,
            old_parent: currentPath,
            new_parent: moveDestination
          },
          { withCredentials: true }
        );
      }
      message.success('Item moved successfully');
      setMoveModalVisible(false);
      setSelectedItem(null);
      fetchItems();
      fetchDirectories();
    } catch (error) {
      console.error('Move error:', error);
      message.error(error.response?.data?.error || 'Error moving item');
    }
  };

  // Copy handler
  const handleCopyConfirm = async () => {
    if (!copyNewName.trim()) {
      message.error('New name cannot be empty');
      return;
    }
    try {
      await axios.post(
        '/file/copy',
        {
          source_filename: selectedItem.name,
          source_directory: currentPath,
          target_filename: copyNewName,
          target_directory: selectedDestination || currentPath
        },
        { withCredentials: true }
      );
      message.success('File copied successfully');
      setCopyModalVisible(false);
      setSelectedItem(null);
      fetchItems();
    } catch (error) {
      console.error('Copy error:', error);
      message.error(error.response?.data?.error || 'Error copying file');
    }
  };

  // Upload handler
  const handleModalUpload = async () => {
    if (uploadingFiles.length === 0) {
      message.error('Please select one or more files first');
      return;
    }
    
    try {
      const formData = new FormData();
      uploadingFiles.forEach(file => {
        formData.append('files', file);
      });
      formData.append('directory', currentPath);
      formData.append('container', 'research');
      
      const res = await axios.post('/upload/multiple', formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const results = res.data || [];
      const uploaded = results.filter(r => r.status === 'uploaded' || r.status === 'overwritten').length;
      const skipped = results.filter(r => r.status === 'skipped').length;
      const failed = results.filter(r => r.status.startsWith('error')).length;
      
      message.success(`${uploaded} uploaded, ${skipped} skipped, ${failed} failed`);
      
      setUploadModalVisible(false);
      setUploadingFiles([]);
      fetchItems();
    } catch (error) {
      console.error('Upload error:', error);
      message.error(error.response?.data?.error || 'Upload failed');
    }
  };

  // Prepare folder options for copy modal
  const folderOptions = items
    .filter(item => item.type === 'directory')
    .map(folder => ({
      label: folder.name,
      value: path.join(currentPath, folder.name)
    }));

  return (
    <Layout style={{ height: '100%' }}>
      <Content style={{ padding: '0 24px', height: '100%' }}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col>
            <Button 
              type="primary" 
              icon={<FolderAddOutlined />} 
              onClick={() => setCreateFolderModal(true)}
            >
              New Folder
            </Button>
          </Col>
          <Col>
            <Button 
              icon={<UploadOutlined />} 
              onClick={() => setUploadModalVisible(true)}
            >
              Upload
            </Button>
          </Col>
          <Col flex="auto">
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search files and folders"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
            />
          </Col>
        </Row>
        
        <Table
          columns={[/* Your table columns here */]}
          dataSource={filteredItems}
          rowKey={(record) => record.id || record.name + record.type}
          loading={loading}
          pagination={false}
        />
        
        {/* Using common modals */}
        <CreateFolderModal
          visible={createFolderModal}
          onCancel={() => setCreateFolderModal(false)}
          onOk={handleCreateFolder}
          folderName={newFolderName}
          setFolderName={setNewFolderName}
        />
        
        <RenameModal
          visible={renameModalVisible}
          onCancel={() => setRenameModalVisible(false)}
          onOk={handleRenameConfirm}
          newName={renameNewName}
          setNewName={setRenameNewName}
        />
        
        <MoveModal
          visible={moveModalVisible}
          onCancel={() => setMoveModalVisible(false)}
          onOk={handleMoveConfirm}
          destination={moveDestination}
          setDestination={setMoveDestination}
          treeData={directories}
        />
        
        <CopyModal
          visible={copyModalVisible}
          onCancel={() => setCopyModalVisible(false)}
          onOk={handleCopyConfirm}
          newName={copyNewName}
          setNewName={setCopyNewName}
          selectedDestination={selectedDestination}
          setSelectedDestination={setSelectedDestination}
          folderOptions={folderOptions}
        />
        
        <UploadModal
          visible={uploadModalVisible}
          onCancel={() => setUploadModalVisible(false)}
          onOk={handleModalUpload}
          files={uploadingFiles}
          setFiles={setUploadingFiles}
          currentPath={currentPath}
        />
        
        <FileInfoModal
          visible={infoModalVisible}
          onCancel={() => setInfoModalVisible(false)}
          fileInfo={selectedFileInfo}
        />
      </Content>
    </Layout>
  );
};

export default ResearchDashboardExample;

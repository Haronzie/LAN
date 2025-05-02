import React, { useState, useEffect } from 'react';
import {
  Layout,
  Table,
  Button,
  message,
  Input,
  Row,
  Col,
  Modal,
  Space,
  Tooltip,
  Form,
  Select,
  Card,
  Breadcrumb,
  Checkbox,
  TreeSelect,
  Spin
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  FolderAddOutlined,
  ArrowUpOutlined,
  EditOutlined,
  CopyOutlined,
  SwapOutlined,
  ArrowLeftOutlined,
  LockOutlined,
  FileOutlined
} from '@ant-design/icons';
import Dragger from 'antd/lib/upload/Dragger';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import path from 'path-browserify';

const { Content } = Layout;
const { Option } = Select;

/**
 * Helper to format file sizes in human-readable form.
 */
function formatFileSize(size) {
  if (size === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(size) / Math.log(1024));
  return (size / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
}

const TrainingDashboard = () => {
  const navigate = useNavigate();

  // ----------------------------------
  // Current user and role states
  // ----------------------------------
  const [currentUser, setCurrentUser] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  // ----------------------------------
  // States: path, items, loading, search, etc.
  // ----------------------------------
  const [currentPath, setCurrentPath] = useState('Training');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Create folder modal
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Rename
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [renameNewName, setRenameNewName] = useState('');

  // Copy
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [copyItem, setCopyItem] = useState(null);
  const [copyNewName, setCopyNewName] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');

  // Move
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [moveItem, setMoveItem] = useState(null);
  const [moveDestination, setMoveDestination] = useState('');

  // Directory tree for moving files/folders
  const [directories, setDirectories] = useState([]);

  // Upload
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);

  // ----------------------------------
  // Initial Load: set user and fetch directories
  // ----------------------------------
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    const storedRole = localStorage.getItem('role');
    if (storedUsername) {
      setCurrentUser(storedUsername);
    }
    if (storedRole === 'admin') {
      setIsAdmin(true);
    }
    fetchDirectories();
    // eslint-disable-next-line
  }, []);

  const fetchDirectories = async () => {
    try {
      const res = await axios.get('/directory/tree?container=training', { withCredentials: true });
      setDirectories(res.data || []);
    } catch (error) {
      console.error('Error fetching directories:', error);
    }
  };

  // ----------------------------------
  // Fetch items (directories + files)
  // ----------------------------------
  const fetchItems = async () => {
    setLoading(true);
    try {
      const dirParam = encodeURIComponent(currentPath);
      // 1) Fetch directories
      const dirRes = await axios.get(`/directory/list?directory=${dirParam}`, { withCredentials: true });
      const fetchedDirs = Array.isArray(dirRes.data) ? dirRes.data : [];
      // 2) Fetch files (including confidential flag and authorized users if available)
      const fileRes = await axios.get(`/files?directory=${dirParam}`, { withCredentials: true });
      const fetchedFiles = (fileRes.data || []).map((f) => ({
        id: f.id,
        name: f.name,
        type: 'file',
        size: f.size,
        formattedSize: formatFileSize(f.size),
        uploader: f.uploader
      }));
      
      setItems([...fetchedDirs, ...fetchedFiles]);
    } catch (error) {
      console.error('Error fetching directory contents:', error);
      message.error(error.response?.data?.error || 'Error fetching directory contents');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line
  }, [currentPath]);

  
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  
 
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      message.error('Folder name cannot be empty');
      return;
    }
    try {
      await axios.post(
        '/directory/create',
        { name: newFolderName, parent: currentPath, container: 'training' },
        { withCredentials: true }
      );
      message.success('Folder created successfully');
      setCreateFolderModal(false);
      setNewFolderName('');
      fetchItems();
    } catch (error) {
      console.error('Create folder error:', error);
      message.error(error.response?.data?.error || 'Error creating folder');
    }
  };

  // ----------------------------------
  // Navigation & Breadcrumb
  // ----------------------------------
  const handleFolderClick = (folderName) => {
    const newPath = path.join(currentPath, folderName);
    if (!newPath.startsWith('Training')) return;
    setCurrentPath(newPath);
  };

  const handleGoUp = () => {
    if (currentPath === 'Training') return;
    const parentPath = path.dirname(currentPath);
    setCurrentPath(parentPath === '.' ? 'Training' : parentPath);
  };

  const getPathSegments = (p) => {
    const parts = p.split('/').filter(Boolean);
    return parts.slice(1); // remove the first 'Training' part
  };

  const segments = getPathSegments(currentPath);
  const breadcrumbItems = [
    <Breadcrumb.Item key="training">
      <a onClick={() => setCurrentPath('Training')}>Training</a>
    </Breadcrumb.Item>
  ];
  segments.forEach((seg, index) => {
    const partialPath = ['Training', ...segments.slice(0, index + 1)].join('/');
    const isLast = index === segments.length - 1;
    breadcrumbItems.push(
      <Breadcrumb.Item key={index}>
        {isLast ? seg : <a onClick={() => setCurrentPath(partialPath)}>{seg}</a>}
      </Breadcrumb.Item>
    );
  });

  // ----------------------------------
  // Upload Modal
  // ----------------------------------
  const handleOpenUploadModal = () => {
    if (!currentPath) {
      message.error('Please select or create a folder before uploading.');
      return;
    }
    setUploadingFiles([]);
    setUploadModalVisible(true);
  };

  const doModalUpload = async () => {
    if (!uploadingFiles) {
      message.error('Please select a file first');
      return;
    }
    if (!currentPath) {
      message.error('Please select or create a folder first');
      return;
    }
    const formData = new FormData();
    formData.append('file', uploadingFiles);
    formData.append('directory', currentPath);
    formData.append('container', 'training');
    try {
      const res = await axios.post('/upload', formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success(res.data.message || 'File uploaded successfully');
      setUploadModalVisible(false);
      setUploadingFiles(null);
      fetchItems();
    } catch (error) {
      console.error('Modal-based upload error:', error);
      message.error(error.response?.data?.error || 'Error uploading file');
    }
  };

  const handleModalUpload = async () => {
    if (uploadingFiles.length === 0) {
      message.error('Please select one or more files first');
      return;
    }
  
    try {
      const formData = new FormData();
      uploadingFiles.forEach(file => formData.append('files', file)); // multiple files
      formData.append('directory', currentPath);
      formData.append('container', 'training');
      formData.append('overwrite', 'false');
      formData.append('skip', 'false');
  
      const res = await axios.post('/bulk-upload', formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
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
      message.error('Upload failed');
    }
  };  

  const handleDelete = async (record) => {
    const isOwner =
      record.type === 'directory'
        ? record.created_by === currentUser
        : record.uploader === currentUser;
    if (!isOwner) {
      message.error('Only the owner can delete this item.');
      return;
    }
    try {
      if (record.type === 'directory') {
        await axios.delete('/directory/delete', {
          data: { name: record.name, parent: currentPath, container: 'training' },
          withCredentials: true
        });
      } else {
        await axios.delete('/delete-file', {
          data: { directory: currentPath, filename: record.name, container: 'training' },
          withCredentials: true
        });
      }
      message.success(`${record.name} deleted successfully`);
      fetchItems();
    } catch (error) {
      console.error('Delete error:', error);
      message.error(error.response?.data?.error || 'Error deleting item');
    }
  };

  // ----------------------------------
  // Download
  // ----------------------------------
  const handleDownload = (fileName) => {
    const downloadUrl = `http://localhost:8080/download?filename=${encodeURIComponent(fileName)}`;
    window.open(downloadUrl, '_blank');
  };

  const handleDownloadFolder = (folderName) => {
    const folderPath = path.join(currentPath, folderName);
    const downloadUrl = `http://localhost:8080/download-folder?directory=${encodeURIComponent(folderPath)}`;
    window.open(downloadUrl, '_blank');
  };

  // ----------------------------------
  // Rename
  // ----------------------------------
  const handleRename = (record) => {
    const isOwner =
      record.type === 'directory'
        ? record.created_by === currentUser
        : record.uploader === currentUser;
    if (!isOwner) {
      message.error('Only the owner can rename this item.');
      return;
    }
    setSelectedItem(record);
    setRenameNewName(record.name);
    setRenameModalVisible(true);
  };

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
            parent: currentPath,
            container: 'training'
          },
          { withCredentials: true }
        );
      } else {
        await axios.put(
          '/file/rename',
          {
            directory: currentPath,
            old_filename: selectedItem.name,
            new_filename: renameNewName,
            container: 'training'
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

  // ----------------------------------
  // Copy
  // ----------------------------------
  const handleCopy = (record) => {
    const suggestedName = record.name + '_copy';
    setCopyItem(record);
    setCopyNewName(suggestedName);
    setCopyModalVisible(true);
  };

  const handleCopyConfirm = async () => {
    if (!copyNewName.trim()) {
      message.error('New name cannot be empty');
      return;
    }
    if (!copyItem) {
      message.error('No item selected to copy');
      return;
    }
    try {
      if (copyItem.type === 'directory') {
        await axios.post(
          '/directory/copy',
          {
            source_name: copyItem.name,
            source_parent: currentPath,
            new_name: copyNewName,
            destination_parent: selectedDestination || currentPath,
            container: 'training'
          },
          { withCredentials: true }
        );
      } else {
        await axios.post(
          '/copy-file',
          {
            source_file: copyItem.name,
            new_file_name: copyNewName,
            destination_folder: selectedDestination || currentPath,
            container: 'training'
          },
          { withCredentials: true }
        );
      }
      message.success(`Copied '${copyItem.name}' to '${copyNewName}' successfully`);
      setCopyModalVisible(false);
      setCopyItem(null);
      setCopyNewName('');
      setSelectedDestination('');
      fetchItems();
    } catch (error) {
      console.error('Copy error:', error);
      message.error(error.response?.data?.error || 'Error copying item');
    }
  };

  // ----------------------------------
  // Move
  // ----------------------------------
  const handleMove = (record) => {
    const isOwner =
      record.type === 'directory'
        ? record.created_by === currentUser
        : record.uploader === currentUser;
    if (!isOwner) {
      message.error('Only the owner can move this item.');
      return;
    }
    setMoveItem(record);
    setMoveDestination(currentPath);
    setMoveModalVisible(true);
  };

  const handleMoveConfirm = async () => {
    if (!moveDestination.trim()) {
      message.error('Please select a destination folder');
      return;
    }
    if (!moveItem) {
      message.error('No item selected to move');
      return;
    }
    try {
      if (moveItem.type === 'directory') {
        await axios.post(
          '/directory/move',
          {
            name: moveItem.name,
            old_parent: currentPath,
            new_parent: moveDestination,
            container: 'training'
          },
          { withCredentials: true }
        );
      } else {
        await axios.post(
          '/file/move',
          {
            filename: moveItem.name,
            old_parent: currentPath,
            new_parent: moveDestination,
            container: 'training'
          },
          { withCredentials: true }
        );
      }
      message.success(`Moved '${moveItem.name}' successfully`);
      setMoveModalVisible(false);
      setMoveItem(null);
      setMoveDestination('');
      fetchItems();
    } catch (error) {
      console.error('Move error:', error);
      message.error(error.response?.data?.error || 'Error moving item');
    }
  };

  // ----------------------------------
  // View File
  // ----------------------------------
  const handleViewFile = (record) => {
    const previewUrl = `http://localhost:8080/preview?directory=${encodeURIComponent(
      currentPath
    )}&filename=${encodeURIComponent(record.name)}`;
    window.open(previewUrl, '_blank');
  };

  // ----------------------------------
  // Table Columns
  // ----------------------------------
  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => {
        if (record.type === 'directory') {
          return (
            <Space>
              <FolderOpenOutlined />
              <a onClick={() => handleFolderClick(name)}>{name}</a>
            </Space>
          );
        }
        return name;
      }
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (type === 'directory' ? 'Folder' : 'File')
    },
    {
      title: 'Size',
      dataIndex: 'formattedSize',
      key: 'size',
      render: (size, record) => (record.type === 'directory' ? '--' : size)
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record) => {
        const isOwner =
          record.type === 'directory'
            ? record.created_by === currentUser
            : record.uploader === currentUser;
        const canManageAccess =
          record.type === 'file' && record.confidential && (isOwner || isAdmin);
        
        return (
          <Space>
            {/* View File (if user has access) */}
            {record.type === 'file' && (
  <Tooltip title="View File">
    <Button icon={<FileOutlined />} onClick={() => handleViewFile(record)} />
  </Tooltip>
)}
            {/* Download (show lock if no access) */}
            {record.type === 'file' && (
  <Tooltip title="Download">
    <Button icon={<DownloadOutlined />} onClick={() => handleDownload(record.name)} />
  </Tooltip>
)}
            {record.type === 'directory' && (
              <Tooltip title="Download Folder">
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownloadFolder(record.name)}
                />
              </Tooltip>
            )}
            {/* Rename (owner only) */}
            {isOwner && (
              <Tooltip title="Rename">
                <Button icon={<EditOutlined />} onClick={() => handleRename(record)} />
              </Tooltip>
            )}
            {/* Copy (allowed for all visible files) */}
            <Tooltip title="Copy">
              <Button icon={<CopyOutlined />} onClick={() => handleCopy(record)} />
            </Tooltip>
            {/* Move (owner only) */}
            {isOwner && (
              <Tooltip title="Move">
                <Button icon={<SwapOutlined />} onClick={() => handleMove(record)} />
              </Tooltip>
            )}
            {/* Delete (owner only) */}
            {isOwner && (
              <Tooltip title={record.type === 'directory' ? 'Delete Folder' : 'Delete File'}>
                <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
              </Tooltip>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <Layout style={{ minHeight: '84vh', background: '#f0f2f5' }}>
      <Content style={{ margin: '5px', padding: '10px', background: '#fff' }}>
        {/* Top Bar */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <h2 style={{ margin: 0 }}></h2>
          </Col>
          <Col>
            <Button type="primary" icon={<UploadOutlined />} onClick={handleOpenUploadModal}>
              Upload File
            </Button>
          </Col>
        </Row>
        {/* Navigation Row */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col>
            <Button icon={<ArrowUpOutlined />} onClick={handleGoUp}>
              Go Up
            </Button>
          </Col>
          <Col>
            <Button icon={<FolderAddOutlined />} onClick={() => setCreateFolderModal(true)}>
              Create Folder
            </Button>
          </Col>
          <Col>
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
            />
          </Col>
        </Row>
        <Breadcrumb style={{ marginBottom: 16 }}>{breadcrumbItems}</Breadcrumb>
        <Table
          columns={columns}
          dataSource={filteredItems}
          rowKey={(record) => record.id || record.name + record.type}
          loading={loading}
          scroll={{ y: '49vh' }}  // for content scrolling on table
          pagination={false}
        />

        {/* Create Folder Modal */}
        <Modal
          title="Create New Folder"
          visible={createFolderModal}
          onOk={handleCreateFolder}
          onCancel={() => setCreateFolderModal(false)}
          okText="Create"
        >
          <Form layout="vertical">
            <Form.Item label="Folder Name" required>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. TrainingData"
              />
            </Form.Item>
          </Form>
        </Modal>

        {/* Rename Modal */}
        <Modal
          title="Rename Item"
          visible={renameModalVisible}
          onOk={handleRenameConfirm}
          onCancel={() => setRenameModalVisible(false)}
          okText="Rename"
        >
          <Form layout="vertical">
            <Form.Item label="New Name" required>
              <Input
                value={renameNewName}
                onChange={(e) => setRenameNewName(e.target.value)}
                placeholder="Enter new name"
              />
            </Form.Item>
          </Form>
        </Modal>

        {/* Copy Modal */}
        <Modal
          title="Copy Item"
          visible={copyModalVisible}
          onOk={handleCopyConfirm}
          onCancel={() => setCopyModalVisible(false)}
          okText="Copy"
        >
          <Form layout="vertical">
            <Form.Item label="New Name" required>
              <Input
                value={copyNewName}
                onChange={(e) => setCopyNewName(e.target.value)}
                placeholder="Enter new name"
              />
            </Form.Item>
            <Form.Item label="Destination Folder (Optional)">
              <Select
                style={{ width: '100%' }}
                placeholder="Select folder or leave blank"
                value={selectedDestination}
                onChange={(val) => setSelectedDestination(val)}
                allowClear
              >
                {items
                  .filter((item) => item.type === 'directory')
                  .map((folder) => {
                    const folderPath = path.join(currentPath, folder.name);
                    return (
                      <Option key={folderPath} value={folderPath}>
                        {folder.name}
                      </Option>
                    );
                  })}
              </Select>
            </Form.Item>
          </Form>
        </Modal>

        {/* Move Modal */}
        <Modal
          title="Move Item"
          visible={moveModalVisible}
          onOk={handleMoveConfirm}
          onCancel={() => setMoveModalVisible(false)}
          okText="Move"
        >
          <Form layout="vertical">
            <Form.Item label="Destination Folder" required>
              <TreeSelect
                style={{ width: '100%' }}
                treeData={directories}
                placeholder="Select destination folder"
                value={moveDestination}
                onChange={(val) => setMoveDestination(val)}
                treeDefaultExpandAll
                allowClear
              />
            </Form.Item>
          </Form>
        </Modal>

        {/* Upload Modal */}
        <Modal
        title="Upload File(s)"
        visible={uploadModalVisible}
        onOk={handleModalUpload}
        onCancel={() => {
          setUploadModalVisible(false);
          setUploadingFiles([]);
        }}
        okText="Upload"
        okButtonProps={{ disabled: uploadingFiles.length === 0 }}
      >
        <p>Target Folder: {currentPath || '(none)'}</p>
        <Form layout="vertical">
          <Form.Item>
            <Dragger
              multiple
              fileList={uploadingFiles}
              beforeUpload={(file, fileList) => {
                setUploadingFiles(fileList);
                return false; // don't upload automatically
              }}
              showUploadList={{ showRemoveIcon: true, showPreviewIcon: false }}
              onRemove={(file) => {
                setUploadingFiles(prev => prev.filter(f => f.uid !== file.uid));
              }}
              customRequest={({ onSuccess }) => {
                setTimeout(() => {
                  onSuccess("ok");
                }, 0);
              }}
              style={{ padding: '12px 0' }}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">Click or drag files here to upload</p>
              <p className="ant-upload-hint">Supports multiple files</p>
            </Dragger>
          </Form.Item>
        </Form>
      </Modal>
      </Content>
    </Layout>
  );
};

export default TrainingDashboard;

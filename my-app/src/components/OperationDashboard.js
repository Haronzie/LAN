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
  Badge,
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
  FileOutlined,
  FileTextOutlined,
  FolderOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import path from 'path-browserify';

const { Content } = Layout;
const { Option } = Select;

function formatFileSize(size) {
  if (size === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(size) / Math.log(1024));
  return (size / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
}

const OperationDashboard = () => {
  const [currentPath, setCurrentPath] = useState('Operation');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [renameNewName, setRenameNewName] = useState('');
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [copyItem, setCopyItem] = useState(null);
  const [copyNewName, setCopyNewName] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [moveItem, setMoveItem] = useState(null);
  const [moveDestination, setMoveDestination] = useState('');
  const [currentUser, setCurrentUser] = useState('');
  const [directories, setDirectories] = useState([]);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [fileMessages, setFileMessages] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const [allFilesWithMessages, setAllFilesWithMessages] = useState([]);

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    const storedRole = localStorage.getItem('role');
    if (storedUsername) setCurrentUser(storedUsername);
    if (storedRole === 'admin') setIsAdmin(true);
    fetchDirectories();
    fetchAllFilesWithMessages();
  }, []);

  const fetchDirectories = async () => {
    try {
      const res = await axios.get('/directory/tree', { withCredentials: true });
      setDirectories(res.data || []);
    } catch (error) {
      console.error('Error fetching directories:', error);
    }
  };

  const fetchAllFilesWithMessages = async () => {
    try {
      const res = await axios.get(`/files?directory=${encodeURIComponent(currentPath)}`, { withCredentials: true });
      const files = res.data || [];
      setAllFilesWithMessages([]);
  
      const result = [];
  
      for (const file of files) {
        try {
          const msgRes = await axios.get(`/file/messages?file_id=${file.id}`, { withCredentials: true });
          if (msgRes.data?.length) {
            result.push({
              id: file.id,
              name: file.name,
              directory: file.directory,
              messages: msgRes.data
            });
          }
        } catch (err) {
          console.warn(`Skipped file ID ${file.id}: not authorized or no messages`);
        }
      }
  
      setAllFilesWithMessages(result);
    } catch (error) {
      console.error('Error fetching file list:', error);
      message.error('Failed to load files with instructions');
    }
  };
  

  const markAsDone = async (messageId, fileId) => {
    try {
      await axios.patch(
        `/file/message/${messageId}/done`,
        {},
        { withCredentials: true }
      );
      message.success('Marked as done');
      
      // Refresh both the all files view and individual messages
      await Promise.all([
        fetchAllFilesWithMessages(),
        fetchItems()
      ]);
    } catch (err) {
      console.error('Error marking message as done:', err);
      message.error('Failed to mark as done');
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const dirParam = encodeURIComponent(currentPath);
      const [dirRes, fileRes] = await Promise.all([
        axios.get(`/directory/list?directory=${dirParam}`, { withCredentials: true }),
        axios.get(`/files?directory=${dirParam}`, { withCredentials: true })
      ]);
      
      const fetchedDirs = Array.isArray(dirRes.data) ? dirRes.data : [];
      const fetchedFiles = (fileRes.data || []).map(f => ({
        id: f.id,
        name: f.name,
        type: 'file',
        size: f.size,
        formattedSize: formatFileSize(f.size),
        uploader: f.uploader,
        directory: f.directory
      }));

      setItems([...fetchedDirs, ...fetchedFiles]);
      
      // Fetch messages for these files
      const newMessageMap = {};
      for (const file of fetchedFiles) {
        try {
          const res = await axios.get(`/file/messages?file_id=${file.id}`, {
            withCredentials: true,
          });
          if (res.data?.length) {
            newMessageMap[file.id] = res.data;
          }
        } catch (error) {
          console.error(`Failed to fetch messages for file ID ${file.id}:`, error);
        }
      }
      setFileMessages(newMessageMap);
    } catch (error) {
      console.error('Error fetching items:', error);
      message.error(error.response?.data?.error || 'Error fetching directory contents');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [currentPath]);

  const filteredItems = items.filter(item =>
    (item.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFolderClick = (folderName) => {
    const newPath = path.join(currentPath, folderName);
    if (!newPath.startsWith('Operation')) return;
    setCurrentPath(newPath);
  };

  const handleGoUp = () => {
    if (!currentPath || currentPath === 'Operation') return;
    const parent = path.dirname(currentPath);
    setCurrentPath(parent === '.' ? '' : parent);
  };

  const getPathSegments = (p) => p.split('/').filter(Boolean).slice(1);
  const segments = getPathSegments(currentPath);
  
  const breadcrumbItems = [
    <Breadcrumb.Item key="operation">
      <a onClick={() => setCurrentPath('Operation')}>Operation</a>
    </Breadcrumb.Item>,
    ...segments.map((seg, index) => {
      const partialPath = ['Operation', ...segments.slice(0, index + 1)].join('/');
      const isLast = index === segments.length - 1;
      return (
        <Breadcrumb.Item key={index}>
          {isLast ? seg : <a onClick={() => setCurrentPath(partialPath)}>{seg}</a>}
        </Breadcrumb.Item>
      );
    })
  ];

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      message.error('Folder name cannot be empty');
      return;
    }
    try {
      await axios.post('/directory/create', {
        name: newFolderName,
        parent: currentPath,
        container: 'operation'
      }, { withCredentials: true });
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

  const handleOpenUploadModal = () => {
    if (!currentPath) {
      message.error('Please select or create a folder before uploading.');
      return;
    }
    setUploadingFiles([]);
    setUploadModalVisible(true);
  };

  const handleModalUpload = async () => {
    if (uploadingFiles.length === 0) {
      message.error('Please select one or more files first');
      return;
    }
  
    try {
      if (uploadingFiles.length === 1) {
        // Single file → use /upload
        const formData = new FormData();
        formData.append('file', uploadingFiles[0]);
        formData.append('directory', currentPath);
        formData.append('container', 'operation');
  
        await axios.post('/upload', formData, {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' },
        });
  
        message.success('File uploaded successfully');
      } else {
        // Multiple files → use /bulk-upload
        const formData = new FormData();
        uploadingFiles.forEach((file) => formData.append('files', file));
        formData.append('directory', currentPath);
        formData.append('container', 'operation');
        formData.append('overwrite', 'false'); // or 'true' or based on user choice
        formData.append('skip', 'false');      // or 'true' or based on user choice
  
        const res = await axios.post('/bulk-upload', formData, {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        
        
  
        const results = res.data || [];
        const uploaded = results.filter(r => r.status === 'uploaded' || r.status === 'overwritten').length;
        const skipped = results.filter(r => r.status === 'skipped').length;
        const failed = results.filter(r => r.status.startsWith('error')).length;
  
        message.success(`${uploaded} uploaded, ${skipped} skipped, ${failed} failed`);
      }
  
      setUploadModalVisible(false);
      setUploadingFiles([]);
      fetchItems();
      fetchAllFilesWithMessages();
    } catch (error) {
      console.error('Upload error:', error);
      message.error('Upload failed');
    }
  };
  

  const handleDelete = async (record) => {
    const isOwner = record.type === 'directory' 
      ? record.created_by === currentUser 
      : record.uploader === currentUser;
    if (!isOwner) {
      message.error('Only the owner can delete this item.');
      return;
    }
    try {
      if (record.type === 'directory') {
        await axios.delete('/directory/delete', {
          data: { name: record.name, parent: currentPath, container: 'operation' },
          withCredentials: true,
        });
      } else {
        await axios.delete('/delete-file', {
          data: { directory: currentPath, filename: record.name, container: 'operation' },
          withCredentials: true,
        });
      }
      message.success(`${record.name} deleted successfully`);
      fetchItems();
      fetchAllFilesWithMessages();
    } catch (error) {
      console.error('Delete error:', error);
      message.error(error.response?.data?.error || 'Error deleting item');
    }
  };

  const handleDownload = (fileName) => {
    const downloadUrl = `http://localhost:8080/download?directory=${encodeURIComponent(currentPath)}&filename=${encodeURIComponent(fileName)}`;
    window.open(downloadUrl, '_blank');
  };

  const handleDownloadFolder = (folderName) => {
    const folderPath = path.join(currentPath, folderName);
    const downloadUrl = `http://localhost:8080/download-folder?directory=${encodeURIComponent(folderPath)}`;
    window.open(downloadUrl, '_blank');
  };

  const handleViewFile = (file) => {
    const previewUrl = `http://localhost:8080/preview?directory=${encodeURIComponent(currentPath)}&filename=${encodeURIComponent(file.name)}`;
    window.open(previewUrl, '_blank');
  };

  const handleRename = (record) => {
    const isOwner = record.type === 'directory' 
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
            container: 'operation',
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
            container: 'operation',
          },
          { withCredentials: true }
        );
      }
      message.success('Item renamed successfully');
      setRenameModalVisible(false);
      setSelectedItem(null);
      fetchItems();
      fetchAllFilesWithMessages();
    } catch (error) {
      console.error('Rename error:', error);
      message.error(error.response?.data?.error || 'Error renaming item');
    }
  };

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
            container: 'operation',
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
            container: 'operation',
          },
          { withCredentials: true }
        );
      }
      message.success(`Copied '${copyItem.name}' to '${copyNewName}' successfully`);
      setCopyModalVisible(false);
      setCopyNewName('');
      setCopyItem(null);
      setSelectedDestination('');
      fetchItems();
    } catch (error) {
      console.error('Copy error:', error);
      message.error(error.response?.data?.error || 'Error copying item');
    }
  };

  const handleMove = (record) => {
    const isOwner = record.type === 'directory' 
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
            container: 'operation',
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
            container: 'operation',
          },
          { withCredentials: true }
        );
      }
      message.success(`Moved '${moveItem.name}' successfully`);
      setMoveModalVisible(false);
      setMoveDestination('');
      setMoveItem(null);
      fetchItems();
      fetchAllFilesWithMessages();
    } catch (error) {
      console.error('Move error:', error);
      message.error(error.response?.data?.error || 'Error moving item');
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          {record.type === 'directory' ? <FolderOutlined /> : <FileTextOutlined />}
          {record.type === 'directory' ? (
            <a onClick={() => handleFolderClick(name)}>{name}</a>
          ) : (
            <span>{name}</span>
          )}
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: type => type === 'directory' ? 'Folder' : 'File'
    },
    {
      title: 'Size',
      dataIndex: 'formattedSize',
      key: 'size',
      render: (size, record) => record.type === 'directory' ? '--' : size
    },
    {
      title: 'Uploader/Owner',
      key: 'owner',
      render: (record) => record.type === 'directory' ? record.created_by || 'N/A' : record.uploader || 'N/A'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record) => {
        const isOwner = record.type === 'directory' 
          ? record.created_by === currentUser 
          : record.uploader === currentUser;
        
        return (
          <Space>
            {record.type === 'file' && (
              <Tooltip title="View File">
                <Button icon={<FileOutlined />} onClick={() => handleViewFile(record)} />
              </Tooltip>
            )}
            <Tooltip title={record.type === 'directory' ? 'Download Folder' : 'Download File'}>
              <Button icon={<DownloadOutlined />} onClick={() => record.type === 'directory' 
                ? handleDownloadFolder(record.name)
                : handleDownload(record.name)} 
              />
            </Tooltip>
            {isOwner && (
              <Tooltip title="Rename">
                <Button icon={<EditOutlined />} onClick={() => handleRename(record)} />
              </Tooltip>
            )}
            <Tooltip title="Copy">
              <Button icon={<CopyOutlined />} onClick={() => handleCopy(record)} />
            </Tooltip>
            {isOwner && (
              <Tooltip title="Move">
                <Button icon={<SwapOutlined />} onClick={() => handleMove(record)} />
              </Tooltip>
            )}
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
        {/* File Instructions Section */}
        <div style={{ marginBottom: 24 }}>
          <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
            <Col><h3 style={{ margin: 0 }}>📬 File Instructions</h3></Col>
            <Col>
              <Space>
                <Checkbox checked={hideDone} onChange={(e) => setHideDone(e.target.checked)}>
                  Hide Completed
                </Checkbox>
                <Button
                  type="dashed"
                  icon={<DownloadOutlined />}
                  size="small"
                  onClick={fetchAllFilesWithMessages}
                >
                  Refresh
                </Button>
              </Space>
            </Col>
          </Row>

          {allFilesWithMessages.map(file => {
            const filteredMessages = hideDone
              ? file.messages.filter(msg => !msg.is_done)
              : file.messages;

            if (filteredMessages.length === 0) return null;

            return (
              <Card
                key={file.id}
                type="inner"
                size="small"
                title={
                  <Space>
                    <span style={{ fontWeight: 500 }}>🗂 File: {file.name}</span>
                    <Badge count={filteredMessages.length} />
                  </Space>
                }
                extra={<Button type="link" size="small" onClick={() => setCurrentPath(file.directory)}>
                  Go to Folder
                </Button>}
                style={{ marginBottom: 12, borderRadius: 8, background: '#fafafa' }}
              >
                {filteredMessages.map(msg => {
                  const isNew = !msg.is_done && !msg.seenAt;
                  const bgColor = msg.is_done ? '#f6ffed' : isNew ? '#e6f7ff' : '#fffbe6';
                  const borderColor = msg.is_done ? '#b7eb8f' : isNew ? '#91d5ff' : '#ffe58f';
                  const statusText = msg.is_done ? '✅ Done' : isNew ? '🟦 New' : '🟨 Pending';
                  const statusColor = msg.is_done ? 'green' : isNew ? '#1890ff' : '#faad14';

                  return (
                    <div
                      key={msg.id}
                      style={{
                        background: bgColor,
                        borderLeft: `4px solid ${borderColor}`,
                        padding: '10px 12px',
                        marginBottom: 10,
                        borderRadius: 4,
                      }}
                    >
                      <div style={{ fontSize: 13, marginBottom: 4 }}>
                        <strong>📝:</strong> <span style={{ fontStyle: 'italic' }}>{msg.message}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#555' }}>
                        👤 {msg.admin_name || 'N/A'} · 🕓 {new Date(msg.created_at).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        <strong>Status:</strong>{' '}
                        <span style={{ color: statusColor, fontWeight: 500 }}>{statusText}</span>
                      </div>
                      {!msg.is_done && (
                        <Button
                          type="primary"
                          size="small"
                          style={{ marginTop: 6 }}
                          onClick={() => markAsDone(msg.id, file.id)}
                        >
                          Mark as Done
                        </Button>
                      )}
                    </div>
                  );
                })}
              </Card>
            );
          })}
        </div>

        {/* Dashboard UI */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <h2 style={{ margin: 0 }}>Operation Dashboard</h2>
          </Col>
          <Col>
            <Button type="primary" icon={<UploadOutlined />} onClick={handleOpenUploadModal}>
              Upload File(s)
            </Button>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col>
            <Button icon={<ArrowUpOutlined />} onClick={handleGoUp} disabled={!currentPath}>
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
          rowKey={(record) => (record.id ? record.id : record.name + record.type)}
          loading={loading}
          pagination={{ pageSize: 10 }}
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
                placeholder="e.g. Drills"
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
                placeholder="Select a folder or leave blank"
                value={selectedDestination}
                onChange={(val) => setSelectedDestination(val)}
              >
                {filteredItems
                  .filter((item) => item.type === 'directory')
                  .map((folder) => {
                    const folderPath = path.join(currentPath, folder.name);
                    return (
                      <Select.Option key={folderPath} value={folderPath}>
                        {folder.name}
                      </Select.Option>
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
        >
          <p>Target Folder: {currentPath || '(none)'}</p>
          <Form layout="vertical">
            <Form.Item>
              <Button
                icon={<UploadOutlined />}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.onchange = (e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) {
                      setUploadingFiles(files);
                    }
                  };
                  input.click();
                }}
              >
                Select File(s)
              </Button>
            </Form.Item>

            {uploadingFiles.length > 0 && (
              <Card size="small" style={{ marginTop: 16 }}>
                <strong>Selected Files:</strong>
                <ul style={{ marginTop: 8 }}>
                  {uploadingFiles.map((file, idx) => (
                    <li key={idx}>{file.name}</li>
                  ))}
                </ul>
              </Card>
            )}
          </Form>
        </Modal>
      </Content>
    </Layout>
  );
};

export default OperationDashboard;
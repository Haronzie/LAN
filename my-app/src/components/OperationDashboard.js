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
  Upload,
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
import Dragger from 'antd/lib/upload/Dragger';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import path from 'path-browserify';
import { MoreOutlined } from '@ant-design/icons';
import CommonModals from './common/CommonModals';

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
  const [ws, setWs] = useState(null);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [selectedFileInfo, setSelectedFileInfo] = useState(null);

  useEffect(() => {
    const username = localStorage.getItem('username');
    if (!username) return;
    setCurrentUser(username);
    const wsInstance = new WebSocket(`ws://localhost:8080/ws?username=${username}`);
    setWs(wsInstance);

    wsInstance.onopen = () => {
      console.log('✅ WebSocket connected');
    };

    wsInstance.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('📬 Message:', data);

      if (data.event === 'new_instruction' && data.receiver === username) {
        message.open({
          type: 'info',
          content: `📬 New instruction for you: "${data.message}"`,
          duration: 0, // 0 = persist until manually closed
          key: `instruction-${data.file_id}`, // key prevents stacking if same file gets multiple instructions
          btn: (
            <Button
              type="primary"
              size="small"
              onClick={() => {
                setCurrentPath(data.file_path); // if you're sending path in WS
                message.destroy(`instruction-${data.file_id}`);
              }}
            >
              View Now
            </Button>
          ),
        });

        fetchItems();
        fetchAllFilesWithMessages();
      }

      if (data.event === 'file_uploaded' && data.file_name) {
        message.success(`📁 New file uploaded: ${data.file_name}`);
        fetchItems();
        fetchAllFilesWithMessages();
      }
    };


    wsInstance.onerror = (e) => {
      console.error('❌ WebSocket error', e);
    };

    wsInstance.onclose = () => {
      console.warn('⚠️ WebSocket closed');
    };

    return () => wsInstance.close();
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

      // 3. Combine and sort: folders first, then files, both alphabetically
      const combined = [...folders, ...files];
      const sortedItems = combined.sort((a, b) => {
        // Folders first
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        // Then alphabetical
        return a.name.localeCompare(b.name);
      });

      // 4. Set the sorted items
      setItems(sortedItems);
    } catch (error) {
      console.error('Error loading items:', error);
      message.error('Failed to fetch files or folders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [currentPath]);

  // First filter items based on search term
  const filteredItems = items.filter(item =>
    (item.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Then sort: directories first (in ascending order), then files (in ascending order)
  const sortedItems = [...filteredItems].sort((a, b) => {
    // If types are different (directory vs file)
    if (a.type !== b.type) {
      // Directories come before files
      return a.type === 'directory' ? -1 : 1;
    }
    // If types are the same, sort alphabetically by name
    return a.name.localeCompare(b.name);
  });

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

    const normalizedPath = currentPath.replace(/\\/g, '/').toLowerCase();
    console.log("Uploading to directory:", normalizedPath); // for debugging

    try {
      if (uploadingFiles.length === 1) {
        const formData = new FormData();
        formData.append('file', uploadingFiles[0]);
        formData.append('directory', normalizedPath);
        formData.append('container', 'operation');

        await axios.post('/upload', formData, {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        message.success('File uploaded successfully');
      } else {
        const formData = new FormData();
        uploadingFiles.forEach((file) => formData.append('files', file));
        formData.append('directory', normalizedPath);
        formData.append('container', 'operation');
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
      }

      setUploadModalVisible(false);
      setUploadingFiles([]);
      fetchItems(); // refresh the view
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
    const downloadUrl = `/download?directory=${encodeURIComponent(currentPath)}&filename=${encodeURIComponent(fileName)}`;
    window.open(downloadUrl, '_blank');
  };

  const handleDownloadFolder = (folderName) => {
    const folderPath = path.join(currentPath, folderName);
    const downloadUrl = `/download-folder?directory=${encodeURIComponent(folderPath)}`;
    window.open(downloadUrl, '_blank');
  };

  const handleViewFile = (file) => {
    const previewUrl = `/preview?directory=${encodeURIComponent(currentPath)}&filename=${encodeURIComponent(file.name)}`;
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
    // condition in naming the copied file
    let baseName = record.name;
    let extension = '';
    const dotIndex = record.name.lastIndexOf('.');
    if (dotIndex !== -1) {
      baseName = record.name.substring(0, dotIndex);
      extension = record.name.substring(dotIndex);
    }

    let suggestedName = record.name;
    const destination = selectedDestination || currentPath;
    const existingNames = items
      .filter(item => item.parent === destination)
      .map(item => item.name);

    if (existingNames.includes(record.name)) {
      let counter = 1;
      let newName;
      do {
        newName = `${baseName}(${counter})${extension}`;
        counter++;
      } while (existingNames.includes(newName));
      suggestedName = newName;
    }
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

      // Removed sorting from column as we're handling it in sortedItems

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
            <Tooltip title="More Info">
            <Button
              icon={<MoreOutlined />}
              onClick={() => {
                setSelectedFileInfo(record);
                setInfoModalVisible(true);
              }}
            />
          </Tooltip>
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
            <h2 style={{ margin: 0 }}></h2>
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
          dataSource={sortedItems}
          rowKey={(record) => (record.id ? record.id : record.name + record.type)}
          loading={loading}
          pagination={false}
          scroll={{ y: '49vh' }}  // for content scrolling on table
        />
        <Modal
          title="File Information"
          visible={infoModalVisible}
          onCancel={() => setInfoModalVisible(false)}
          footer={null}
        >
          {selectedFileInfo ? (
            <div>
              <p><strong>Name:</strong> {selectedFileInfo.name}</p>
              <p><strong>Type:</strong> {selectedFileInfo.type}</p>
              <p><strong>Size:</strong> {selectedFileInfo.formattedSize}</p>
              <p><strong>Uploader:</strong> {selectedFileInfo.uploader || 'N/A'}</p>
              <p><strong>Uploaded On:</strong> {selectedFileInfo.created_at ? new Date(selectedFileInfo.created_at).toLocaleString() : 'N/A'}</p>
              <p><strong>Directory:</strong> {selectedFileInfo.directory}</p>
            </div>
          ) : (
            <p>No file selected</p>
          )}
        </Modal>





        {/* Use the CommonModals component */}
        <CommonModals
          // Create Folder Modal props
          createFolderModal={createFolderModal}
          setCreateFolderModal={setCreateFolderModal}
          newFolderName={newFolderName}
          setNewFolderName={setNewFolderName}
          handleCreateFolder={handleCreateFolder}

          // Rename Modal props
          renameModalVisible={renameModalVisible}
          setRenameModalVisible={setRenameModalVisible}
          renameNewName={renameNewName}
          setRenameNewName={setRenameNewName}
          handleRenameConfirm={handleRenameConfirm}

          // Copy Modal props
          copyModalVisible={copyModalVisible}
          setCopyModalVisible={setCopyModalVisible}
          copyNewName={copyNewName}
          setCopyNewName={setCopyNewName}
          selectedDestination={selectedDestination}
          setSelectedDestination={setSelectedDestination}
          handleCopyConfirm={handleCopyConfirm}
          directoryItems={filteredItems}
          currentPath={currentPath}

          // Move Modal props
          moveModalVisible={moveModalVisible}
          setMoveModalVisible={setMoveModalVisible}
          moveDestination={moveDestination}
          setMoveDestination={setMoveDestination}
          handleMoveConfirm={handleMoveConfirm}
          directories={directories}

          // Upload Modal props
          uploadModalVisible={uploadModalVisible}
          setUploadModalVisible={setUploadModalVisible}
          uploadingFiles={uploadingFiles}
          setUploadingFiles={setUploadingFiles}
          handleModalUpload={handleModalUpload}
          container="operation"
        />
      </Content>
    </Layout>
  );
};

export default OperationDashboard;
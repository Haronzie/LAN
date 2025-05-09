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
  TreeSelect
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
  FileOutlined
} from '@ant-design/icons';
import Dragger from 'antd/lib/upload/Dragger';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import path from 'path-browserify';
// Import common modals
import {
  CreateFolderModal,
  RenameModal,
  MoveModal,
  UploadModal,
  CopyModal
} from './common/FileModals';

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

const ResearchDashboard = () => {
  const navigate = useNavigate();

  // ----------------------------------
  // State Hooks
  // ----------------------------------
  const [currentUser, setCurrentUser] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPath, setCurrentPath] = useState('Research');
  const [items, setItems] = useState([]);
  const [directories, setDirectories] = useState([]);
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
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);


  // ----------------------------------
  // Initial Load: set user and fetch directories
  // ----------------------------------
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    const storedRole = localStorage.getItem('role');
    if (storedUsername) setCurrentUser(storedUsername);
    if (storedRole === 'admin') setIsAdmin(true);
    fetchDirectories();
    // eslint-disable-next-line
  }, []);

  const fetchDirectories = async () => {
    try {
      const res = await axios.get('/directory/tree?container=research', { withCredentials: true });
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

      // 3. Merge and sort
      const sortedItems = [...folders, ...files].sort((a, b) => a.name.localeCompare(b.name));
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
    // eslint-disable-next-line
  }, [currentPath]);

  // Filter items by search term
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ----------------------------------
  // Navigation & Breadcrumb
  // ----------------------------------
  const handleFolderClick = (folderName) => {
    const newPath = path.join(currentPath, folderName);
    if (!newPath.startsWith('Research')) return;
    setCurrentPath(newPath);
  };

  const handleGoUp = () => {
    if (currentPath === 'Research') return;
    const parentPath = path.dirname(currentPath);
    setCurrentPath(parentPath === '.' ? 'Research' : parentPath);
  };

  const getPathSegments = (p) => {
    const parts = p.split('/').filter(Boolean);
    return parts.slice(1); // remove the first 'Research' part
  };

  const segments = getPathSegments(currentPath);
  const breadcrumbItems = [
    <Breadcrumb.Item key="research">
      <a onClick={() => setCurrentPath('Research')}>Research</a>
    </Breadcrumb.Item>
  ];
  segments.forEach((seg, index) => {
    const partialPath = ['Research', ...segments.slice(0, index + 1)].join('/');
    const isLast = index === segments.length - 1;
    breadcrumbItems.push(
      <Breadcrumb.Item key={index}>
        {isLast ? seg : <a onClick={() => setCurrentPath(partialPath)}>{seg}</a>}
      </Breadcrumb.Item>
    );
  });

  // ----------------------------------
  // Create Folder
  // ----------------------------------
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
    } catch (error) {
      console.error('Create folder error:', error);
      message.error(error.response?.data?.error || 'Error creating folder');
    }
  };

  // ----------------------------------
  // Upload Modal
  // ----------------------------------
  const handleModalUpload = async () => {
    if (uploadingFiles.length === 0) {
      message.error('Please select one or more files first');
      return;
    }

    const normalizedPath = currentPath.replace(/\\/g, '/').toLowerCase();

    try {
      if (uploadingFiles.length === 1) {
        const formData = new FormData();
        formData.append('file', uploadingFiles[0]);
        formData.append('directory', normalizedPath);
        formData.append('container', 'research');

        await axios.post('/upload', formData, {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        message.success('File uploaded successfully');
      } else {
        const formData = new FormData();
        uploadingFiles.forEach(file => formData.append('files', file));
        formData.append('directory', normalizedPath);
        formData.append('container', 'research');
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
      fetchItems(); // refresh file list
    } catch (error) {
      console.error('Upload error:', error);
      message.error(error.response?.data?.error || 'Upload failed');
    }
  };


  const handleOpenUploadModal = () => {
    if (!currentPath) {
      message.error("Please select or create a folder first.");
      return;
    }
    setUploadingFiles([]);
    setUploadModalVisible(true);
  };


  // ----------------------------------
  // Delete
  // ----------------------------------
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
          data: { name: record.name, parent: currentPath, container: 'research' },
          withCredentials: true
        });
      } else {
        await axios.delete('/delete-file', {
          data: { directory: currentPath, filename: record.name, container: 'research' },
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
            container: 'research'
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
            container: 'research'
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
            container: 'research'
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
            container: 'research'
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
            container: 'research'
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
            container: 'research'
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
  // Table columns
  // ----------------------------------
  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',

      // sort in ascending order
      sorter: (a, b) => a.name.localeCompare(b.name),
      defaultSortOrder: 'ascend',
      sortDirections: [],

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
        return (
          <Space>
            {record.type === 'file' && (
              <Tooltip title="View File">
                <Button icon={<FileOutlined />} onClick={() => handleViewFile(record)} />
              </Tooltip>
            )}
            {record.type === 'file' && (
              <Tooltip title="Download">
                <Button icon={<DownloadOutlined />} onClick={() => handleDownload(record.name)} />
              </Tooltip>
            )}
            {record.type === 'directory' && (
              <Tooltip title="Download Folder">
                <Button icon={<DownloadOutlined />} onClick={() => handleDownloadFolder(record.name)} />
              </Tooltip>
            )}
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

  // ----------------------------------
  // Download Helpers (open in new tab)
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
          pagination={false}
          scroll={{ y: '49vh' }}  // for content scrolling on table
        />

        {/* Create Folder Modal */}
        <CreateFolderModal
          visible={createFolderModal}
          onCancel={() => setCreateFolderModal(false)}
          onOk={handleCreateFolder}
          folderName={newFolderName}
          setFolderName={setNewFolderName}
        />

        {/* Rename Modal */}
        <RenameModal
          visible={renameModalVisible}
          onCancel={() => setRenameModalVisible(false)}
          onOk={handleRenameConfirm}
          newName={renameNewName}
          setNewName={setRenameNewName}
        />

        {/* Copy Modal */}
        <CopyModal
          visible={copyModalVisible}
          onCancel={() => setCopyModalVisible(false)}
          onOk={handleCopyConfirm}
          newName={copyNewName}
          setNewName={setCopyNewName}
          selectedDestination={selectedDestination}
          setSelectedDestination={setSelectedDestination}
          folderOptions={items
            .filter((item) => item.type === 'directory')
            .map((folder) => ({
              label: folder.name,
              value: path.join(currentPath, folder.name)
            }))}
        />

        {/* Move Modal */}
        <MoveModal
          visible={moveModalVisible}
          onCancel={() => setMoveModalVisible(false)}
          onOk={handleMoveConfirm}
          destination={moveDestination}
          setDestination={setMoveDestination}
          treeData={directories}
        />

        {/* Upload Modal */}
        <UploadModal
          visible={uploadModalVisible}
          onCancel={() => {
            setUploadModalVisible(false);
            setUploadingFiles([]);
          }}
          onOk={handleModalUpload}
          files={uploadingFiles}
          setFiles={setUploadingFiles}
          currentPath={currentPath}
        />
      </Content>
    </Layout>
  );
};

export default ResearchDashboard;

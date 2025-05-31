import { useState } from 'react';
import axios from 'axios';
import { message } from 'antd';
import path from 'path-browserify';

/**
 * Custom hook to manage common modal functionality across dashboard components
 */

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

const useCommonModals = (container, fetchItems, fetchDirectories) => {
  // Create Folder Modal state
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Rename Modal state
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [renameNewName, setRenameNewName] = useState('');

  // Copy Modal state
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [copyItem, setCopyItem] = useState(null);
  const [copyNewName, setCopyNewName] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');

  // Move Modal state
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [moveItem, setMoveItem] = useState(null);
  const [moveDestination, setMoveDestination] = useState('');
  const [selectedMainFolder, setSelectedMainFolder] = useState('');
  const [selectedSubFolder, setSelectedSubFolder] = useState('');
  const [subFolders, setSubFolders] = useState([]);

  // Upload Modal state
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);

  // Create Folder handler
  const handleCreateFolder = async (currentPath) => {
    if (!newFolderName.trim()) {
      message.error('Folder name cannot be empty');
      return;
    }
    try {
      await axios.post(
        `${BASE_URL}/directory/create`,
        { name: newFolderName, parent: currentPath, container },
        { withCredentials: true }
      );
      message.success('Folder created successfully');
      setCreateFolderModal(false);
      setNewFolderName('');
      fetchItems();
      if (fetchDirectories) fetchDirectories();
    } catch (error) {
      console.error('Create folder error:', error);
      message.error(error.response?.data?.error || 'Error creating folder');
    }
  };

  // Rename handler
  const handleRename = (record) => {
    setSelectedItem(record);
    setRenameNewName(record.name);
    setRenameModalVisible(true);
  };

  const handleRenameConfirm = async (currentPath) => {
    if (!renameNewName.trim()) {
      message.error('New name cannot be empty');
      return;
    }
    try {
      if (selectedItem.type === 'directory') {
        await axios.put(
          `${BASE_URL}/directory/rename`,
          {
            old_name: selectedItem.name,
            new_name: renameNewName,
            parent: currentPath,
            container
          },
          { withCredentials: true }
        );
      } else {
        await axios.put(
          `${BASE_URL}/file/rename`,
          {
            directory: currentPath,
            old_filename: selectedItem.name,
            new_filename: renameNewName,
            container
          },
          { withCredentials: true }
        );
      }
      message.success('Item renamed successfully');
      setRenameModalVisible(false);
      setSelectedItem(null);
      fetchItems();
      if (fetchDirectories) fetchDirectories();
    } catch (error) {
      console.error('Rename error:', error);
      message.error(error.response?.data?.error || 'Error renaming item');
    }
  };

  // Copy handler
  const handleCopy = (record) => {
    let baseName = record.name;
    let extension = '';
    const dotIndex = record.name.lastIndexOf('.');
    if (dotIndex !== -1) {
      baseName = record.name.substring(0, dotIndex);
      extension = record.name.substring(dotIndex);
    }
    setCopyItem(record);
    setCopyNewName(`${baseName}_copy${extension}`);
    setCopyModalVisible(true);
  };

  const handleCopyConfirm = async (currentPath, items) => {
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
          `${BASE_URL}/directory/copy`,
          {
            source_name: copyItem.name,
            source_parent: currentPath,
            new_name: copyNewName,
            destination_parent: selectedDestination || currentPath,
            container
          },
          { withCredentials: true }
        );
      } else {
        await axios.post(
          `${BASE_URL}/copy-file`,
          {
            source_file: copyItem.name,
            new_file_name: copyNewName,
            destination_folder: selectedDestination || currentPath,
            container
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

  // Move handler
  const handleMove = (record) => {
    setMoveItem(record);
    setMoveDestination('');
    setSelectedMainFolder('');
    setSelectedSubFolder('');
    setSubFolders([]);
    setMoveModalVisible(true);
  };

  const fetchSubFolders = async (mainFolder) => {
    try {
      const res = await axios.get(
        `${BASE_URL}/directory/list?directory=${encodeURIComponent(mainFolder)}`,
        { withCredentials: true }
      );

      const folders = (res.data || [])
        .filter(item => item.type === 'directory')
        .map(folder => ({
          name: folder.name,
          path: `${mainFolder}/${folder.name}`
        }));

      setSubFolders(folders);
    } catch (error) {
      console.error('Error fetching subfolders:', error);
      message.error('Failed to load subfolders');
      setSubFolders([]);
    }
  };

  const handleMainFolderChange = (value) => {
    setSelectedMainFolder(value);
    setSelectedSubFolder('');
    setMoveDestination(value);

    if (value) {
      fetchSubFolders(value);
    } else {
      setSubFolders([]);
    }
  };

  const handleSubFolderChange = (value) => {
    setSelectedSubFolder(value);
    if (value) {
      setMoveDestination(`${selectedMainFolder}/${value}`);
    } else {
      setMoveDestination(selectedMainFolder);
    }
  };

  const handleMoveConfirm = async (currentPath) => {
    if (!moveDestination?.trim()) {
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
          `${BASE_URL}/directory/move`,
          {
            name: moveItem.name,
            old_parent: currentPath,
            new_parent: moveDestination,
            container
          },
          { withCredentials: true }
        );
      } else {
        await axios.post(
          `${BASE_URL}/move-file`,
          {
            id: moveItem.id.toString(),
            filename: moveItem.name,
            old_parent: currentPath,
            new_parent: moveDestination,
            overwrite: false
          },
          { withCredentials: true }
        );
      }
      message.success(`Moved '${moveItem.name}' successfully`);
      setMoveModalVisible(false);
      setMoveItem(null);
      setMoveDestination('');
      fetchItems();
      if (fetchDirectories) fetchDirectories();
    } catch (error) {
      console.error('Move error:', error);
      message.error(error.response?.data?.error || 'Error moving item');
    }
  };

  const handleOpenUploadModal = (currentPath) => {
    if (!currentPath) {
      message.error("Please select or create a folder first.");
      return;
    }
    setUploadingFiles([]);
    setUploadModalVisible(true);
  };

  const handleModalUpload = async (currentPath) => {
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
        formData.append('container', container);

        await axios.post(`${BASE_URL}/upload`, formData, {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        message.success('File uploaded successfully');
      } else {
        const formData = new FormData();
        uploadingFiles.forEach(file => formData.append('files', file));
        formData.append('directory', normalizedPath);
        formData.append('container', container);
        formData.append('overwrite', 'false');
        formData.append('skip', 'false');

        const res = await axios.post(`${BASE_URL}/bulk-upload`, formData, {
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
    } catch (error) {
      console.error('Upload error:', error);
      message.error(error.response?.data?.error || 'Upload failed');
    }
  };

  return {
    createFolderModal, setCreateFolderModal, newFolderName, setNewFolderName,
    renameModalVisible, setRenameModalVisible, selectedItem, setSelectedItem, renameNewName, setRenameNewName,
    copyModalVisible, setCopyModalVisible, copyItem, setCopyItem, copyNewName, setCopyNewName, selectedDestination, setSelectedDestination,
    moveModalVisible, setMoveModalVisible, moveItem, setMoveItem, moveDestination, setMoveDestination,
    selectedMainFolder, setSelectedMainFolder, selectedSubFolder, setSelectedSubFolder, subFolders,
    uploadModalVisible, setUploadModalVisible, uploadingFiles, setUploadingFiles,
    handleCreateFolder, handleRename, handleRenameConfirm,
    handleCopy, handleCopyConfirm, handleMove, handleMoveConfirm,
    handleMainFolderChange, handleSubFolderChange,
    handleOpenUploadModal, handleModalUpload
  };
};

export default useCommonModals;
import axios from 'axios';
import { message, Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

/**
 * Utility functions for folder operations
 * These functions can be used across all dashboards (research, training, operation)
 */

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

/**
 * Delete a folder and its contents
 * @param {Object} folder - The folder object to delete
 * @param {string} folder.name - The name of the folder
 * @param {string} currentPath - Current directory path
 * @param {string} container - Container name (optional, e.g., 'training', 'research', 'operation')
 * @param {Function} onSuccess - Callback function to execute on success
 * @param {Function} onError - Callback function to execute on error
 * @returns {Promise} - Promise that resolves when the operation is complete
 */
export const deleteFolder = async (folder, currentPath, container, onSuccess, onError) => {
  try {
    await axios.post(`${BASE_URL}/directory/delete`, {
      name: folder.name,
      parent: currentPath,
      container
    }, { withCredentials: true });

    message.success(`${folder.name} deleted successfully`);

    if (onSuccess) {
      onSuccess();
    }

    return true;
  } catch (error) {
    console.error('Delete folder error:', error);
    message.error(error.response?.data?.error || `Error deleting ${folder.name}`);

    if (onError) {
      onError(error);
    }

    return false;
  }
};

/**
 * Show confirmation dialog before deleting a folder
 * @param {Object} folder - The folder object to delete
 * @param {string} currentPath - Current directory path
 * @param {string} container - Container name (optional, e.g., 'training', 'research', 'operation')
 * @param {Function} onSuccess - Callback function to execute on success
 * @param {Function} onError - Callback function to execute on error
 */
export const confirmFolderDelete = (folder, currentPath, container, onSuccess, onError) => {
  Modal.confirm({
    title: 'Delete Folder',
    icon: <ExclamationCircleOutlined />,
    content: `Are you sure you want to delete the folder "${folder.name}" and all its contents? This action cannot be undone.`,
    okText: 'Yes, Delete',
    okType: 'danger',
    cancelText: 'Cancel',
    onOk: async () => {
      await deleteFolder(folder, currentPath, container, onSuccess, onError);
    }
  });
};

/**
 * Check if user has permission to delete a folder
 * @param {Object} folder - The folder object to check
 * @param {string} currentUser - Current username
 * @param {boolean} isAdmin - Whether the current user is an admin
 * @returns {boolean} - Whether the user has permission
 */
export const canDeleteFolder = (folder, currentUser, isAdmin) => {
  // Admins can delete any folder
  if (isAdmin) return true;

  // Regular users can only delete folders they created
  return folder.created_by === currentUser;
};

/**
 * Copy a folder and its contents
 * @param {Object} folder - The folder object to copy
 * @param {string} folder.name - The name of the folder
 * @param {string} sourcePath - Source directory path
 * @param {string} destinationPath - Destination directory path
 * @param {string} container - Container name (optional, e.g., 'training', 'research', 'operation')
 * @param {Function} onSuccess - Callback function to execute on success
 * @param {Function} onError - Callback function to execute on error
 * @param {Function} fetchFolderTree - Function to refresh folder tree after copy
 * @returns {Promise} - Promise that resolves when the operation is complete
 */
export const copyFolder = async (folder, sourcePath, destinationPath, container, onSuccess, onError, fetchFolderTree) => {
  try {
    // Always use the original folder name to ensure proper merging
    const folderName = folder.name;

    await axios.post(`${BASE_URL}/directory/copy`, {
      source_name: folderName,
      source_parent: sourcePath,
      new_name: folderName,
      destination_parent: destinationPath,
      container,
      overwrite: true  // Always set to true for directories to ensure they merge
    }, { withCredentials: true });

    message.success(`Copied ${folderName} to ${destinationPath}`);

    // Refresh folder tree if provided
    if (fetchFolderTree) {
      fetchFolderTree();
    }

    if (onSuccess) {
      onSuccess();
    }

    return true;
  } catch (error) {
    console.error('Copy folder error:', error);

    // Handle specific error cases
    if (error.response?.data?.error === "Source folder not found") {
      message.error('The folder no longer exists. Please refresh the page and try again.');
    } else if (error.response?.data?.error === "Permission denied") {
      message.error('You do not have permission to copy this folder.');
    } else {
      message.error(error.response?.data?.error || `Error copying ${folder.name}`);
    }

    if (onError) {
      onError(error);
    }

    return false;
  }
};

/**
 * Move a folder and its contents
 * @param {Object} folder - The folder object to move
 * @param {string} folder.name - The name of the folder
 * @param {string} sourcePath - Source directory path
 * @param {string} destinationPath - Destination directory path
 * @param {string} container - Container name (optional, e.g., 'training', 'research', 'operation')
 * @param {Function} onSuccess - Callback function to execute on success
 * @param {Function} onError - Callback function to execute on error
 * @param {Function} fetchFolderTree - Function to refresh folder tree after move
 * @returns {Promise} - Promise that resolves when the operation is complete
 */
export const moveFolder = async (folder, sourcePath, destinationPath, container, onSuccess, onError, fetchFolderTree) => {
  try {
    const folderName = folder.name;

    // Prepare request data
    const requestData = {
      name: folderName,
      old_parent: sourcePath,
      new_parent: destinationPath
    };

    // Add container if provided
    if (container) {
      requestData.container = container;
    }

    const response = await axios.post(`${BASE_URL}/directory/move`, requestData, { withCredentials: true });

    // Check if it was a merge operation based on the response message
    const isMergeOperation = response.data?.message?.includes('merged');

    if (isMergeOperation) {
      message.success(`Merged ${folderName} into existing folder at ${destinationPath}`);
    } else {
      message.success(`Moved ${folderName} to ${destinationPath}`);
    }

    // Refresh folder tree if provided
    if (fetchFolderTree) {
      fetchFolderTree();
    }

    if (onSuccess) {
      onSuccess();
    }

    return true;
  } catch (error) {
    console.error('Move folder error:', error);

    // Handle specific error cases
    if (error.response?.data?.error === "Source folder not found") {
      message.error('The folder no longer exists. Please refresh the page and try again.');
    } else if (error.response?.data?.error === "Permission denied") {
      message.error('You do not have permission to move this folder.');
    } else {
      message.error(error.response?.data?.error || `Error moving ${folder.name}`);
    }

    if (onError) {
      onError(error);
    }

    return false;
  }
};

/**
 * Fetch subfolders for a given main folder
 * @param {string} mainFolder - Main folder to fetch subfolders for
 * @param {Function} setSubFolders - State setter function for subfolders
 * @param {Function} onError - Callback function to execute on error
 */
export const fetchSubFolders = async (mainFolder, setSubFolders, onError) => {
  try {
    const res = await axios.get(`${BASE_URL}/directory/list?directory=${encodeURIComponent(mainFolder)}`,
      { withCredentials: true }
    );

    // Filter to only include directories and sort them alphabetically
    const folders = (res.data || [])
      .filter(item => item.type === 'directory')
      .map(folder => ({
        name: folder.name,
        path: `${mainFolder}/${folder.name}`
      }))
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically

    setSubFolders(folders);
  } catch (error) {
    console.error('Error fetching subfolders:', error);
    message.error('Failed to load subfolders');
    setSubFolders([]);

    if (onError) {
      onError(error);
    }
  }
};

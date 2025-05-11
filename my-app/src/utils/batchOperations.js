import axios from 'axios';
import { message } from 'antd';

/**
 * Utility functions for batch operations on files
 */

/**
 * Delete multiple files or directories
 * @param {Array} items - Array of file/directory objects to delete
 * @param {string} currentPath - Current directory path
 * @param {string} container - Container name (optional)
 * @param {Function} onSuccess - Callback function to execute on success
 */
export const batchDelete = async (items, currentPath, container, onSuccess) => {
  if (!items || items.length === 0) return;

  const deletePromises = items.map(item => {
    const endpoint = item.type === 'directory' ? '/directory/delete' : '/delete-file';
    const data = item.type === 'directory'
      ? { name: item.name, parent: currentPath, container }
      : { filename: item.name, directory: currentPath, container };

    return axios.delete(endpoint, {
      data,
      withCredentials: true
    });
  });

  try {
    await Promise.all(deletePromises);
    message.success(`${items.length} item(s) deleted successfully`);
    if (onSuccess) onSuccess();
  } catch (error) {
    console.error('Batch delete error:', error);
    message.error('Error deleting some items');
  }
};

/**
 * Download multiple files individually
 * @param {Array} items - Array of file objects to download
 * @param {string} currentPath - Current directory path
 * @param {string} BASE_URL - Base URL for API calls
 */
export const batchDownload = async (items, currentPath, BASE_URL) => {
  if (!items || items.length === 0) return;

  // Filter out directories as they need special handling
  const files = items.filter(item => item.type === 'file');
  const directories = items.filter(item => item.type === 'directory');

  if (files.length === 0 && directories.length === 0) {
    message.info('No valid items selected for download');
    return;
  }

  // If only one file is selected, download it directly
  if (files.length === 1 && directories.length === 0) {
    const file = files[0];
    const encodedDir = encodeURIComponent(currentPath || '');
    const encodedFile = encodeURIComponent(file.name.trim());
    const downloadUrl = `${BASE_URL}/download?directory=${encodedDir}&filename=${encodedFile}`;
    window.open(downloadUrl, '_blank');
    return;
  }

  // If only one directory is selected, download it directly
  if (directories.length === 1 && files.length === 0) {
    const dir = directories[0];
    const folderPath = currentPath ? `${currentPath}/${dir.name}` : dir.name;
    const encodedPath = encodeURIComponent(folderPath.trim());
    const downloadUrl = `${BASE_URL}/download-folder?directory=${encodedPath}`;
    window.open(downloadUrl, '_blank');
    return;
  }

  // For multiple items, download them one by one
  message.info('Downloading multiple items. Check your browser for download prompts.');

  // Download files one by one
  for (const file of files) {
    const encodedDir = encodeURIComponent(currentPath || '');
    const encodedFile = encodeURIComponent(file.name.trim());
    const downloadUrl = `${BASE_URL}/download?directory=${encodedDir}&filename=${encodedFile}`;
    window.open(downloadUrl, '_blank');
    // Add a small delay to prevent browser from blocking multiple popups
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Download directories one by one
  for (const dir of directories) {
    const folderPath = currentPath ? `${currentPath}/${dir.name}` : dir.name;
    const encodedPath = encodeURIComponent(folderPath.trim());
    const downloadUrl = `${BASE_URL}/download-folder?directory=${encodedPath}`;
    window.open(downloadUrl, '_blank');
    // Add a small delay to prevent browser from blocking multiple popups
    await new Promise(resolve => setTimeout(resolve, 500));
  }
};

/**
 * Delete multiple users
 * @param {Array} users - Array of user objects to delete
 * @param {Function} onSuccess - Callback function to execute on success
 */
export const batchDeleteUsers = async (users, onSuccess) => {
  if (!users || users.length === 0) return;

  let successCount = 0;
  let failCount = 0;

  // Process users sequentially to handle errors better
  for (const user of users) {
    try {
      await axios.delete('/user/delete', {
        data: { username: user.username },
        withCredentials: true
      });
      successCount++;
    } catch (error) {
      console.error(`Error deleting user ${user.username}:`, error);
      failCount++;
    }
  }

  if (successCount > 0) {
    message.success(`${successCount} user(s) deleted successfully`);
  }

  if (failCount > 0) {
    message.error(`Failed to delete ${failCount} user(s)`);
  }

  if (onSuccess) onSuccess();
};

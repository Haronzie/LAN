import axios from 'axios';
import { message, Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

/**
 * Utility functions for folder operations
 * These functions can be used across all dashboards (research, training, operation)
 */

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
    // Build the full path for the folder
    const folderPath = currentPath ? `${currentPath}/${folder.name}` : folder.name;
    console.log(`🗑️ Deleting folder: ${folderPath}`);

    // Step 1: Recursively get all files and subfolders within this folder
    const allContents = await getAllFolderContents(folderPath);
    console.log(`Found ${allContents.files.length} files and ${allContents.folders.length} subfolders to delete`);

    // Step 2: Delete all files first
    if (allContents.files.length > 0) {
      console.log(`Deleting ${allContents.files.length} files...`);
      for (const file of allContents.files) {
        try {
          await axios.delete('/delete-file', {
            data: {
              filename: file.name,
              directory: file.directory,
              container
            },
            withCredentials: true
          });
          console.log(`Deleted file: ${file.directory}/${file.name}`);
        } catch (fileError) {
          console.error(`Error deleting file ${file.directory}/${file.name}:`, fileError);
          // Continue with other files even if one fails
        }
      }
    }

    // Step 3: Delete all subfolders (from deepest to shallowest)
    if (allContents.folders.length > 0) {
      // Sort folders by depth (deepest first) to ensure proper deletion order
      const sortedFolders = [...allContents.folders].sort((a, b) => {
        const depthA = (a.path.match(/\//g) || []).length;
        const depthB = (b.path.match(/\//g) || []).length;
        return depthB - depthA; // Descending order (deepest first)
      });

      console.log(`Deleting ${sortedFolders.length} subfolders in order from deepest to shallowest...`);
      for (const subfolder of sortedFolders) {
        try {
          // Extract parent path and folder name
          const lastSlashIndex = subfolder.path.lastIndexOf('/');
          const parentPath = lastSlashIndex > 0 ? subfolder.path.substring(0, lastSlashIndex) : '';
          const folderName = lastSlashIndex > 0 ? subfolder.path.substring(lastSlashIndex + 1) : subfolder.path;

          await axios.delete('/directory/delete', {
            data: {
              name: folderName,
              parent: parentPath,
              container
            },
            withCredentials: true
          });
          console.log(`Deleted subfolder: ${subfolder.path}`);
        } catch (folderError) {
          console.error(`Error deleting subfolder ${subfolder.path}:`, folderError);
          // Continue with other folders even if one fails
        }
      }
    }

    // Step 4: Finally delete the main folder itself
    await axios.delete('/directory/delete', {
      data: {
        name: folder.name,
        parent: currentPath,
        container
      },
      withCredentials: true
    });

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
 * Recursively get all files and subfolders within a folder
 * @param {string} folderPath - Path to the folder
 * @returns {Promise<{files: Array, folders: Array}>} - Promise that resolves with arrays of files and folders
 */
export const getAllFolderContents = async (folderPath) => {
  const result = {
    files: [],
    folders: []
  };

  try {
    // Get all files in the current folder
    const filesRes = await axios.get(`/files?directory=${encodeURIComponent(folderPath)}`, {
      withCredentials: true
    });

    if (filesRes.data && Array.isArray(filesRes.data)) {
      // Add all files from this folder
      result.files.push(...filesRes.data.map(file => ({
        name: file.name,
        directory: folderPath,
        id: file.id
      })));
    }

    // Get all subfolders in the current folder
    const foldersRes = await axios.get(`/directory/list?directory=${encodeURIComponent(folderPath)}`, {
      withCredentials: true
    });

    if (foldersRes.data && Array.isArray(foldersRes.data)) {
      const subfolders = foldersRes.data.filter(item => item.type === 'directory');

      // Add all subfolders from this level
      for (const subfolder of subfolders) {
        const subfolderPath = `${folderPath}/${subfolder.name}`;

        // Add this subfolder to the list
        result.folders.push({
          name: subfolder.name,
          path: subfolderPath
        });

        // Recursively get contents of this subfolder
        const subContents = await getAllFolderContents(subfolderPath);

        // Add subfolder's files and folders to our result
        result.files.push(...subContents.files);
        result.folders.push(...subContents.folders);
      }
    }

    return result;
  } catch (error) {
    console.error(`Error getting contents of folder ${folderPath}:`, error);
    return result; // Return whatever we've collected so far
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
export const confirmFolderDelete = async (folder, currentPath, container, onSuccess, onError) => {
  try {
    // Build the full path for the folder
    const folderPath = currentPath ? `${currentPath}/${folder.name}` : folder.name;

    // Get folder contents to show detailed information
    const contents = await getAllFolderContents(folderPath);
    const fileCount = contents.files.length;
    const folderCount = contents.folders.length;

    // Create a detailed message about what will be deleted
    let detailedMessage = `Are you sure you want to delete the folder "${folder.name}"?`;

    if (fileCount > 0 || folderCount > 0) {
      detailedMessage += `\n\nThis will delete:`;
      if (fileCount > 0) {
        detailedMessage += `\n• ${fileCount} file${fileCount !== 1 ? 's' : ''}`;
      }
      if (folderCount > 0) {
        detailedMessage += `\n• ${folderCount} subfolder${folderCount !== 1 ? 's' : ''}`;
      }
      detailedMessage += `\n\nThis action cannot be undone.`;
    } else {
      detailedMessage += `\n\nThe folder is empty. This action cannot be undone.`;
    }

    Modal.confirm({
      title: 'Delete Folder',
      icon: <ExclamationCircleOutlined />,
      content: detailedMessage,
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        await deleteFolder(folder, currentPath, container, onSuccess, onError);
      }
    });
  } catch (error) {
    console.error('Error preparing folder delete confirmation:', error);

    // Fallback to simple confirmation if we can't get folder contents
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
  }
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

    await axios.post('/directory/copy', {
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

    const response = await axios.post('/directory/move', requestData, { withCredentials: true });

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
    const res = await axios.get(`/directory/list?directory=${encodeURIComponent(mainFolder)}`,
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

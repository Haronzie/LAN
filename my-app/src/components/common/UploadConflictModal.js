import React from 'react';
import { Modal, Button } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

/**
 * Component to handle file upload conflicts
 * Shows a modal with options to overwrite, keep both, or skip when a file already exists
 */
const UploadConflictModal = ({ 
  file, 
  conflictingFiles, 
  onOverwrite, 
  onKeepBoth, 
  onSkip,
  isBulk = false 
}) => {
  
  if (isBulk) {
    // For multiple files with conflicts
    return Modal.info({
      title: `${conflictingFiles.length} file(s) already exist`,
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>The following files already exist:</p>
          <ul style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #eee', padding: '8px 16px' }}>
            {conflictingFiles.map(file => (
              <li key={file.uid}>{file.name}</li>
            ))}
          </ul>
          <p style={{ marginTop: '16px' }}>Choose an action for these files:</p>
          <div style={{ marginTop: '16px' }}>
            <Button
              danger
              style={{ width: '100%', marginBottom: '8px' }}
              onClick={() => {
                Modal.destroyAll();
                onOverwrite();
              }}
            >
              A. Overwrite All - Replace existing files
            </Button>

            <Button
              type="primary"
              style={{ width: '100%', marginBottom: '8px' }}
              onClick={() => {
                Modal.destroyAll();
                onKeepBoth();
              }}
            >
              B. Keep Both - Save with new names
            </Button>

            <Button
              style={{ width: '100%' }}
              onClick={() => {
                Modal.destroyAll();
                onSkip();
              }}
            >
              C. Skip Conflicts - Upload only new files
            </Button>
          </div>
        </div>
      ),
      okButtonProps: { style: { display: 'none' } }, // Hide the default OK button
    });
  } else {
    // For a single file conflict
    return Modal.info({
      title: `A file named '${file.name}' already exists.`,
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>Choose an action for this file:</p>
          <div style={{ marginTop: '16px' }}>
            <Button
              danger
              style={{ width: '100%', marginBottom: '8px' }}
              onClick={() => {
                Modal.destroyAll();
                onOverwrite();
              }}
            >
              A. Overwrite - Replace the existing file
            </Button>

            <Button
              type="primary"
              style={{ width: '100%', marginBottom: '8px' }}
              onClick={() => {
                Modal.destroyAll();
                onKeepBoth();
              }}
            >
              B. Keep Both - Save with a new name
            </Button>

            <Button
              style={{ width: '100%' }}
              onClick={() => {
                Modal.destroyAll();
                onSkip();
              }}
            >
              C. Skip - Cancel this upload
            </Button>
          </div>
        </div>
      ),
      okButtonProps: { style: { display: 'none' } }, // Hide the default OK button
    });
  }
};

export default UploadConflictModal;

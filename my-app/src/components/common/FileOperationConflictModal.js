import React from 'react';
import { Modal, Button } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

/**
 * Component to handle file operation conflicts (copy/move)
 * Shows a modal with options to overwrite, keep both, or skip when a file already exists
 */
const FileOperationConflictModal = ({
  fileName,
  destinationPath,
  operation, // 'copy' or 'move'
  onOverwrite,
  onKeepBoth,
  onSkip,
}) => {
  const title = `A file named '${fileName}' already exists.`;
  const operationText = operation === 'copy' ? 'copy' : 'move';

  return Modal.info({
    title,
    icon: <ExclamationCircleOutlined />,
    closable: true,
    width: 400,
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
            C. Skip - Cancel this {operationText}
          </Button>
        </div>
      </div>
    ),
    okButtonProps: { style: { display: 'none' } },
    cancelButtonProps: { style: { display: 'none' } },
  });
};

export default FileOperationConflictModal;

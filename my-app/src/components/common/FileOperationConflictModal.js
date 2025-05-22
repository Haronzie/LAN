import { Modal } from 'antd';

/**
 * Shows a modal dialog for file/folder operation conflicts (overwrite, keep both, skip).
 * Usage: FileOperationConflictModal({ fileName, destinationPath, operation, onOverwrite, onKeepBoth, onSkip })
 */
export default function FileOperationConflictModal({ fileName, destinationPath, operation, onOverwrite, onKeepBoth, onSkip }) {
  let modal = null;
  modal = Modal.confirm({
    title: `A file named '${fileName}' already exists in '${destinationPath}'.`,
    content: (
      <div>
        <p>How would you like to resolve this conflict?</p>
        <ul>
          <li><b>Overwrite</b>: Replace the existing file with the new one.</li>
          <li><b>Keep Both</b>: Save the new file with a different name.</li>
          <li><b>Skip</b>: Do not move/copy this file.</li>
        </ul>
      </div>
    ),
    okText: 'Overwrite',
    cancelText: 'Skip',
    onOk: () => {
      modal.destroy();
      if (onOverwrite) onOverwrite();
    },
    onCancel: () => {
      modal.destroy();
      if (onSkip) onSkip();
    },
    okButtonProps: { danger: true },
    afterClose: () => {},
    footer: (_, { OkBtn, CancelBtn }) => (
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <OkBtn />
        <button
          type="button"
          className="ant-btn"
          onClick={() => {
            modal.destroy();
            if (onKeepBoth) onKeepBoth();
          }}
          style={{ marginLeft: 8 }}
        >
          Keep Both
        </button>
        <CancelBtn />
      </div>
    ),
  });
}

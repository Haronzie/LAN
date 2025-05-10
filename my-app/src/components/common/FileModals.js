import React from 'react';
import { Modal, Form, Input, Select, TreeSelect, Upload, message } from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';

const { Option } = Select;
const { Dragger } = Upload;

/**
 * Create Folder Modal
 */
export const CreateFolderModal = ({
  visible,
  onCancel,
  onOk,
  folderName,
  setFolderName
}) => {
  return (
    <Modal
      title="Create New Folder"
      visible={visible}
      onOk={onOk}
      onCancel={onCancel}
      okText="Create"
    >
      <Form layout="vertical">
        <Form.Item label="Folder Name" required>
          <Input
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="e.g. NewFolder"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

/**
 * Rename Modal
 */
export const RenameModal = ({
  visible,
  onCancel,
  onOk,
  newName,
  setNewName
}) => {
  return (
    <Modal
      title="Rename Item"
      visible={visible}
      onOk={onOk}
      onCancel={onCancel}
      okText="Rename"
    >
      <Form layout="vertical">
        <Form.Item label="New Name" required>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter new name"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

/**
 * Move Modal with TreeSelect
 */
export const MoveModal = ({
  visible,
  onCancel,
  onOk,
  destination,
  setDestination,
  treeData
}) => {
  return (
    <Modal
      title="Move Item"
      visible={visible}
      onOk={onOk}
      onCancel={onCancel}
      okText="Move"
    >
      <Form layout="vertical">
        <Form.Item label="Destination Folder" required>
          <TreeSelect
            style={{ width: '100%' }}
            treeData={treeData}
            placeholder="Select destination folder"
            value={destination}
            onChange={(val) => setDestination(val)}
            treeDefaultExpandAll
            allowClear
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

/**
 * Move Modal with Main Folder Selection
 */
export const MainFolderMoveModal = ({
  visible,
  onCancel,
  onOk,
  selectedMainFolder,
  setSelectedMainFolder,
  setMoveDestination
}) => {
  return (
    <Modal
      title="Move Item"
      visible={visible}
      onOk={onOk}
      onCancel={onCancel}
      okText="Move"
    >
      <Form layout="vertical">
        <Form.Item label="Main Folder" required>
          <Select
            placeholder="Select main folder"
            value={selectedMainFolder}
            onChange={(value) => {
              setSelectedMainFolder(value);
              setMoveDestination(value); // Default to main folder
            }}
          >
            <Option value="Operation">Operation</Option>
            <Option value="Research">Research</Option>
            <Option value="Training">Training</Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

/**
 * Upload Modal
 */
export const UploadModal = ({
  visible,
  onCancel,
  onOk,
  files,
  setFiles,
  currentPath
}) => {
  return (
    <Modal
      title="Upload File(s)"
      visible={visible}
      onOk={onOk}
      onCancel={() => {
        onCancel();
        setFiles([]);
      }}
      okText="Upload"
    >
      {currentPath && <p>Target Folder: {currentPath || '(none)'}</p>}
      <Form layout="vertical">
        <Dragger
          multiple
          fileList={files}
          beforeUpload={(file, fileList) => {
            setFiles(fileList);
            return false; // prevent auto upload
          }}
          showUploadList={true}
          onRemove={(file) => {
            setFiles(prev => prev.filter(f => f.uid !== file.uid));
          }}
          customRequest={({ onSuccess }) => {
            setTimeout(() => {
              onSuccess("ok");
            }, 0);
          }}
          style={{ padding: '12px 0' }}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">Click or drag files here to upload</p>
          <p className="ant-upload-hint">Supports multiple files</p>
        </Dragger>
      </Form>
    </Modal>
  );
};

/**
 * Copy Modal
 */
export const CopyModal = ({
  visible,
  onCancel,
  onOk,
  newName,
  setNewName,
  selectedDestination,
  setSelectedDestination,
  folderOptions
}) => {
  return (
    <Modal
      title="Copy Item"
      visible={visible}
      onOk={onOk}
      onCancel={onCancel}
      okText="Copy"
    >
      <Form layout="vertical">
        <Form.Item label="New Name" required>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter new name"
          />
        </Form.Item>
        <Form.Item label="Destination Folder (Optional)">
          <Select
            style={{ width: '100%' }}
            placeholder="Select a folder or leave blank"
            value={selectedDestination}
            onChange={(val) => setSelectedDestination(val)}
            allowClear
          >
            {folderOptions.map((folder) => (
              <Option key={folder.value} value={folder.value}>
                {folder.label}
              </Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

/**
 * File Info Modal
 */
export const FileInfoModal = ({
  visible,
  onCancel,
  fileInfo
}) => {
  return (
    <Modal
      title="File Information"
      visible={visible}
      onCancel={onCancel}
      footer={null}
    >
      {fileInfo ? (
        <div>
          <p><strong>Name:</strong> {fileInfo.name}</p>
          <p><strong>Type:</strong> {fileInfo.type}</p>
          <p><strong>Size:</strong> {fileInfo.formattedSize}</p>
          <p><strong>Uploader:</strong> {fileInfo.uploader || 'N/A'}</p>
          <p><strong>Uploaded On:</strong> {fileInfo.created_at ? new Date(fileInfo.created_at).toLocaleString() : 'N/A'}</p>
        </div>
      ) : (
        <p>No file information available</p>
      )}
    </Modal>
  );
};

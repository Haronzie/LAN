import React from 'react';
import { Modal, Form, Input, Select, TreeSelect, Upload, message } from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import path from 'path-browserify';

const { Dragger } = Upload;
const { Option } = Select;

/**
 * CommonModals component that contains all the common modals used across dashboard components
 */
const CommonModals = ({
  // Create Folder Modal props
  createFolderModal,
  setCreateFolderModal,
  newFolderName,
  setNewFolderName,
  handleCreateFolder,

  // Rename Modal props
  renameModalVisible,
  setRenameModalVisible,
  renameNewName,
  setRenameNewName,
  handleRenameConfirm,

  // Copy Modal props
  copyModalVisible,
  setCopyModalVisible,
  copyNewName,
  setCopyNewName,
  selectedDestination,
  setSelectedDestination,
  handleCopyConfirm,
  directoryItems,
  currentPath,
  copySelectedMainFolder,
  copySelectedSubFolder,
  copySubFolders,
  handleCopyMainFolderChange,
  handleCopySubFolderChange,

  // Move Modal props
  moveModalVisible,
  setMoveModalVisible,
  moveDestination,
  setMoveDestination,
  handleMoveConfirm,
  selectedMainFolder,
  selectedSubFolder,
  subFolders,
  handleMainFolderChange,
  handleSubFolderChange,

  // Upload Modal props
  uploadModalVisible,
  setUploadModalVisible,
  uploadingFiles,
  setUploadingFiles,
  handleModalUpload,
  container
}) => {
  return (
    <>
      {/* Create Folder Modal */}
      <Modal
        title="Create New Folder"
        open={createFolderModal}
        onOk={handleCreateFolder}
        onCancel={() => setCreateFolderModal(false)}
        okText="Create"
      >
        <Form layout="vertical">
          <Form.Item label="Folder Name" required>
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g. NewFolder"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Rename Modal */}
      <Modal
        title="Rename Item"
        open={renameModalVisible}
        onOk={handleRenameConfirm}
        onCancel={() => setRenameModalVisible(false)}
        okText="Rename"
      >
        <Form layout="vertical">
          <Form.Item label="New Name" required>
            <Input
              value={renameNewName}
              onChange={(e) => setRenameNewName(e.target.value)}
              placeholder="Enter new name"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Copy Modal */}
      <Modal
        title="Copy Item"
        open={copyModalVisible}
        onOk={handleCopyConfirm}
        onCancel={() => setCopyModalVisible(false)}
        okText="Copy"
        okButtonProps={{ disabled: !copySelectedMainFolder }}
      >
        <Form layout="vertical">
          <Form.Item label="New Name" required>
            <Input
              value={copyNewName}
              onChange={(e) => setCopyNewName(e.target.value)}
              placeholder="Enter new name"
              disabled={false} // Allow editing the name
            />
          </Form.Item>
          <Form.Item label="Main Folder" required>
            <Select
              style={{ width: '100%' }}
              placeholder="Select main folder"
              value={copySelectedMainFolder}
              onChange={handleCopyMainFolderChange}
              allowClear
            >
              {/* Sort main folders alphabetically */}
              {['Operation', 'Research', 'Training'].sort().map(folder => (
                <Option key={folder} value={folder}>
                  {folder}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {copySelectedMainFolder && (
            <Form.Item label="Destination Folder">
              <Select
                style={{ width: '100%' }}
                placeholder="Select destination folder (optional)"
                value={copySelectedSubFolder}
                onChange={handleCopySubFolderChange}
                allowClear
              >
                {/* Sort subfolders alphabetically */}
                {copySubFolders
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(folder => (
                    <Option key={folder.path} value={folder.name}>
                      {folder.name}
                    </Option>
                  ))}
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Move Modal */}
      <Modal
        title="Move Item"
        open={moveModalVisible}
        onOk={handleMoveConfirm}
        onCancel={() => setMoveModalVisible(false)}
        okText="Move"
      >
        <Form layout="vertical">
          <Form.Item label="Main Folder" required>
            <Select
              style={{ width: '100%' }}
              placeholder="Select main folder"
              value={selectedMainFolder}
              onChange={handleMainFolderChange}
              allowClear
            >
              {/* Sort main folders alphabetically */}
              {['Operation', 'Research', 'Training'].sort().map(folder => (
                <Option key={folder} value={folder}>
                  {folder}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {selectedMainFolder && (
            <Form.Item label="Destination Folder">
              <Select
                style={{ width: '100%' }}
                placeholder="Select destination folder (optional)"
                value={selectedSubFolder}
                onChange={handleSubFolderChange}
                allowClear
              >
                {/* Sort subfolders alphabetically */}
                {subFolders
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(folder => (
                    <Option key={folder.path} value={folder.name}>
                      {folder.name}
                    </Option>
                  ))}
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Upload Modal */}
      <Modal
        title="Upload Files"
        open={uploadModalVisible}
        onOk={handleModalUpload}
        onCancel={() => {
          setUploadModalVisible(false);
          setUploadingFiles([]);
        }}
        okText="Upload"
        okButtonProps={{ disabled: !uploadingFiles || uploadingFiles.length === 0 }}
      >
        <p>Target Folder: {currentPath}</p>
        <Form layout="vertical">
          <Form.Item>
            <Dragger
              multiple
              fileList={uploadingFiles}
              beforeUpload={(file, fileList) => {
                setUploadingFiles(fileList);
                return false; // Don't auto upload
              }}
              showUploadList={{ showRemoveIcon: true, showPreviewIcon: false }}
              onRemove={(file) => {
                setUploadingFiles(prev => prev.filter(f => f.uid !== file.uid));
              }}
              customRequest={({ onSuccess }) => {
                setTimeout(() => {
                  onSuccess("ok");
                }, 0);
              }}
              style={{ padding: '12px 0' }}
            >
              <p className="ant-upload-drag-icon"><UploadOutlined /></p>
              <p className="ant-upload-text">Click or drag files here to upload</p>
              <p className="ant-upload-hint">You can select multiple files</p>
            </Dragger>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default CommonModals;

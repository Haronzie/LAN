import React from 'react';
import { Modal, Form, Input, Select, TreeSelect, Upload, message } from 'antd';
import { UploadOutlined, DeleteOutlined, FolderOutlined, RightOutlined } from '@ant-design/icons';
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
  onLoadData, // Add onLoadData prop for loading subfolders

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
  container,

  // Folder tree data for the TreeSelect component
  folderTreeData = [],

  // New props for copy subfolders
  forCopy = false,
  copySubFolders = false,
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
        width={700}
      >
        <Form layout="vertical">
          <Form.Item label="New Name" required>
            <Input
              value={copyNewName}
              onChange={(e) => setCopyNewName(e.target.value)}
              placeholder="Enter new name"
            />
          </Form.Item>
          <Form.Item label="Destination Folder" required>
            <div style={{ marginBottom: 8 }}>
              <div style={{ marginBottom: 8 }}>
                <Select
                  style={{ width: '100%' }}
                  placeholder="Select main folder"
                  value={selectedMainFolder || undefined}
                  onChange={handleMainFolderChange}
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    option.children.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  <Select.Option key="" value="">
                    Root Directory
                  </Select.Option>
                  <Select.Option key="Research" value="Research">
                    Research
                  </Select.Option>
                  <Select.Option key="Training" value="Training">
                    Training
                  </Select.Option>
                  <Select.Option key="Operation" value="Operation">
                    Operation
                  </Select.Option>
                </Select>
              </div>
              
              {selectedMainFolder && (
                <div style={{ border: '1px solid #d9d9d9', borderRadius: 4, padding: 8 }}>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>Current Path:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                      <span 
                        style={{
                          cursor: 'pointer',
                          padding: '2px 6px',
                          borderRadius: 4,
                          ':hover': { backgroundColor: '#f0f0f0' }
                        }}
                        onClick={() => {
                          handleMainFolderChange(selectedMainFolder);
                        }}
                      >
                        {selectedMainFolder}
                      </span>
                      
                      {selectedSubFolder && selectedSubFolder.split('/').map((segment, index, segments) => {
                        if (index === 0) return null; // Skip the first segment as it's the main folder
                        const path = segments.slice(0, index + 1).join('/');
                        const isLast = index === segments.length - 1;
                        
                        return (
                          <React.Fragment key={path}>
                            <RightOutlined style={{ color: '#999', fontSize: 12, margin: '0 4px' }} />
                            <span 
                              style={{
                                cursor: isLast ? 'default' : 'pointer',
                                padding: '2px 6px',
                                borderRadius: 4,
                                backgroundColor: isLast ? '#e6f7ff' : 'transparent',
                                ':hover': !isLast ? { backgroundColor: '#f0f0f0' } : {}
                              }}
                              onClick={() => {
                                if (!isLast) {
                                  const parentPath = segments.slice(0, index + 1).join('/');
                                  handleSubFolderChange(parentPath);
                                }
                              }}
                            >
                              {segment}
                            </span>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '4px 0' }}>
                    {(subFolders || []).map((folder) => {
                      const folderName = folder.path.split('/').pop();
                      const isSelected = selectedSubFolder === folder.path;
                      
                      return (
                        <div 
                          key={folder.path}
                          onClick={() => handleSubFolderChange(folder.path)}
                          style={{
                            padding: '6px 12px',
                            margin: '2px 0',
                            borderRadius: 4,
                            cursor: 'pointer',
                            backgroundColor: isSelected ? '#e6f7ff' : 'transparent',
                            border: isSelected ? '1px solid #91d5ff' : '1px solid transparent',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'all 0.3s',
                            ':hover': {
                              backgroundColor: isSelected ? '#e6f7ff' : '#f5f5f5'
                            }
                          }}
                        >
                          <FolderOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                          <span style={{ flex: 1 }}>{folderName}</span>
                          <RightOutlined style={{ color: '#999', fontSize: 12 }} />
                        </div>
                      );
                    })}
                    
                    {(!subFolders || subFolders.length === 0) && (
                      <div style={{ padding: '8px 12px', color: '#999', textAlign: 'center' }}>
                        No subfolders found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginTop: 12, padding: '8px 12px', backgroundColor: '#fafafa', borderRadius: 4 }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Destination Path:</div>
              <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                /{selectedMainFolder || 'Root'}
                {selectedSubFolder ? `/${selectedSubFolder.replace(/^[^/]+\//, '')}` : ''}
              </div>
            </div>
          </Form.Item>
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
          <Form.Item label="Destination Folder" required>
            <TreeSelect
              style={{ width: '100%' }}
              value={moveDestination}
              dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
              treeData={folderTreeData}
              placeholder="Select destination folder"
              treeDefaultExpandAll
              treeLine
              fieldNames={{ title: 'title', value: 'value', key: 'key', children: 'children' }}
              onChange={(value, label, extra) => {
                // If value is an array (TreeSelect can be multi), join as path
                let selectedPath = Array.isArray(value) ? value.join('/') : value;
                // Always normalize to forward slashes
                selectedPath = selectedPath.replace(/\\/g, '/');
                if (selectedPath.includes('\\')) {
                  console.warn('[MoveModal] WARNING: Detected backslash in path! Normalized to:', selectedPath);
                }
                console.log('[MoveModal] Selected moveDestination:', selectedPath);
                setMoveDestination(selectedPath);
              }}
            />
          </Form.Item>
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

// Helper function to flatten folder tree for Select options
function getAllSubfolderOptions(tree, parentPath = '') {
  if (!tree || !Array.isArray(tree)) return null;
  return tree.flatMap(node => {
    const fullPath = parentPath ? `${parentPath}/${node.title || node.value}` : (node.title || node.value);
    // Exclude main folders (already shown at the top)
    const isMain = ['Operation', 'Research', 'Training'].includes(node.title || node.value);
    const option = !isMain ? [
      <Option key={fullPath} value={fullPath}>{fullPath}</Option>
    ] : [];
    if (node.children && node.children.length > 0) {
      return [...option, ...getAllSubfolderOptions(node.children, fullPath)];
    }
    return option;
  });
}

export default CommonModals;

import React from 'react';
import { Button, Space, Tooltip, Typography, Popconfirm } from 'antd';
import {
  DeleteOutlined,
  DownloadOutlined,
  CopyOutlined,
  SwapOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

/**
 * A toolbar component that appears when items are selected
 * Provides batch operations for delete, copy, move, and download
 */
const MultipleSelectionToolbar = ({
  selectedItems = [],
  onDelete,
  onCopy,
  onMove,
  onDownload,
  showCopy = true,
  showMove = true,
  showDownload = true,
  showDelete = true,
  deleteButtonText = "Delete",
  copyButtonText = "Copy",
  moveButtonText = "Move",
  downloadButtonText = "Download",
  deleteConfirmTitle = "Are you sure you want to delete these items?",
  itemType = "file", // 'file' or 'user'
}) => {
  if (!selectedItems || selectedItems.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '10px 16px',
        background: '#f0f2f5',
        borderTop: '1px solid #d9d9d9',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
      }}
    >
      <Text strong>
        {selectedItems.length} {selectedItems.length === 1 ? itemType : `${itemType}s`} selected
      </Text>
      <Space>
        {showDelete && (
          <Popconfirm
            title={deleteConfirmTitle}
            onConfirm={onDelete}
            okText="Yes"
            cancelText="No"
            placement="topRight"
          >
            <Button 
              type="primary" 
              danger 
              icon={<DeleteOutlined />}
            >
              {deleteButtonText}
            </Button>
          </Popconfirm>
        )}
        {showCopy && (
          <Tooltip title={`Copy selected ${itemType}s`}>
            <Button 
              icon={<CopyOutlined />} 
              onClick={onCopy}
            >
              {copyButtonText}
            </Button>
          </Tooltip>
        )}
        {showMove && (
          <Tooltip title={`Move selected ${itemType}s`}>
            <Button 
              icon={<SwapOutlined />} 
              onClick={onMove}
            >
              {moveButtonText}
            </Button>
          </Tooltip>
        )}
        {showDownload && (
          <Tooltip title={`Download selected ${itemType}s`}>
            <Button 
              icon={<DownloadOutlined />} 
              onClick={onDownload}
            >
              {downloadButtonText}
            </Button>
          </Tooltip>
        )}
      </Space>
    </div>
  );
};

export default MultipleSelectionToolbar;

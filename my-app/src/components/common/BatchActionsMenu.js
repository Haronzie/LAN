import React from 'react';
import { Dropdown, Button, Menu, Typography } from 'antd';
import {
  DeleteOutlined,
  DownloadOutlined,
  CopyOutlined,
  SwapOutlined,
  MoreOutlined,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons';

const { Text } = Typography;

/**
 * A dropdown menu component for batch actions
 * Provides batch operations for delete, copy, move, and download
 */
const BatchActionsMenu = ({
  selectedItems = [],
  onDelete,
  onCopy,
  onMove,
  onDownload,
  showCopy = true,
  showMove = true,
  showDownload = true,
  showDelete = true,
  itemType = "file", // 'file' or 'user'
  selectionMode = false,
  onToggleSelectionMode,
  onCancelSelection
}) => {
  // Menu items for when no items are selected or selection mode is off
  const defaultMenuItems = [
    {
      key: 'select',
      icon: <CheckOutlined />,
      label: `Select multiple ${itemType}s`,
      onClick: onToggleSelectionMode
    }
  ];

  // Menu items for when items are selected in selection mode
  const selectionMenuItems = [
    {
      key: 'cancel',
      icon: <CloseOutlined />,
      label: 'Cancel selection',
      onClick: onCancelSelection
    },
    {
      type: 'divider'
    }
  ];

  if (showDelete) {
    selectionMenuItems.push({
      key: 'delete',
      icon: <DeleteOutlined />,
      label: `Delete ${selectedItems.length} ${selectedItems.length === 1 ? itemType : `${itemType}s`}`,
      onClick: onDelete
    });
  }

  if (showCopy) {
    selectionMenuItems.push({
      key: 'copy',
      icon: <CopyOutlined />,
      label: `Copy ${selectedItems.length} ${selectedItems.length === 1 ? itemType : `${itemType}s`}`,
      onClick: onCopy
    });
  }

  if (showMove) {
    selectionMenuItems.push({
      key: 'move',
      icon: <SwapOutlined />,
      label: `Move ${selectedItems.length} ${selectedItems.length === 1 ? itemType : `${itemType}s`}`,
      onClick: onMove
    });
  }

  if (showDownload) {
    selectionMenuItems.push({
      key: 'download',
      icon: <DownloadOutlined />,
      label: `Download ${selectedItems.length} ${selectedItems.length === 1 ? itemType : `${itemType}s`}`,
      onClick: onDownload
    });
  }

  // Determine which menu items to show
  const menuItems = selectionMode && selectedItems.length > 0 ? selectionMenuItems : defaultMenuItems;

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {selectionMode && selectedItems.length > 0 && (
        <Text strong style={{ marginRight: '10px' }}>
          {selectedItems.length} {selectedItems.length === 1 ? itemType : `${itemType}s`} selected
        </Text>
      )}
      <Dropdown menu={{ items: menuItems }} placement="bottomRight" trigger={['click']}>
        <Button type="text" icon={<MoreOutlined style={{ fontSize: '20px' }} />} />
      </Dropdown>
    </div>
  );
};

export default BatchActionsMenu;

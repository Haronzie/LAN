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
  // Create a selection menu item that indicates current selection state
  const selectionMenuItem = {
    key: 'select',
    icon: selectionMode ? <CheckOutlined style={{ color: '#1890ff' }} /> : <CheckOutlined />,
    label: (
      <span>
        {`Select multiple ${itemType}s`}
        {selectionMode && <span style={{ marginLeft: 8, color: '#1890ff' }}>(active)</span>}
      </span>
    ),
    onClick: onToggleSelectionMode
  };

  // Base menu items always include the selection toggle
  const baseMenuItems = [
    selectionMenuItem
  ];
  
  // Additional menu items when in selection mode with items selected
  const selectionActionItems = [
    {
      type: 'divider'
    }
  ];

  // Only add action items when in selection mode with items selected
  if (selectionMode && selectedItems.length > 0) {
    if (showDelete) {
      selectionActionItems.push({
        key: 'delete',
        icon: <DeleteOutlined />,
        label: `Delete ${selectedItems.length} ${selectedItems.length === 1 ? itemType : `${itemType}s`}`,
        onClick: onDelete
      });
    }

    if (showCopy) {
      selectionActionItems.push({
        key: 'copy',
        icon: <CopyOutlined />,
        label: `Copy ${selectedItems.length} ${selectedItems.length === 1 ? itemType : `${itemType}s`}`,
        onClick: onCopy
      });
    }

    if (showMove) {
      selectionActionItems.push({
        key: 'move',
        icon: <SwapOutlined />,
        label: `Move ${selectedItems.length} ${selectedItems.length === 1 ? itemType : `${itemType}s`}`,
        onClick: onMove
      });
    }

    if (showDownload) {
      selectionActionItems.push({
        key: 'download',
        icon: <DownloadOutlined />,
        label: `Download ${selectedItems.length} ${selectedItems.length === 1 ? itemType : `${itemType}s`}`,
        onClick: onDownload
      });
    }
  }

  // Combine base menu items with selection action items if applicable
  const menuItems = [...baseMenuItems, ...(selectionMode && selectedItems.length > 0 ? selectionActionItems : [])];

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

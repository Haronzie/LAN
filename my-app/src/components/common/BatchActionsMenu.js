import React, { useState } from 'react';
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

  // Cancel selection menu item
  const cancelMenuItem = {
    key: 'cancel',
    icon: <CloseOutlined />,
    label: 'Cancel',
    onClick: onCancelSelection
  };

  // Base menu items always include the selection toggle
  const baseMenuItems = [
    selectionMode ? cancelMenuItem : selectionMenuItem
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

  const [dropdownVisible, setDropdownVisible] = useState(false);

  const handleMenuClick = (e) => {
    if (e.key === 'select') {
      onToggleSelectionMode();
    } else if (e.key === 'cancel') {
      onCancelSelection();
    }
    setDropdownVisible(false);
  };

  const handleButtonClick = () => {
    if (selectionMode) {
      onCancelSelection();
    } else {
      onToggleSelectionMode();
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Dropdown
        overlay={
          <Menu 
            items={menuItems}
            onClick={handleMenuClick}
          />
        }
        trigger={['click']}
        placement="bottomRight"
        visible={dropdownVisible}
        onVisibleChange={setDropdownVisible}
      >
        <Button 
          type={selectionMode ? "primary" : "default"}
          icon={<CheckOutlined />}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={handleButtonClick}
        >
          {selectionMode 
            ? (selectedItems.length > 0 ? `${selectedItems.length} Selected` : 'Cancel')
            : 'Select Files'
          }
        </Button>
      </Dropdown>
    </div>
  );
};

export default BatchActionsMenu;

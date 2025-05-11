import React from 'react';
import { Typography, Button, Dropdown, Menu } from 'antd';
import {
  DeleteOutlined,
  DownloadOutlined,
  CopyOutlined,
  SwapOutlined,
  MoreOutlined,
  CloseOutlined
} from '@ant-design/icons';

const { Text } = Typography;

/**
 * A header component that appears when items are selected
 * Shows the number of selected items and provides a dropdown menu for actions
 */
const SelectionHeader = ({
  selectedItems = [],
  onDelete,
  onCopy,
  onMove,
  onDownload,
  onCancelSelection,
  showCopy = true,
  showMove = true,
  showDownload = true,
  showDelete = true,
  itemType = "file", // 'file' or 'user'
}) => {
  if (!selectedItems || selectedItems.length === 0) {
    return null;
  }

  const menuItems = [
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
    menuItems.push({
      key: 'delete',
      icon: <DeleteOutlined />,
      label: `Delete ${selectedItems.length} ${selectedItems.length === 1 ? itemType : `${itemType}s`}`,
      onClick: onDelete
    });
  }

  if (showCopy) {
    menuItems.push({
      key: 'copy',
      icon: <CopyOutlined />,
      label: `Copy ${selectedItems.length} ${selectedItems.length === 1 ? itemType : `${itemType}s`}`,
      onClick: onCopy
    });
  }

  if (showMove) {
    menuItems.push({
      key: 'move',
      icon: <SwapOutlined />,
      label: `Move ${selectedItems.length} ${selectedItems.length === 1 ? itemType : `${itemType}s`}`,
      onClick: onMove
    });
  }

  if (showDownload) {
    menuItems.push({
      key: 'download',
      icon: <DownloadOutlined />,
      label: `Download ${selectedItems.length} ${selectedItems.length === 1 ? itemType : `${itemType}s`}`,
      onClick: onDownload
    });
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        backgroundColor: '#f0f2f5',
        borderRadius: '4px',
        marginBottom: '16px'
      }}
    >
      <Text strong>
        {selectedItems.length} {selectedItems.length === 1 ? itemType : `${itemType}s`} selected
      </Text>
      <Dropdown menu={{ items: menuItems }} placement="bottomRight" trigger={['click']}>
        <Button type="text" icon={<MoreOutlined style={{ fontSize: '20px' }} />} />
      </Dropdown>
    </div>
  );
};

export default SelectionHeader;

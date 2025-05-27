import React from 'react';
import { Button } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';

/**
 * A simple component for file selection with a toggle button
 */
const BatchActionsMenu = ({
  selectedItems = [],
  itemType = "file",
  selectionMode = false,
  onToggleSelectionMode,
  onCancelSelection
}) => {
  const handleButtonClick = (e) => {
    e.stopPropagation();
    if (selectionMode) {
      onCancelSelection();
    } else {
      onToggleSelectionMode();
    }
  };

  if (selectionMode) {
    return (
      <Button 
        type="primary"
        icon={<CloseOutlined />}
        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        onClick={handleButtonClick}
      >
        {selectedItems.length > 0 ? `${selectedItems.length} Selected` : 'Cancel'}
      </Button>
    );
  }

  return (
    <Button 
      type="default"
      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
      onClick={handleButtonClick}
    >
      {itemType === 'user' ? 'Select Users' : 'Select Files'}
    </Button>
  );
};

export default BatchActionsMenu;

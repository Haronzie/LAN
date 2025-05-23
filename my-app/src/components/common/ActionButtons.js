import React from 'react';
import { Space, Button, Tooltip } from 'antd';
import {
  FileOutlined,
  DownloadOutlined,
  EditOutlined,
  CopyOutlined,
  SwapOutlined,
  DeleteOutlined,
  MoreOutlined
} from '@ant-design/icons';

// This component ensures that action buttons are properly rendered
const ActionButtons = ({
  record,
  currentUser,
  isSearching,
  onViewFile,
  onDownload,
  onDownloadFolder,
  onRename,
  onCopy,
  onMove,
  onDelete,
  onMoreInfo,
  showMoreInfo = true // Default to showing the more info button
}) => {
  const isOwner = record.type === 'directory'
    ? record.created_by === currentUser
    : record.uploader === currentUser;

  const buttonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    visibility: 'visible',
    opacity: 1
  };

  return (
    <Space style={{ display: 'flex', visibility: 'visible' }}>
      {record.type === 'file' && (
        <Tooltip title="View File">
          <Button
            icon={<FileOutlined />}
            onClick={(e) => {
              e.stopPropagation(); // Prevent row click event
              onViewFile(record);
            }}
            style={buttonStyle}
          />
        </Tooltip>
      )}
      <Tooltip title={record.type === 'directory' ? 'Download Folder' : 'Download File'}>
        <Button
          icon={<DownloadOutlined />}
          onClick={(e) => {
            e.stopPropagation(); // Prevent row click event
            record.type === 'directory'
              ? onDownloadFolder(record.name)
              : isSearching
                ? onDownload(record.name, record.directory)
                : onDownload(record.name);
          }}
          style={buttonStyle}
        />
      </Tooltip>
      {isOwner && (
        <Tooltip title="Rename">
          <Button
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation(); // Prevent row click event
              onRename(record);
            }}
            style={buttonStyle}
          />
        </Tooltip>
      )}
      <Tooltip title="Copy">
        <Button
          icon={<CopyOutlined />}
          onClick={(e) => {
            e.stopPropagation(); // Prevent row click event
            onCopy(record);
          }}
          style={buttonStyle}
        />
      </Tooltip>
      {isOwner && (
        <Tooltip title="Move">
          <Button
            icon={<SwapOutlined />}
            onClick={(e) => {
              e.stopPropagation(); // Prevent row click event
              onMove(record);
            }}
            style={buttonStyle}
          />
        </Tooltip>
      )}
      {isOwner && (
        <Tooltip title={record.type === 'directory' ? 'Delete Folder' : 'Delete File'}>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation(); // Prevent row click event
              onDelete(record);
            }}
            style={buttonStyle}
          />
        </Tooltip>
      )}
      {showMoreInfo && (
        <Tooltip title="More Info">
          <Button
            icon={<MoreOutlined />}
            onClick={(e) => {
              e.stopPropagation(); // Prevent row click event
              onMoreInfo(record);
            }}
            style={buttonStyle}
          />
        </Tooltip>
      )}
    </Space>
  );
};

export default ActionButtons;

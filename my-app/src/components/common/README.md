# Common File Modals

This directory contains reusable modal components for file management operations. These modals follow the DRY (Don't Repeat Yourself) principle and can be used across different dashboard components.

## Available Modals

1. **CreateFolderModal** - For creating new folders
2. **RenameModal** - For renaming files and folders
3. **MoveModal** - For moving items with TreeSelect
4. **MainFolderMoveModal** - For moving items with main folder selection
5. **UploadModal** - For uploading files
6. **CopyModal** - For copying files
7. **FileInfoModal** - For displaying file information

## How to Use

### 1. Import the modals you need

```jsx
import { 
  CreateFolderModal, 
  RenameModal, 
  MoveModal, 
  UploadModal 
} from '../common/FileModals';
```

### 2. Set up state variables

```jsx
// Modal state variables
const [createFolderModal, setCreateFolderModal] = useState(false);
const [newFolderName, setNewFolderName] = useState('');

const [renameModalVisible, setRenameModalVisible] = useState(false);
const [selectedItem, setSelectedItem] = useState(null);
const [renameNewName, setRenameNewName] = useState('');

// ... other state variables as needed
```

### 3. Implement handler functions

```jsx
// Create folder handler
const handleCreateFolder = async () => {
  if (!newFolderName.trim()) {
    message.error('Folder name cannot be empty');
    return;
  }
  try {
    // Your API call here
    setCreateFolderModal(false);
    setNewFolderName('');
    // Refresh data
  } catch (error) {
    message.error('Error creating folder');
  }
};

// ... other handler functions
```

### 4. Use the modals in your component

```jsx
return (
  <div>
    {/* Your component content */}
    
    <CreateFolderModal
      visible={createFolderModal}
      onCancel={() => setCreateFolderModal(false)}
      onOk={handleCreateFolder}
      folderName={newFolderName}
      setFolderName={setNewFolderName}
    />
    
    <RenameModal
      visible={renameModalVisible}
      onCancel={() => setRenameModalVisible(false)}
      onOk={handleRenameConfirm}
      newName={renameNewName}
      setNewName={setRenameNewName}
    />
    
    {/* Other modals as needed */}
  </div>
);
```

## Example Implementation

See `examples/ResearchDashboardExample.js` for a complete example of how to use these modals in a dashboard component.

## Customization

Each modal accepts props that allow you to customize its behavior. The most common props are:

- `visible` - Boolean to control modal visibility
- `onCancel` - Function to call when the modal is closed
- `onOk` - Function to call when the modal's primary action is triggered
- Various state variables and setters specific to each modal

## Benefits

- **Consistency**: All modals have a consistent look and behavior across components
- **Maintainability**: Changes to modal behavior or appearance only need to be made in one place
- **Reduced code duplication**: Eliminates repeated modal code across components
- **Easier testing**: Modal components can be tested independently

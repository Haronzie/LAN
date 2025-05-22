import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Input, message, Modal, Form, Space, Popover, Layout } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserDeleteOutlined,
  InfoCircleOutlined,
  MoreOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import BatchActionsMenu from './common/BatchActionsMenu';
import SelectionHeader from './common/SelectionHeader';
import { batchDeleteUsers } from '../utils/batchOperations';

const { Content } = Layout;

// Using relative URLs - proxy in package.json will handle the backend URL
const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

// Password policy text from your RegisterForm
const passwordPolicyContent = (
  <div style={{ maxWidth: 250 }}>
    <p>Your password should have:</p>
    <ul style={{ paddingLeft: '20px' }}>
      <li>At least 8 characters</li>
      <li>One uppercase letter</li>
      <li>One lowercase letter</li>
      <li>One digit</li>
      <li>One special character (e.g., !@#$)</li>
    </ul>
  </div>
);

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [firstAdmin, setFirstAdmin] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);

  // Modal state for adding user
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [addUserForm] = Form.useForm();

  // Refs for auto-focusing
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  // Modal state for updating user
  const [isUpdateUserModalOpen, setIsUpdateUserModalOpen] = useState(false);
  const [updateForm] = Form.useForm();

  const navigate = useNavigate();

  // Logged-in admin's username from localStorage
  const adminName = localStorage.getItem('username') || 'Admin';

  // Fetch users from the backend
  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Get users list
      const [usersRes, firstAdminRes] = await Promise.all([
        axios.get(`${BASE_URL}/users`, { withCredentials: true }),
        axios.get(`${BASE_URL}/admin-exists`, { withCredentials: true }) // <-- fixed here
      ]);
      
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);

      // Get the first admin information if admin exists
      if (firstAdminRes.data.exists) {
        try {
          const firstAdminInfo = await axios.get(`${BASE_URL}/get-first-admin`, { withCredentials: true });
          setFirstAdmin(firstAdminInfo.data);
        } catch (adminError) {
          console.error('Error fetching first admin:', adminError);
        }
      }
    } catch (error) {
      console.error('Error in fetchUsers:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Error fetching users';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Sort admins first (alphabetically), then users (alphabetically),
  // then apply search filtering.
  useEffect(() => {
    // 1. Sort the entire users array
    const sorted = [...users].sort((a, b) => {
      // If both admin, compare by username
      if (a.role === 'admin' && b.role === 'admin') {
        return a.username.localeCompare(b.username);
      }
      // If a is admin, b is user => a first
      if (a.role === 'admin' && b.role === 'user') {
        return -1;
      }
      // If a is user, b is admin => b first
      if (a.role === 'user' && b.role === 'admin') {
        return 1;
      }
      // If both user => compare by username
      return a.username.localeCompare(b.username);
    });

    // 2. Filter by search term after sorting
    const term = searchTerm.toLowerCase();
    const filtered = term
      ? sorted.filter(u => u.username.toLowerCase().includes(term))
      : sorted;

    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  // Handler for revoking admin privileges
  const handleRevokeAdmin = (username) => {
    Modal.confirm({
      title: 'Revoke Admin Privileges',
      content: `Are you sure you want to revoke admin privileges from '${username}'?`,
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          await axios.post(`${BASE_URL}/revoke-admin`, { username }, { withCredentials: true });
          message.success(`Admin privileges revoked from '${username}'`);
          fetchUsers();
        } catch (error) {
          console.error('Error revoking admin:', error);
          const errorMessage = error.response?.data?.error || error.message || 'Error revoking admin privileges';
          message.error(errorMessage);
        }
      }
    });
  };

  // Handler for adding a new user
  const handleAddUserOk = async () => {
    try {
      const values = await addUserForm.validateFields();
      await axios.post(
        `${BASE_URL}/user/add`,
        { username: values.username, password: values.password },
        { withCredentials: true }
      );
      message.success(`User '${values.username}' has been added successfully`);
      setIsAddUserModalOpen(false);
      addUserForm.resetFields();
      fetchUsers();
    } catch (error) {
      console.error('Error adding user:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Error adding user';
      message.error(errorMessage);
    }
  };

  // Handler for deleting a user
  const handleDeleteUser = (username) => {
    Modal.confirm({
      title: 'Delete User',
      content: `Are you sure you want to delete user '${username}'?`,
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
        await axios.delete(`${BASE_URL}/user/delete`, {
            data: { username },
            withCredentials: true
          });
          message.success(`User '${username}' has been deleted successfully`);
          fetchUsers();
        } catch (error) {
          console.error('Error deleting user:', error);
          const errorMessage = error.response?.data?.error || error.message || 'Error deleting user';
          message.error(errorMessage);
        }
      }
    });
  };

  // Open the update modal and set form fields
  const openUpdateModal = (record) => {
    updateForm.setFieldsValue({
      old_username: record.username,
      new_username: record.username,
      new_password: ''
    });
    setIsUpdateUserModalOpen(true);
  };

  // Handler for updating a user
  const handleUpdateUser = async () => {
    try {
      const values = await updateForm.validateFields();
      await axios.put(
        `${BASE_URL}/user/update`,
        {
          old_username: values.old_username,
          new_username: values.new_username,
          new_password: values.new_password
        },
        { withCredentials: true }
      );
      message.success(`User '${values.old_username}' updated successfully`);
      setIsUpdateUserModalOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Error updating user';

      // Highlight conflict more clearly
      if (errorMessage.toLowerCase().includes("already exists")) {
        message.warning(errorMessage);
      } else {
        message.error(errorMessage);
      }
    }
  };

  // Handler for promoting a user to admin
  const handleAssignAdmin = async (username) => {
    try {
      await axios.post(`${BASE_URL}/assign-admin`, { username }, { withCredentials: true });
      message.success(`User '${username}' is now an admin`);
      fetchUsers();
    } catch (error) {
      console.error('Error assigning admin role:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Error assigning admin role';
      message.error(errorMessage);
    }
  };

  // Handler for batch deleting users
  const handleBatchDeleteUsers = () => {
    if (selectedRows.length === 0) return;

    // Filter out admins and current user from selection
    const deletableUsers = selectedRows.filter(user =>
      user.role !== 'admin' && user.username !== adminName
    );

    if (deletableUsers.length === 0) {
      message.warning('None of the selected users can be deleted. Admins and your own account cannot be deleted.');
      return;
    }

    if (deletableUsers.length !== selectedRows.length) {
      message.warning('Some selected users cannot be deleted (admins or your own account) and will be skipped.');
    }

    Modal.confirm({
      title: 'Delete Multiple Users',
      content: `Are you sure you want to delete ${deletableUsers.length} selected user(s)?`,
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        await batchDeleteUsers(deletableUsers, () => {
          fetchUsers();
          setSelectedRowKeys([]);
          setSelectedRows([]);
        });
      }
    });
  };

  // Toggle selection mode
  const handleToggleSelectionMode = () => {
    setSelectionMode(true);
  };

  // Cancel selection mode
  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedRowKeys([]);
    setSelectedRows([]);
  };

  // Row selection configuration
  const rowSelection = selectionMode ? {
    selectedRowKeys,
    onChange: (keys, rows) => {
      setSelectedRowKeys(keys);
      setSelectedRows(rows);
    }
  } : null;

  // Table columns
  const columns = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username'
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record) => {
        // Conditions:
        // 1) Hide the "Delete" button if record.role === 'admin' OR record.username === adminName
        const canDelete = !(record.role === 'admin' || record.username === adminName);
        // 2) Only edit if record.role === 'user' OR record.username === adminName
        const canEdit = record.role === 'user' || record.username === adminName;
        // 3) Show revoke admin button only if:
        //    - The current user is the first admin
        //    - The record is an admin
        //    - The record is not the first admin themselves
        const canRevokeAdmin = firstAdmin &&
                              firstAdmin.username === adminName &&
                              record.role === 'admin' &&
                              record.username !== firstAdmin.username;

        return (
          <Space>
            {canEdit && (
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => openUpdateModal(record)}
              >
                Edit
              </Button>
            )}
            {canDelete && (
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteUser(record.username)}
              >
                Delete
              </Button>
            )}
            {record.role !== 'admin' && (
              <Button
                size="small"
                type="default"
                onClick={() => handleAssignAdmin(record.username)}
              >
                Make Admin
              </Button>
            )}
            {canRevokeAdmin && (
              <Button
                size="small"
                danger
                icon={<UserDeleteOutlined />}
                onClick={() => handleRevokeAdmin(record.username)}
              >
                Revoke Admin
              </Button>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <Layout style={{ minHeight: '91vh', background: '#f0f2f5' }}>
      <Content style={{ margin: '24px', padding: '24px', background: '#fff' }}>
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <h2 style={{ textAlign: 'center', margin: 0 }}></h2>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsAddUserModalOpen(true)}
            style={{ position: 'absolute', right: 0, top: 0 }}
          >
            Add User
          </Button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search by username"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 300, marginRight: 16 }}
          />
          <BatchActionsMenu
            selectedItems={selectedRows}
            onDelete={handleBatchDeleteUsers}
            showCopy={false}
            showMove={false}
            showDownload={false}
            itemType="user"
            selectionMode={selectionMode}
            onToggleSelectionMode={handleToggleSelectionMode}
            onCancelSelection={handleCancelSelection}
          />
        </div>



        {selectionMode && selectedRows.length > 0 && (
          <SelectionHeader
            selectedItems={selectedRows}
            onDelete={handleBatchDeleteUsers}
            showCopy={false}
            showMove={false}
            showDownload={false}
            itemType="user"
            onCancelSelection={handleCancelSelection}
          />
        )}

        <Table
          columns={columns}
          dataSource={filteredUsers}
          rowKey="username"
          loading={loading}
          pagination={false}
          scroll={{ y: '60vh' }} // this keeps header fixed, body scrolls
          rowSelection={rowSelection}
        />

        {/* Add User Modal */}
        <Modal
          open={isAddUserModalOpen}
          title="Add New User"
          onCancel={() => {
            addUserForm.resetFields();
            setIsAddUserModalOpen(false);
          }}
          onOk={handleAddUserOk}
          okText="Add"
          destroyOnClose
          centered
        >
          <Form form={addUserForm} layout="vertical">
            <Form.Item
              label="Username"
              name="username"
              rules={[{ required: true, message: 'Please input a username!' }]}
            >
              <Input
                ref={usernameRef}
                placeholder="Enter new username"
                onPressEnter={() => {
                  if (passwordRef.current) {
                    passwordRef.current.focus({ cursor: 'end' });
                  }
                }}
              />
            </Form.Item>

            {/* Password field with popover hint */}
            <Form.Item
              label={
                <span>
                  Password
                  <Popover content={passwordPolicyContent} title="Password Requirements">
                    <InfoCircleOutlined style={{ marginLeft: 8, color: '#1890ff', cursor: 'pointer' }} />
                  </Popover>
                </span>
              }
              name="password"
              rules={[{ required: true, message: 'Please input a password!' }]}
            >
              <Input.Password
                ref={passwordRef}
                placeholder="Enter new user password"
                onPressEnter={handleAddUserOk}
              />
            </Form.Item>
          </Form>
        </Modal>

        {/* Update User Modal */}
        <Modal
          open={isUpdateUserModalOpen}
          title="Update User"
          onCancel={() => setIsUpdateUserModalOpen(false)}
          onOk={handleUpdateUser}
          okText="Update"
          destroyOnClose
        >
          <Form form={updateForm} layout="vertical">
            <Form.Item name="old_username" label="Old Username">
              <Input disabled />
            </Form.Item>
            <Form.Item
              name="new_username"
              label="New Username"
              rules={[{ required: true, message: 'Please input the new username!' }]}
            >
              <Input placeholder="Enter new username" />
            </Form.Item>
            <Form.Item
              name="new_password"
              label={
                <span>
                  New Password&nbsp;
                  <Popover content={passwordPolicyContent} title="Password Requirements">
                    <InfoCircleOutlined style={{ color: '#1890ff', cursor: 'pointer' }} />
                  </Popover>
                </span>
              }
              rules={[
                { required: true, message: 'Please input the new password!' },
                {
                  pattern: new RegExp(
                    "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*])[A-Za-z\\d!@#$%^&*]{8,}$"
                  ),
                  message:
                    'Password must be at least 8 characters long, include uppercase, lowercase, a number, and a special character'
                }
              ]}
            >
              <Input.Password placeholder="Enter new password" />
            </Form.Item>
          </Form>
        </Modal>
      </Content>
    </Layout>
  );
};

export default UserManagement;

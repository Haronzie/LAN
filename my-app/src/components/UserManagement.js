import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Input, message, Modal, Form, Space, Popover } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

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

  // Modal state for adding user
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [addUserForm] = Form.useForm();

  // Refs for auto-focusing
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  // Modal state for updating user
  const [isUpdateUserModalOpen, setIsUpdateUserModalOpen] = useState(false);
  const [currentUserToUpdate, setCurrentUserToUpdate] = useState(null);
  const [updateForm] = Form.useForm();

  const navigate = useNavigate();

  // Logged-in admin’s username from localStorage
  const adminName = localStorage.getItem('username') || 'Admin';

  // Fetch users from the backend
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/users', { withCredentials: true });
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      const errMsg = error.response?.data?.error || 'Error fetching users';
      message.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    setFilteredUsers(
      term ? users.filter(u => u.username.toLowerCase().includes(term)) : users
    );
  }, [searchTerm, users]);

  // Handler for adding a new user
  const handleAddUserOk = async () => {
    try {
      const values = await addUserForm.validateFields();
      await axios.post(
        '/user/add',
        { username: values.username, password: values.password },
        { withCredentials: true }
      );
      message.success(`User '${values.username}' has been added successfully`);
      setIsAddUserModalOpen(false);
      addUserForm.resetFields();
      fetchUsers();
    } catch (error) {
      const errMsg = error.response?.data?.error || 'Error adding user';
      message.error(errMsg);
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
          await axios.delete('/user/delete', {
            data: { username },
            withCredentials: true
          });
          message.success(`User '${username}' has been deleted successfully`);
          fetchUsers();
        } catch (error) {
          const errMsg = error.response?.data?.error || 'Error deleting user';
          message.error(errMsg);
        }
      }
    });
  };

  // Open the update modal and set form fields
  const openUpdateModal = (record) => {
    setCurrentUserToUpdate(record);
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
        '/user/update',
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
      const errMsg = error.response?.data?.error || 'Error updating user';
      message.error(errMsg);
    }
  };

  // Handler for promoting a user to admin
  const handleAssignAdmin = async (username) => {
    try {
      await axios.post('/assign-admin', { username }, { withCredentials: true });
      message.success(`User '${username}' is now an admin`);
      fetchUsers();
    } catch (error) {
      const errMsg = error.response?.data?.error || 'Error assigning admin role';
      message.error(errMsg);
    }
  };

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
        // Conditions to hide the delete button:
        // 1) if record.role === 'admin'
        // 2) or if record.username === adminName
        const canDelete = !(record.role === 'admin' || record.username === adminName);

        return (
          <Space>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openUpdateModal(record)}
            >
              Edit
            </Button>
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
          </Space>
        );
      }
    }
  ];

  return (
    <div style={{ padding: 24, background: '#fff', minHeight: 360 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin')}>
          Back to Dashboard
        </Button>
        <h2>User Management</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsAddUserModalOpen(true)}
        >
          Add User
        </Button>
      </div>

      <Input
        placeholder="Search by username"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ width: 300, marginBottom: 16 }}
      />

      <Table
        columns={columns}
        dataSource={filteredUsers}
        rowKey="username"
        loading={loading}
        pagination={{ pageSize: 10 }}
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
            label="New Password"
            rules={[{ required: true, message: 'Please input the new password!' }]}
          >
            <Input.Password placeholder="Enter new password" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;

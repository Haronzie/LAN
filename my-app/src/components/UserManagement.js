import React, { useState, useEffect } from 'react';
import { Table, Button, Input, message, Modal, Form, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AddUserForm from './AddUserForm';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddUserModalVisible, setIsAddUserModalVisible] = useState(false);
  const [isUpdateUserModalVisible, setIsUpdateUserModalVisible] = useState(false);
  const [currentUserToUpdate, setCurrentUserToUpdate] = useState(null);

  const navigate = useNavigate();
  const [updateForm] = Form.useForm();

  // Fetch all users from your API
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/users', { withCredentials: true });
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      message.error('Error fetching users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    setFilteredUsers(term ? users.filter(u => u.username.toLowerCase().includes(term)) : users);
  }, [searchTerm, users]);

  // Calculate the number of admin users
  const adminCount = users.filter(u => u.role === 'admin').length;

  // Get the currently logged-in admin's username (stored in localStorage)
  const adminName = localStorage.getItem("username") || "Admin";

  // Toggle active status for a user
  const handleToggleActive = async (username, isActive) => {
    try {
      await axios.put(
        '/update-user-status',
        { username, active: !isActive },
        { withCredentials: true }
      );
      message.success(`User '${username}' is now ${!isActive ? 'activated' : 'deactivated'}`);
      fetchUsers();
    } catch (error) {
      message.error('Error updating user status');
    }
  };

  // Add user using the API
  const handleAddUser = async (values) => {
    try {
      await axios.post(
        '/add-user',
        { username: values.username, password: values.password },
        { withCredentials: true }
      );
      message.success(`User '${values.username}' has been added successfully`);
      setIsAddUserModalVisible(false);
      fetchUsers();
    } catch (error) {
      message.error('Error adding user');
    }
  };

  // Delete user using the API (hide delete for the currently logged-in admin)
  const handleDeleteUser = (username) => {
    Modal.confirm({
      title: 'Delete User',
      content: `Are you sure you want to delete user '${username}'?`,
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          await axios.delete(
            '/delete-user',
            { data: { username }, withCredentials: true }
          );
          message.success(`User '${username}' has been deleted successfully`);
          fetchUsers();
        } catch (error) {
          message.error('Error deleting user');
        }
      }
    });
  };

  // Open the update modal and populate with current user data
  const openUpdateModal = (record) => {
    setCurrentUserToUpdate(record);
    updateForm.setFieldsValue({
      old_username: record.username,
      new_username: record.username,
      new_password: ''
    });
    setIsUpdateUserModalVisible(true);
  };

  // Update user using the API
  const handleUpdateUser = async () => {
    try {
      const values = await updateForm.validateFields();
      await axios.put(
        '/update-user',
        {
          old_username: values.old_username,
          new_username: values.new_username,
          new_password: values.new_password
        },
        { withCredentials: true }
      );
      message.success(`User '${values.old_username}' updated successfully`);
      setIsUpdateUserModalVisible(false);
      fetchUsers();
    } catch (error) {
      message.error('Error updating user');
    }
  };

  // Assign admin role using the API
  const handleAssignAdmin = async (username) => {
    try {
      await axios.post(
        '/assign-admin',
        { username },
        { withCredentials: true }
      );
      message.success(`User '${username}' is now an admin`);
      fetchUsers();
    } catch (error) {
      message.error('Error assigning admin role');
    }
  };

  // Table columns including action buttons for toggle, edit, delete, and assign admin
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
      title: 'Active',
      dataIndex: 'active',
      key: 'active',
      render: (active) => (active ? 'Yes' : 'No')
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record) => (
        <Space>
          {(record.role !== 'admin' || (record.role === 'admin' && adminCount > 1)) && (
            <Button
              size="small"
              onClick={() => handleToggleActive(record.username, record.active)}
            >
              {record.active ? 'Deactivate' : 'Activate'}
            </Button>
          )}
          <Button size="small" icon={<EditOutlined />} onClick={() => openUpdateModal(record)}>
            Edit
          </Button>
          {record.username !== adminName && (
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
            <Button size="small" type="default" onClick={() => handleAssignAdmin(record.username)}>
              Make Admin
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24, background: '#fff', minHeight: 360 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin')}>
          Back to Dashboard
        </Button>
        <h2>User Management</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsAddUserModalVisible(true)}>
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

      {/* Modal for Adding a New User */}
      <AddUserForm
        visible={isAddUserModalVisible}
        onCancel={() => setIsAddUserModalVisible(false)}
        onAddUser={handleAddUser}
      />

      {/* Modal for Updating a User */}
      <Modal
        visible={isUpdateUserModalVisible}
        title="Update User"
        onCancel={() => setIsUpdateUserModalVisible(false)}
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

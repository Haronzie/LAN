import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Input, message, Modal, Form, Space } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

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

  // Fetch users
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
    setFilteredUsers(
      term ? users.filter(u => u.username.toLowerCase().includes(term)) : users
    );
  }, [searchTerm, users]);

  const adminCount = users.filter(u => u.role === 'admin').length;
  const adminName = localStorage.getItem('username') || 'Admin';

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

  // Handler for adding a user
  const handleAddUserOk = async () => {
    try {
      const values = await addUserForm.validateFields();
      await axios.post(
        '/add-user',
        { username: values.username, password: values.password },
        { withCredentials: true }
      );
      message.success(`User '${values.username}' has been added successfully`);
      setIsAddUserModalOpen(false);
      addUserForm.resetFields();
      fetchUsers();
    } catch (error) {
      message.error('Error adding user');
    }
  };

  const handleDeleteUser = (username) => {
    Modal.confirm({
      title: 'Delete User',
      content: `Are you sure you want to delete user '${username}'?`,
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          await axios.delete('/delete-user', { data: { username }, withCredentials: true });
          message.success(`User '${username}' has been deleted successfully`);
          fetchUsers();
        } catch (error) {
          message.error('Error deleting user');
        }
      }
    });
  };

  const openUpdateModal = (record) => {
    setCurrentUserToUpdate(record);
    updateForm.setFieldsValue({
      old_username: record.username,
      new_username: record.username,
      new_password: ''
    });
    setIsUpdateUserModalOpen(true);
  };

  const handleUpdateUser = async () => {
    try {
      const values = await updateForm.validateFields();
      await axios.put(
        '/update-user',
        { old_username: values.old_username, new_username: values.new_username, new_password: values.new_password },
        { withCredentials: true }
      );
      message.success(`User '${values.old_username}' updated successfully`);
      setIsUpdateUserModalOpen(false);
      fetchUsers();
    } catch (error) {
      message.error('Error updating user');
    }
  };

  const handleAssignAdmin = async (username) => {
    try {
      await axios.post('/assign-admin', { username }, { withCredentials: true });
      message.success(`User '${username}' is now an admin`);
      fetchUsers();
    } catch (error) {
      message.error('Error assigning admin role');
    }
  };

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
        afterOpenChange={(open) => {
          if (open && usernameRef.current) {
            // Focus username input after modal is fully open
            setTimeout(() => {
              usernameRef.current.focus({ cursor: 'end' });
            }, 50);
          }
        }}
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
          <Form.Item
            label="Password"
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

import React from 'react';
import { Modal, Form, Input } from 'antd';

const AddUserForm = ({ visible, onCancel, onAddUser }) => {
  const [form] = Form.useForm();

  const handleOk = () => {
    form.validateFields()
      .then(values => {
        onAddUser(values);
        form.resetFields();
      })
      .catch(info => {
        console.log('Validation Failed:', info);
      });
  };

  return (
    <Modal
      visible={visible}
      title="Add New User"
      onCancel={onCancel}
      onOk={handleOk}
      destroyOnClose
      okText="Add"
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="Username"
          name="username"
          rules={[{ required: true, message: 'Please input a username!' }]}
        >
          <Input placeholder="Enter new username" />
        </Form.Item>
        <Form.Item
          label="Password"
          name="password"
          rules={[{ required: true, message: 'Please input a password!' }]}
        >
          <Input.Password 
            placeholder="Enter new user password" 
            onPressEnter={handleOk}  // Auto-submit on Enter
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddUserForm;

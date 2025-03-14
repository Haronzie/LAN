import React, { useRef } from 'react';
import { Modal, Form, Input } from 'antd';

const AddUserForm = ({ visible, onCancel, onAddUser }) => {
  const [form] = Form.useForm();
  const passwordInputRef = useRef(null);

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
          <Input
            placeholder="Enter new username"
            autoFocus
            onPressEnter={() => {
              // Shift focus to the password input when Enter is pressed.
              if (passwordInputRef.current) {
                passwordInputRef.current.focus();
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
            placeholder="Enter new user password"
            ref={passwordInputRef}
            onPressEnter={handleOk}  // Submit the form on Enter
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddUserForm;

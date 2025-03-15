import React, { useRef, useEffect } from 'react';
import { Modal, Form, Input, Typography } from 'antd';

const { Title } = Typography;

const AddUserForm = ({ visible, onCancel, onAddUser }) => {
  const [form] = Form.useForm();

  // Refs for username/password fields
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  // Whenever the modal goes from hidden to visible, focus the username input.
  useEffect(() => {
    if (visible && usernameRef.current) {
      // A short delay can help if the modal is animating into view
      setTimeout(() => {
        usernameRef.current.focus({ cursor: 'end' });
      }, 50);
    }
  }, [visible]);

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
      title={<Title level={4}>Add New User</Title>}
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={handleOk}
      destroyOnClose
      okText="Add"
      centered
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="Username"
          name="username"
          rules={[{ required: true, message: 'Please input a username!' }]}
        >
          <Input
            ref={usernameRef}
            placeholder="Enter new username"
            onPressEnter={() => {
              // Move focus to password input when Enter is pressed in username.
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
            onPressEnter={handleOk} // Pressing Enter here submits the form
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddUserForm;

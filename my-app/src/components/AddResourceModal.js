import React from 'react';
import { Modal, Form, Select, Input, Button, message } from 'antd';
import axios from 'axios';

const { Option } = Select;

const AddResourceModal = ({ visible, onClose, refreshResources }) => {
  const [form] = Form.useForm();

  const handleSubmit = async (values) => {
    try {
      // Post the new resource to the backend API.
      await axios.post('/create-resource', values, { withCredentials: true });
      message.success(
        `${values.resource_type === 'directory' ? 'Directory' : 'File'} created successfully`
      );
      form.resetFields();
      onClose();
      // Optionally refresh the resources list.
      if (refreshResources) refreshResources();
    } catch (error) {
      message.error(error.response?.data?.error || 'Error creating resource');
    }
  };

  return (
    <Modal
      visible={visible}
      title="Add New Resource"
      onCancel={onClose}
      footer={null}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="resource_type"
          label="Resource Type"
          rules={[{ required: true, message: 'Please select a resource type' }]}
        >
          <Select placeholder="Select resource type">
            <Option value="file">File</Option>
            <Option value="directory">Directory</Option>
          </Select>
        </Form.Item>
        <Form.Item
          name="name"
          label="Name"
          rules={[{ required: true, message: 'Please enter a name' }]}
        >
          <Input placeholder="Enter file or directory name" />
        </Form.Item>
        {/* Only show the content field when creating a file */}
        <Form.Item noStyle shouldUpdate={(prev, curr) => prev.resource_type !== curr.resource_type}>
          {({ getFieldValue }) =>
            getFieldValue('resource_type') === 'file' ? (
              <Form.Item name="content" label="Content">
                <Input.TextArea placeholder="Optional file content" />
              </Form.Item>
            ) : null
          }
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">
            Create Resource
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddResourceModal;

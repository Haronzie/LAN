import React, { useEffect, useState } from 'react';
import { Layout, Card, Form, Input, Button, Switch, Upload, message, Typography } from 'antd';
import { ArrowLeftOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Content } = Layout;
const { Title, Paragraph } = Typography;

const UserSettings = () => {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({ email: '', username: '' });
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // Fetch the user's profile on component mount.
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get('/api/user/profile', { withCredentials: true });
        setProfile(res.data);
        form.setFieldsValue({ email: res.data.email });
      } catch (error) {
        message.error('Failed to fetch profile');
      }
    };
    fetchProfile();
  }, [form]);

  const handleUpdate = async (values) => {
    setLoading(true);
    try {
      // Update the user's profile. Adjust the API endpoint as needed.
      await axios.put('/api/user/profile', values, { withCredentials: true });
      message.success('Settings updated successfully!');
      // Optionally, if the password was changed, you might want to force a logout.
    } catch (error) {
      message.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      <Content style={{ maxWidth: 600, margin: '0 auto' }}>
        {/* Back to Dashboard button */}
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/user/home')}
          style={{ marginBottom: '16px', fontSize: '16px' }}
        >
          Back to Dashboard
        </Button>

        <Card
          title="User Settings"
          bordered={false}
          style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', marginBottom: '24px' }}
        >
          <Title level={4}>Update Your Profile</Title>
          <Form layout="vertical" form={form} onFinish={handleUpdate}>
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: 'Please input your email' },
                { type: 'email', message: 'Please input a valid email' }
              ]}
            >
              <Input placeholder="Enter your email" />
            </Form.Item>
            <Form.Item
              label="Change Password"
              name="newPassword"
              rules={[
                { required: false, message: 'Please input your new password if you wish to change it' }
              ]}
            >
              <Input.Password placeholder="Enter new password (leave blank to keep current)" />
            </Form.Item>
            <Form.Item
              label="Receive Notifications"
              name="notifications"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>
                Save Changes
              </Button>
            </Form.Item>
          </Form>
          <Paragraph type="secondary">
            Note: Changing your password may require you to log in again.
          </Paragraph>
        </Card>

        <Card
          title="Profile Picture"
          bordered={false}
          style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
        >
          <Upload
            name="file"
            action="/api/user/upload-profile"
            listType="picture"
            showUploadList={false}
            withCredentials
            onChange={(info) => {
              if (info.file.status === 'done') {
                message.success('Profile picture updated successfully!');
              } else if (info.file.status === 'error') {
                message.error('Failed to update profile picture');
              }
            }}
          >
            <Button icon={<UploadOutlined />}>Update Profile Picture</Button>
          </Upload>
        </Card>
      </Content>
    </Layout>
  );
};

export default UserSettings;

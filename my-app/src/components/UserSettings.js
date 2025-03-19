import React, { useState, useEffect } from 'react';
import {
  Layout,
  Card,
  Switch,
  Button,
  Typography,
  message
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Content } = Layout;
const { Title, Paragraph } = Typography;

const UserSettings = () => {
  const navigate = useNavigate();

  // Local UI preferences
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(false);

  // On mount, load stored preferences from localStorage
  useEffect(() => {
    const storedDarkMode = localStorage.getItem('darkMode');
    const storedNotifications = localStorage.getItem('notifications');
    if (storedDarkMode) {
      setDarkMode(JSON.parse(storedDarkMode));
    }
    if (storedNotifications) {
      setNotifications(JSON.parse(storedNotifications));
    }
  }, []);

  // Handler to save toggles in localStorage
  const handleSave = () => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    localStorage.setItem('notifications', JSON.stringify(notifications));
    message.success('Settings saved locally!');
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
          style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
        >
          <Title level={4}>Local Preferences</Title>
          <div style={{ marginBottom: 16 }}>
            <Paragraph strong>Dark Mode</Paragraph>
            <Switch
              checked={darkMode}
              onChange={(checked) => setDarkMode(checked)}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <Paragraph strong>Enable Notifications</Paragraph>
            <Switch
              checked={notifications}
              onChange={(checked) => setNotifications(checked)}
            />
          </div>
          <Button type="primary" onClick={handleSave}>
            Save Settings
          </Button>

          <Paragraph type="secondary" style={{ marginTop: 16 }}>
            These preferences are stored locally and won’t affect other users on the LAN.
          </Paragraph>
        </Card>
      </Content>
    </Layout>
  );
};

export default UserSettings;

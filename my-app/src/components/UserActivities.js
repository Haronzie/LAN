import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layout, 
  Table, 
  Button, 
  Typography, 
  Space, 
  message, 
  Card, 
  Row, 
  Col, 
  Tag, 
  Tooltip,
  Statistic
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { 
  UserDeleteOutlined, 
  EditOutlined, 
  LockOutlined, 
  LoginOutlined, 
  LogoutOutlined,
  ReloadOutlined,
  TeamOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const { Content } = Layout;
const { Title, Text } = Typography;

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

const UserActivities = () => {
  const [activities, setActivities] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(false);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  
  // Define user columns for the users table
  const userColumns = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={role === 'admin' ? 'geekblue' : 'green'}>
          {role.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="link" 
            icon={<LogoutOutlined />} 
            onClick={() => handleLogoutUser(record.id)}
            disabled={!isAdmin}
          >
            Logout
          </Button>
          <Button 
            type="link" 
            danger 
            icon={<LockOutlined />} 
            onClick={() => handleRevokeUser(record.id)}
            disabled={!isAdmin}
          >
            Revoke
          </Button>
          <Button 
            type="link" 
            danger 
            icon={<UserDeleteOutlined />} 
            onClick={() => handleDeleteUser(record.id)}
            disabled={!isAdmin}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];
  
  // Initialize activity stats with default values
  const [activityStats, setActivityStats] = useState({
    logins: 0,
    logouts: 0,
    revoked: 0,
    edits: 0,
    deletions: 0
  });
  
  // Filter activities to show only admin-related actions and login/logout
  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      if (!activity.event) return false;
      const event = activity.event.toLowerCase();
      return (
        event.includes('admin') ||
        event.includes('revoke') ||
        event.includes('edit') ||
        event.includes('delete') ||
        event.includes('login') ||
        event.includes('logout')
      );
    });
  }, [activities]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/activities`, { withCredentials: true });
      const activitiesData = Array.isArray(res.data) ? res.data : [];
      setActivities(activitiesData);
      
      // Calculate activity stats
      const stats = activitiesData.reduce((acc, activity) => {
        if (!activity.event) return acc;
        const event = activity.event.toLowerCase();
        if (event.includes('login')) acc.logins++;
        else if (event.includes('logout')) acc.logouts++;
        else if (event.includes('revoke')) acc.revoked++;
        else if (event.includes('edit')) acc.edits++;
        else if (event.includes('delete')) acc.deletions++;
        return acc;
      }, { logins: 0, logouts: 0, revoked: 0, edits: 0, deletions: 0 });
      
      setActivityStats(stats);
    } catch (error) {
      console.error('Error fetching activities:', error);
      message.error('Failed to load user activities');
      setActivities([]);
      setActivityStats({ logins: 0, logouts: 0, revoked: 0, edits: 0, deletions: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      if (!isAdmin) return;
      setUserLoading(true);
      try {
        const res = await axios.get(`${BASE_URL}/api/users`, { withCredentials: true });
        setUsers(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error('Error fetching users:', error);
        message.error('Failed to load users');
        setUsers([]);
      } finally {
        setUserLoading(false);
      }
    };

    fetchActivities();
    fetchUsers();
  }, [isAdmin]);

  const handleLogoutUser = async (userId) => {
    try {
      await axios.post(`${BASE_URL}/api/users/${userId}/logout`, {}, { withCredentials: true });
      message.success('User logged out successfully');
      fetchActivities(); // Refresh activities
    } catch (error) {
      console.error('Error logging out user:', error);
      message.error('Failed to log out user');
    }
  };

  const handleRevokeUser = async (userId) => {
    try {
      await axios.post(`${BASE_URL}/api/users/${userId}/revoke`, {}, { withCredentials: true });
      message.success('User access revoked successfully');
      fetchActivities(); // Refresh activities
    } catch (error) {
      console.error('Error revoking user access:', error);
      message.error('Failed to revoke user access');
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await axios.delete(`${BASE_URL}/api/users/${userId}`, { withCredentials: true });
      message.success('User deleted successfully');
      // Refresh users list and activities
      fetchActivities();
      if (isAdmin) {
        const res = await axios.get(`${BASE_URL}/api/users`, { withCredentials: true });
        setUsers(Array.isArray(res.data) ? res.data : []);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      message.error('Failed to delete user');
    }
  };

  const getActivityIcon = (event) => {
    const eventLower = event.toLowerCase();
    if (eventLower.includes('login')) return <LoginOutlined style={{ color: '#52c41a' }} />;
    if (eventLower.includes('logout')) return <LogoutOutlined style={{ color: '#faad14' }} />;
    if (eventLower.includes('revoke')) return <LockOutlined style={{ color: '#f5222d' }} />;
    if (eventLower.includes('edit')) return <EditOutlined style={{ color: '#1890ff' }} />;
    if (eventLower.includes('delete')) return <UserDeleteOutlined style={{ color: '#722ed1' }} />;
    return <TeamOutlined />;
  };

  const getActivityTag = (event) => {
    const eventLower = event.toLowerCase();
    if (eventLower.includes('login')) return <Tag color="green">Login</Tag>;
    if (eventLower.includes('logout')) return <Tag color="orange">Logout</Tag>;
    if (eventLower.includes('revoke')) return <Tag color="red">Access Revoked</Tag>;
    if (eventLower.includes('edit')) return <Tag color="blue">Account Edited</Tag>;
    if (eventLower.includes('delete')) return <Tag color="purple">Account Deleted</Tag>;
    return <Tag>Activity</Tag>;
  };

  const columns = [
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (ts) => new Date(ts).toLocaleString(),
      sorter: (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
      defaultSortOrder: 'descend',
      sortDirections: ['descend', 'ascend'],
      width: 180,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space>
          {getActivityIcon(record.event)}
          {getActivityTag(record.event)}
        </Space>
      ),
      width: 200,
    },
    {
      title: 'Details',
      dataIndex: 'event',
      key: 'event',
      render: (text) => (
        <Text style={{ fontSize: '14px' }}>
          {text || 'No details available'}
        </Text>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content
        style={{
          margin: '24px',
          padding: '24px',
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <Title level={2} style={{ margin: 0 }}>User Management</Title>
          <Space>
            <Button 
              type="primary" 
              onClick={() => navigate('/admin')}
            >
              Back to Dashboard
            </Button>
          </Space>
        </div>

{isAdmin && (
          <>
            <Title level={4} style={{ margin: '24px 0 16px' }}>User List</Title>
            <Table
              loading={userLoading}
              columns={userColumns}
              dataSource={users}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: ['5', '10', '20'],
              }}
              style={{ marginBottom: '32px' }}
            />
          </>
        )}
        
        <Title level={4} style={{ margin: '24px 0 16px' }}>Activity Statistics</Title>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={4}>
            <Card size="small">
              <Statistic 
                title="Logins" 
                value={activityStats.logins} 
                prefix={<LoginOutlined style={{ color: '#52c41a' }} />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Card size="small">
              <Statistic 
                title="Logouts" 
                value={activityStats.logouts} 
                prefix={<LogoutOutlined style={{ color: '#faad14' }} />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Card size="small">
              <Statistic 
                title="Account Edits" 
                value={activityStats.edits} 
                prefix={<EditOutlined style={{ color: '#1890ff' }} />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Card size="small">
              <Statistic 
                title="Access Revoked" 
                value={activityStats.revoked} 
                prefix={<LockOutlined style={{ color: '#f5222d' }} />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Card size="small">
              <Statistic 
                title="Account Deletions" 
                value={activityStats.deletions} 
                prefix={<UserDeleteOutlined style={{ color: '#722ed1' }} />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Card size="small">
              <Statistic 
                title="Total Actions" 
                value={filteredActivities.length} 
                prefix={<TeamOutlined style={{ color: '#13c2c2' }} />} 
              />
            </Card>
          </Col>
        </Row>

        <Card 
          title={
            <span>
              <TeamOutlined style={{ marginRight: 8 }} />
              Recent User Management Activities
            </span>
          }
          extra={
            <Text type="secondary">
              Showing {filteredActivities.length} activities
            </Text>
          }
          bordered={false}
        >
          <Table
            loading={loading}
            columns={columns}
            dataSource={filteredActivities}
            rowKey={(record, idx) => record.id || record.timestamp + idx}
            scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: { goButton: <Button size="small">Go</Button> },
              showTotal: (total, range) => (
                <span style={{ marginRight: 16, lineHeight: '32px' }}>
                  {`${range[0]}-${range[1]} of ${total} items`}
                </span>
              ),
              pageSizeOptions: ['10', '20', '50', '100'],
              style: { 
                margin: 0,
                padding: '12px 16px',
                backgroundColor: '#fafafa',
                borderTop: '1px solid #f0f0f0',
                position: 'sticky',
                bottom: 0,
                zIndex: 1,
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                alignItems: 'center',
                borderRadius: '0 0 8px 8px'
              },
              itemRender: (_, type, originalElement) => {
                if (type === 'prev') {
                  return <Button size="small" icon={<LeftOutlined />}>Previous</Button>;
                }
                if (type === 'next') {
                  return <Button size="small">Next<RightOutlined /></Button>;
                }
                if (type === 'jump-prev' || type === 'jump-next') {
                  return <span style={{ padding: '0 8px' }}>•••</span>;
                }
                return originalElement;
              },
              showLessItems: true
            }}
            components={{
              body: {
                wrapper: (props) => (
                  <div style={{ display: 'flex', flexDirection: 'column', minHeight: '500px' }}>
                    <div style={{ flex: 1, overflow: 'auto' }}>
                      {props.children}
                    </div>
                  </div>
                ),
              },
              pagination: (props) => {
                const { className, style, ...restProps } = props;
                return (
                  <div style={{ 
                    ...style, 
                    position: 'sticky',
                    bottom: 0,
                    background: '#fff',
                    zIndex: 1,
                    borderTop: '1px solid #f0f0f0',
                    padding: '12px 16px',
                    margin: 0
                  }}>
                    {React.cloneElement(props.defaultNode, {
                      style: { ...props.defaultNode.props.style, margin: 0 }
                    })}
                  </div>
                );
              }
            }}
            style={{ 
              width: '100%',
              overflow: 'auto',
              borderRadius: '8px',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)'
            }}
          />
        </Card>
      </Content>
    </Layout>
  );
};

export default UserActivities;

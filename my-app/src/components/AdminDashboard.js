import React, { useState, useEffect, useRef } from 'react';
import {
  Layout,
  Menu,
  Button,
  Typography,
  message,
  ConfigProvider,
  Badge
} from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  SettingOutlined,
  FileOutlined,
  MenuOutlined,
  BellOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import axios from 'axios';
import NotificationDropdown from './common/NotificationDropdown';
import UserActivities from './UserActivities';
import './dashboard-fix.css'; // Import dashboard CSS fixes

// Welcome Message Component
const WelcomeMessage = ({ name }) => {
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    // Show the message after a short delay when the component mounts
    const timer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div 
      style={{
        position: 'fixed',
        top: '80px',
        right: '20px',
        padding: '12px 24px',
        backgroundColor: '#1890ff',
        color: 'white',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        opacity: visible ? 1 : 0,
        transition: 'all 0.5s ease-out',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}
    >
      <span>👋</span>
      <span>Welcome back, <strong>{name}</strong>!</span>
    </div>
  );
};

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

// Using relative URLs - proxy in package.json will handle the backend URL

const AdminDashboard = () => {
  const [adminName, setAdminName] = useState('Admin');
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const siderRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const pathParts = location.pathname.split('/');
  const currentSection = location.pathname.split('/')[2] || 'dashboard';
  const sectionTitles = {
    dashboard: 'Home Dashboard',
    users: 'User Management',
    files: 'File Manager',
    settings: 'Settings'
  };


  const pageTitle = sectionTitles[currentSection] || 'Dashboard';

  useEffect(() => {
    const storedName = localStorage.getItem('username');
    if (storedName) setAdminName(storedName);
  }, []);

  const handleLogout = async () => {
    try {
      const baseUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
      await axios.post(`${baseUrl}/logout`, {}, { 
        withCredentials: true,
        timeout: 5000 // Add timeout to prevent long-waiting requests
      });

      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      message.success('Logout successful');
      navigate('/login');
    } catch (error) {
      console.log('Logout error:', error);
      message.warning('Logout from server failed, but you\'ve been logged out locally.');
      navigate('/login');
    }
  };


  const toggleSidebar = () => setCollapsed(!collapsed);

  const handleBreakpoint = (broken) => {
    setIsMobile(broken);
    setCollapsed(broken);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMobile && !collapsed && siderRef.current && !siderRef.current.contains(event.target)) {
        setCollapsed(true);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobile, collapsed]);

  // Use programmatic navigation with the navigate function instead of Link components
  const handleMenuClick = (path) => {
    navigate(path);
  };

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: <span style={{ cursor: 'pointer' }} onClick={() => handleMenuClick('/admin')}>Dashboard</span>,
    },
    {
      key: 'users',
      icon: <UserOutlined />,
      label: <span style={{ cursor: 'pointer' }} onClick={() => handleMenuClick('/admin/users')}>User Management</span>,
    },
    {
      key: 'files',
      icon: <FileOutlined />,
      label: <span style={{ cursor: 'pointer' }} onClick={() => handleMenuClick('/admin/files')}>File Manager</span>,
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: <span style={{ cursor: 'pointer' }} onClick={() => handleMenuClick('/admin/settings')}>Settings</span>,
    }
  ];

  // Show welcome message only on initial load
  const [showWelcome, setShowWelcome] = useState(true);
  const [taskNotifications, setTaskNotifications] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskDropdownVisible, setTaskDropdownVisible] = useState(false);
  const dropdownRef = useRef(null);
  
  useEffect(() => {
    // Hide welcome message after 5 seconds
    const timer = setTimeout(() => setShowWelcome(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const fetchTaskNotifications = async () => {
    try {
      setLoadingTasks(true);
      const baseUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
      const response = await axios.get(`${baseUrl}/file/messages`, { 
        withCredentials: true 
      });
      setTaskNotifications(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching task notifications:', error);
      message.error('Failed to load task notifications');
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleMarkTaskDone = async (messageId) => {
    try {
      const baseUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
      await axios.patch(
        `${baseUrl}/file/message/${messageId}/done`,
        {},
        { withCredentials: true }
      );
      fetchTaskNotifications();
      message.success('Task marked as completed');
    } catch (error) {
      console.error('Error updating task status:', error);
      message.error('Failed to update task status');
    }
  };

  useEffect(() => {
    fetchTaskNotifications();
    
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setTaskDropdownVisible(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const pendingTasks = taskNotifications.filter(task => !task.is_done);
  const completedTasks = taskNotifications.filter(task => task.is_done);

  return (
    <ConfigProvider warning={{ strict: false }}>
      {showWelcome && <WelcomeMessage name={adminName} />}
      <Layout className="admin-layout" style={{ fontFamily: 'Roboto, sans-serif' }}>
        {isMobile && !collapsed && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1,
            }}
          />
        )}

        <Sider
          ref={siderRef}
          breakpoint="lg"
          collapsedWidth="0"
          collapsible={false}
          collapsed={collapsed}
          onBreakpoint={handleBreakpoint}
          onCollapse={setCollapsed}
          style={{
            position: isMobile ? 'fixed' : 'relative',
            zIndex: 2,
            height: '100vh',
            overflow: 'auto',
            background: '#001529',
          }}
          trigger={null}
        >
          <div style={{ height: 64, background: 'rgba(255,255,255,0.04)', margin: 12, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 20, color: '#fff' }}>
            Resilio Admin
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[currentSection]}
            items={menuItems}
            style={{ borderRight: 0 }}
          />
        </Sider>
        <Layout>
          <Header
            style={{
              background: '#fff',
              padding: isMobile ? '0 16px' : '0 32px',
              display: 'flex',
              alignItems: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              height: '64px',
            }}
          >

            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={toggleSidebar}
                style={{ position: 'absolute', left: 16 }}
              />
            )}
            <div style={{ flex: 1 }} />
            
            {/* Task Notifications Dropdown */}
            <div ref={dropdownRef} style={{ position: 'relative', marginRight: 16 }}>
              <Button 
                type="text"
                icon={
                  <Badge 
                    count={pendingTasks.length} 
                    size="small"
                    style={{ 
                      backgroundColor: pendingTasks.length > 0 ? '#ff4d4f' : '#d9d9d9',
                      boxShadow: 'none',
                      fontSize: '10px',
                      lineHeight: '16px',
                      height: '16px',
                      minWidth: '16px',
                      padding: '0 4px',
                      top: '-2px',
                      right: '-2px'
                    }}
                  >
                    <BellOutlined style={{ fontSize: '20px', color: '#595959' }} />
                  </Badge>
                }
                onClick={() => {
                  setTaskDropdownVisible(!taskDropdownVisible);
                  if (!taskDropdownVisible) {
                    fetchTaskNotifications();
                  }
                }}
                style={{
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  marginRight: '8px'
                }}
              />
              
              {taskDropdownVisible && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  width: '350px',
                  backgroundColor: '#fff',
                  borderRadius: '8px',
                  boxShadow: '0 3px 10px rgba(0, 0, 0, 0.15)',
                  zIndex: 1000,
                  maxHeight: '500px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <strong>Task Notifications</strong>
                    <Button 
                      type="text" 
                      size="small" 
                      loading={loadingTasks}
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchTaskNotifications();
                      }}
                    >
                      Refresh
                    </Button>
                  </div>
                  
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {loadingTasks ? (
                      <div style={{ padding: '16px', textAlign: 'center' }}>Loading tasks...</div>
                    ) : taskNotifications.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#8c8c8c' }}>
                        No tasks found
                      </div>
                    ) : (
                      <>
                        {pendingTasks.length > 0 && (
                          <div style={{ padding: '8px 0' }}>
                            <div style={{ padding: '0 16px 8px', color: '#8c8c8c', fontSize: '12px' }}>
                              PENDING
                            </div>
                            {pendingTasks.map(task => (
                              <div 
                                key={task.id}
                                style={{
                                  padding: '12px 16px',
                                  borderBottom: '1px solid #f0f0f0',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '12px',
                                  backgroundColor: '#fff'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                              >
                                <ClockCircleOutlined style={{ color: '#faad14', marginTop: '2px' }} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                                    {task.message}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                                    File: {task.file_name || 'N/A'}
                                  </div>
                                </div>
                                <Button 
                                  type="link" 
                                  size="small" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkTaskDone(task.id);
                                  }}
                                  style={{ padding: '0 8px', height: '24px', fontSize: '12px' }}
                                >
                                  Mark Done
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {completedTasks.length > 0 && (
                          <div style={{ padding: '8px 0' }}>
                            <div style={{ padding: '8px 16px', color: '#8c8c8c', fontSize: '12px' }}>
                              COMPLETED
                            </div>
                            {completedTasks.map(task => (
                              <div 
                                key={task.id}
                                style={{
                                  padding: '12px 16px',
                                  borderBottom: '1px solid #f0f0f0',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '12px',
                                  backgroundColor: '#f9f9f9',
                                  opacity: 0.8
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                              >
                                <CheckCircleOutlined style={{ color: '#52c41a', marginTop: '2px' }} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ textDecoration: 'line-through', color: '#8c8c8c', marginBottom: '4px' }}>
                                    {task.message}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#bfbfbf' }}>
                                    File: {task.file_name || 'N/A'}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  
                  <div style={{ 
                    padding: '12px 16px', 
                    borderTop: '1px solid #f0f0f0',
                    textAlign: 'center',
                    fontSize: '12px',
                    color: '#8c8c8c'
                  }}>
                    {pendingTasks.length} pending • {completedTasks.length} completed
                  </div>
                </div>
              )}
            </div>
            
            <Button 
              type="primary" 
              size="large" 
              onClick={handleLogout} 
              style={{ 
                fontWeight: 600, 
                letterSpacing: 1,
                backgroundColor: '#ff4d4f',
                borderColor: '#ff4d4f',
                marginRight: '16px',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1.1)',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                position: 'relative',
                overflow: 'hidden',
                zIndex: 1
              }}
              className="logout-button"
            >
              <style>
                {`
                  .logout-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
                  }
                  .logout-button:active {
                    transform: translateY(0);
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                  }
                  .logout-button::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(255, 255, 255, 0.1);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    z-index: -1;
                  }
                  .logout-button:hover::after {
                    opacity: 1;
                  }
                `}
              </style>
              Logout
            </Button>
          </Header>
          <Content className="ant-layout-content" style={{ background: '#f5f6fa' }}>
            {/* Routing for /admin/user-activities */}
            {location.pathname.endsWith('/user-activities') ? (
              <UserActivities />
            ) : (
              <Outlet />
            )}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
};

export default AdminDashboard;
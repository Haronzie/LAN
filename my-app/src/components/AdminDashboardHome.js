import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card as AntdCard, Statistic, List, Button, Typography, message, DatePicker, Space } from 'antd';
import { 
  UserOutlined, 
  FileOutlined, 
  TeamOutlined, 
  CalendarOutlined, 
  FilterOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  MessageOutlined,
  LoginOutlined,
  LogoutOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title as ChartTitle, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import axios from 'axios';
import moment from 'moment';
import styled from 'styled-components';

const Card = styled(AntdCard)`
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1.1);
  border: none;
  height: 100%;
  cursor: pointer;
  
  &:hover {
    transform: translateY(-6px) scale(1.02);
    box-shadow: 0 15px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    z-index: 1;
  }
`;

const CardBody = styled.div`
  padding: 20px;
  display: flex;
  align-items: center;
  height: 100%;
  transition: all 0.25s ease;
`;

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTitle, Tooltip, Legend);

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

const { Text, Title } = Typography;

const AdminDashboardHome = () => {
  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activities, setActivities] = useState([]);
  const [fileMessages, setFileMessages] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [dateRange, setDateRange] = useState(null);
  const [filteredChartData, setFilteredChartData] = useState([]);
  const navigate = useNavigate();

  const getRole = (user) => user.role || user.userRole || user.type || '';

  const totalUsers = users.length;
  
  // Count files in the three main folders and their subdirectories
  const countFilesInFolders = () => {
    const validFolders = ['operation', 'training', 'research'];
    let count = 0;
    
    files.forEach(file => {
      if (!file.directory) return;
      
      // Get the first part of the path (main folder)
      const firstSlash = file.directory.indexOf('/');
      const mainFolder = firstSlash === -1 
        ? file.directory.toLowerCase() 
        : file.directory.substring(0, firstSlash).toLowerCase();
      
      // Check if the file is in one of the main folders or their subdirectories
      if (validFolders.includes(mainFolder)) {
        count++;
      }
    });
    
    return count;
  };
  
  const totalFiles = countFilesInFolders();
  const adminCount = users.filter((u) => getRole(u) === 'admin').length;
  const regularCount = users.filter((u) => getRole(u) === 'user').length;

  // Prepare chart data: uploads per folder per month (robust)
const getMonthYear = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString('default', { month: 'long' });
};

// Only consider these folders, normalize to lowercase
const validFolders = ['operation', 'training', 'research'];
const uploadsPerFolderMonth = {};
files.forEach(file => {
  if (!file.directory) return;
  
  // Get the first part of the path (main folder)
  const firstSlash = file.directory.indexOf('/');
  const mainFolder = firstSlash === -1 
    ? file.directory.toLowerCase() 
    : file.directory.substring(0, firstSlash).toLowerCase();
  
  if (!validFolders.includes(mainFolder)) return;
  
  const dateField = file.created_at; // or file.uploaded_at if available
  if (!dateField) return;
  const monthYear = getMonthYear(dateField);

  if (!uploadsPerFolderMonth[monthYear]) uploadsPerFolderMonth[monthYear] = {};
  if (!uploadsPerFolderMonth[monthYear][mainFolder]) uploadsPerFolderMonth[monthYear][mainFolder] = 0;
  uploadsPerFolderMonth[monthYear][mainFolder] += 1;
});

// Transform data for Chart.js format - we need each month to have all folder values
const transformedChartData = [];

// For sorting months - ensure we're only working with month names now
const monthOrder = [
  'January','February','March','April','May','June','July','August','September','October','November','December'
];

// Get unique month/years
const uniqueMonthYears = [...new Set(Object.keys(uploadsPerFolderMonth))];

// Function to get the actual date from a file for filtering
const getFileDate = (file) => {
  return new Date(file.created_at || file.uploaded_at || file.modified_at || new Date());
};

// Parse month to Date object for filtering (using current year since we're only showing months)
const parseMonthYear = (month) => {
  const monthIndex = monthOrder.indexOf(month);
  // Use current year since we're only showing months
  return new Date(new Date().getFullYear(), monthIndex, 1);
};

uniqueMonthYears.sort((a, b) => {
  const [aMonth, aYear] = a.split(' ');
  const [bMonth, bYear] = b.split(' ');
  if (aYear !== bYear) return parseInt(aYear) - parseInt(bYear);
  return monthOrder.indexOf(aMonth) - monthOrder.indexOf(bMonth);
});

// Create data points with all folders for each month
uniqueMonthYears.forEach(monthYear => {
  const dataPoint = { 
    monthYear,
    date: parseMonthYear(monthYear) // Add actual date object for filtering
  };
  
  // Initialize all folders with 0
  validFolders.forEach(folder => {
    const capitalizedFolder = folder.charAt(0).toUpperCase() + folder.slice(1);
    dataPoint[capitalizedFolder] = 0;
  });
  
  // Fill in actual values where available
  if (uploadsPerFolderMonth[monthYear]) {
    Object.entries(uploadsPerFolderMonth[monthYear]).forEach(([folder, count]) => {
      const capitalizedFolder = folder.charAt(0).toUpperCase() + folder.slice(1);
      dataPoint[capitalizedFolder] = count;
    });
  }
  
  transformedChartData.push(dataPoint);
});

// Apply precise date filtering
const applyDateFilter = (data, range) => {
  if (!range || !range[0] || !range[1]) return data;
  
  // Get exact start and end dates
  const startDate = range[0].startOf('day').toDate();
  const endDate = range[1].endOf('day').toDate();
  
  // First, filter out all files based on exact dates
  const filteredFiles = files.filter(file => {
    const fileDate = new Date(file.created_at || file.uploaded_at || file.modified_at || new Date());
    return fileDate >= startDate && fileDate <= endDate;
  });
  
  // Now rebuild the chart data from these filtered files
  const filteredUploadsPerMonth = {};
  
  // Count uploads by folder and month for filtered files
  filteredFiles.forEach(file => {
    let folder = (file.directory || '').toLowerCase();
    if (!validFolders.includes(folder)) return;
    
    const dateField = file.created_at; // or file.uploaded_at if available
    if (!dateField) return;
    
    const monthYear = getMonthYear(dateField);
    
    if (!filteredUploadsPerMonth[monthYear]) filteredUploadsPerMonth[monthYear] = {};
    if (!filteredUploadsPerMonth[monthYear][folder]) filteredUploadsPerMonth[monthYear][folder] = 0;
    filteredUploadsPerMonth[monthYear][folder] += 1;
  });
  
  // Build chart data from filtered files
  const filteredChartData = [];
  
  // Get unique month/years from filtered data
  const filteredMonthYears = [...new Set(Object.keys(filteredUploadsPerMonth))];
  
  // Sort by month/year
  filteredMonthYears.sort((a, b) => {
    const [aMonth, aYear] = a.split(' ');
    const [bMonth, bYear] = b.split(' ');
    if (aYear !== bYear) return parseInt(aYear) - parseInt(bYear);
    return monthOrder.indexOf(aMonth) - monthOrder.indexOf(bMonth);
  });
  
  // Create data points with all folders for each month
  filteredMonthYears.forEach(monthYear => {
    const dataPoint = { 
      monthYear,
      date: parseMonthYear(monthYear)
    };
    
    // Initialize all folders with 0
    validFolders.forEach(folder => {
      const capitalizedFolder = folder.charAt(0).toUpperCase() + folder.slice(1);
      dataPoint[capitalizedFolder] = 0;
    });
    
    // Fill in actual values where available
    if (filteredUploadsPerMonth[monthYear]) {
      Object.entries(filteredUploadsPerMonth[monthYear]).forEach(([folder, count]) => {
        const capitalizedFolder = folder.charAt(0).toUpperCase() + folder.slice(1);
        dataPoint[capitalizedFolder] = count;
      });
    }
    
    filteredChartData.push(dataPoint);
  });
  
  return filteredChartData;
};

// Memoize the transformedChartData to prevent recalculation on every render
const transformedChartDataMemo = useMemo(() => {
  return transformedChartData;
}, [files]); // Only recalculate when files change

// Set filtered data when files or date range changes
useEffect(() => {
  if (dateRange) {
    setFilteredChartData(applyDateFilter(transformedChartDataMemo, dateRange));
  } else {
    setFilteredChartData(transformedChartDataMemo);
  }
}, [dateRange, transformedChartDataMemo]);

// Chart colors
const folderColors = {
  'Operation': '#13c2c2',
  'Training': '#faad14',
  'Research': '#52c41a'
};

const folderColorsArray = Object.values(folderColors);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await axios.get(`${BASE_URL}/users`, { withCredentials: true });
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error fetching users:', error);
      message.error('Failed to fetch users: ' + (error.message || 'Unknown error'));
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await axios.get(`${BASE_URL}/files/all`, { withCredentials: true });
      setFiles(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error fetching files:', error);
      message.error('Failed to fetch files: ' + (error.message || 'Unknown error'));
    } finally {
      setLoadingFiles(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/auditlogs`, { withCredentials: true });
      // Process the audit logs to ensure we have the correct username
      const processedLogs = Array.isArray(res.data) 
        ? res.data.map(log => ({
            ...log,
            user_name: log.username_at_action || log.user_username || log.user_name || 'System'
          }))
        : [];
      setAuditLogs(processedLogs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      message.error('Failed to fetch audit logs: ' + (error.message || 'Unknown error'));
    }
  };

  // Format activity description based on action type
  const getActivityDescription = (action, actionType) => {
    const actionText = action || '';
    const type = (actionType || '').toLowerCase();
    
    const actionMap = {
      'upload': 'uploaded a file',
      'delete': 'deleted a file',
      'update': 'updated a file',
      'login': 'logged in',
      'logout': 'logged out',
      'create': 'created a new',
      'modify': 'modified',
      'move': 'moved',
      'rename': 'renamed',
      'share': 'shared',
      'download': 'downloaded'
    };

    const typeMap = {
      'file': 'file',
      'folder': 'folder',
      'user': 'user',
      'permission': 'permission',
      'settings': 'settings'
    };

    const actionTextFormatted = actionMap[type] || actionText.toLowerCase();
    const typeText = typeMap[type] || '';

    return (
      <>
        <span style={{ color: '#2d3748', fontWeight: 500 }}>{actionTextFormatted}</span>
        {typeText && <span> {typeText}</span>}
        {actionText && !actionMap[type] && <span>: {actionText}</span>}
      </>
    );
  };

  const fetchActivities = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/activities`, { withCredentials: true });
      // Ensure each activity has a user_name field, defaulting to 'System' if not available
      const activitiesWithUsernames = Array.isArray(res.data) 
        ? res.data.map(activity => ({
            ...activity,
            user_name: activity.user_name || activity.username || 'System'
          }))
        : [];
      setActivities(activitiesWithUsernames);
    } catch (error) {
      console.error('Error fetching activities:', error);
      message.error('Failed to fetch activities: ' + (error.message || 'Unknown error'));
    }
  };

  const fetchFileMessages = async () => {
    setLoadingMessages(true);
    try {
      const res = await axios.get(`${BASE_URL}/file/messages`, { withCredentials: true });
      setFileMessages(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error fetching file messages:', error);
      message.error('Failed to fetch file messages: ' + (error.message || 'Unknown error'));
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleMarkAsDone = async (messageId) => {
    try {
      await axios.patch(
        `${BASE_URL}/file/message/${messageId}/done`,
        {},
        { withCredentials: true }
      );
      fetchFileMessages();
      message.success('Task marked as completed');
    } catch (error) {
      console.error('Error updating task status:', error);
      message.error('Failed to update task status');
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchFiles();
    fetchAuditLogs();
    fetchActivities();
    fetchFileMessages();
  }, []);

  return (
    <div style={{ 
      height: 'calc(100vh - 64px)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      backgroundColor: '#f5f7fa'
    }}>
      {/* Title */}
      <Title level={3} style={{ 
        margin: '0 0 16px 0',
        textAlign: 'center',
        fontWeight: 600,
        color: '#1a365d'
      }}>
        Welcome to the Admin Dashboard
      </Title>
      
      {/* Stats Row */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Total Users Card */}
        <Card>
          <CardBody>
          <div style={{ 
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            backgroundColor: 'rgba(49, 130, 206, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '16px',
            flexShrink: 0
          }}>
            <UserOutlined style={{ fontSize: '24px', color: '#3182ce' }} />
          </div>
          <div>
            <div style={{ 
              fontSize: '14px',
              color: '#718096',
              marginBottom: '4px'
            }}>
              Total Users
            </div>
            {loadingUsers ? (
              <div style={{ height: '32px', display: 'flex', alignItems: 'center' }}>
                <div className="animate-pulse bg-gray-200 rounded" style={{ width: '60px', height: '24px' }}></div>
              </div>
            ) : (
              <div style={{ 
                fontSize: '24px',
                fontWeight: 700,
                color: '#2d3748',
                lineHeight: '1.2'
              }}>
                {totalUsers.toLocaleString()}
              </div>
            )}
          </div>
          </CardBody>
        </Card>

        {/* Total Files Card */}
        <Card>
          <CardBody>
          <div style={{ 
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '16px',
            flexShrink: 0
          }}>
            <FileOutlined style={{ fontSize: '24px', color: '#10b981' }} />
          </div>
          <div>
            <div style={{ 
              fontSize: '14px',
              color: '#718096',
              marginBottom: '4px'
            }}>
              Total Files
            </div>
            {loadingFiles ? (
              <div style={{ height: '32px', display: 'flex', alignItems: 'center' }}>
                <div className="animate-pulse bg-gray-200 rounded" style={{ width: '60px', height: '24px' }}></div>
              </div>
            ) : (
              <div style={{ 
                fontSize: '24px',
                fontWeight: 700,
                color: '#2d3748',
                lineHeight: '1.2'
              }}>
                {totalFiles.toLocaleString()}
              </div>
            )}
          </div>
          </CardBody>
        </Card>

        {/* Admin Users Card */}
        <Card>
          <CardBody>
          <div style={{ 
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '16px',
            flexShrink: 0
          }}>
            <TeamOutlined style={{ fontSize: '24px', color: '#f59e0b' }} />
          </div>
          <div>
            <div style={{ 
              fontSize: '14px',
              color: '#718096',
              marginBottom: '4px'
            }}>
              Admin Users
            </div>
            {loadingUsers ? (
              <div style={{ height: '32px', display: 'flex', alignItems: 'center' }}>
                <div className="animate-pulse bg-gray-200 rounded" style={{ width: '60px', height: '24px' }}></div>
              </div>
            ) : (
              <div style={{ 
                fontSize: '24px',
                fontWeight: 700,
                color: '#2d3748',
                lineHeight: '1.2'
              }}>
                {adminCount.toLocaleString()}
              </div>
            )}
          </div>
          </CardBody>
        </Card>

        {/* Regular Users Card */}
        <Card>
          <CardBody>
          <div style={{ 
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '16px',
            flexShrink: 0
          }}>
            <UserOutlined style={{ fontSize: '24px', color: '#8b5cf6' }} />
          </div>
          <div>
            <div style={{ 
              fontSize: '14px',
              color: '#718096',
              marginBottom: '4px'
            }}>
              Regular Users
            </div>
            {loadingUsers ? (
              <div style={{ height: '32px', display: 'flex', alignItems: 'center' }}>
                <div className="animate-pulse bg-gray-200 rounded" style={{ width: '60px', height: '24px' }}></div>
              </div>
            ) : (
              <div style={{ 
                fontSize: '24px',
                fontWeight: 700,
                color: '#2d3748',
                lineHeight: '1.2'
              }}>
                {regularCount.toLocaleString()}
              </div>
            )}
          </div>
          </CardBody>
        </Card>
      </div>

      {/* Main Content */}
      <div style={{ 
        display: 'flex', 
        flex: 1,
        gap: '16px',
        minHeight: 0,
        overflow: 'hidden'
      }}>
        {/* Left Column - Chart */}
        <div style={{ 
          flex: 2, 
          display: 'flex', 
          flexDirection: 'column',
          minWidth: 0
        }}>
          <Card 
            style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
            bodyStyle={{ 
              padding: 0,
              flex: 1,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Chart Header */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid #edf2f7',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center',
                gap: '8px'
              }}>
                <CalendarOutlined style={{ color: '#4a5568' }} />
                <Text strong style={{ fontSize: 16 }}>File Upload Analytics</Text>
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                {dateRange && (
                  <Button 
                    size="small"
                    onClick={() => {
                      setDateRange(null);
                      setFilteredChartData(transformedChartData);
                    }}
                    icon={<FilterOutlined />}
                  >
                    Clear Filter
                  </Button>
                )}
              </div>
            </div>
            
            {/* Date Range Picker */}
            <div style={{ 
              padding: '12px 24px',
              borderBottom: '1px solid #edf2f7'
            }}>
              <DatePicker.RangePicker 
                value={dateRange}
                onChange={(dates) => {
                  setDateRange(dates);
                  if (!dates) {
                    setFilteredChartData(transformedChartData);
                  }
                }}
                format="MMM DD, YYYY"
                placeholder={['Start Date', 'End Date']}
                allowClear={true}
                style={{ width: '100%' }}
              />
            </div>
            
            {/* Chart Container */}
            <div style={{ 
              flex: 1,
              padding: '16px 24px 24px',
              minHeight: 0,
              overflow: 'auto'
            }}>
              {filteredChartData.length > 0 ? (
                <div style={{ height: '100%', minHeight: '300px' }}>
                  <Bar
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top',
                          align: 'center',
                          labels: {
                            boxWidth: 12,
                            usePointStyle: true,
                            padding: 16,
                            font: { size: 12 }
                          }
                        }
                      },
                      layout: {
                        padding: {
                          left: 10,
                          right: 10,
                          top: 10,
                          bottom: 10
                        }
                      },
                      scales: {
                        x: { 
                          grid: { display: false },
                          ticks: {
                            maxRotation: 0,
                            minRotation: 0,
                            padding: 8,
                            autoSkip: false,
                            font: {
                              size: 11
                            }
                          }
                        },
                        y: { 
                          beginAtZero: true,
                          grid: { 
                            color: 'rgba(0,0,0,0.05)',
                            drawBorder: false
                          },
                          ticks: { 
                            stepSize: 1,
                            padding: 8
                          }
                        }
                      }
                    }}
                    data={{
                      labels: filteredChartData.map(item => item.monthYear),
                      datasets: validFolders.map((folder, index) => {
                        const capitalizedFolder = folder.charAt(0).toUpperCase() + folder.slice(1);
                        return {
                          label: capitalizedFolder,
                          data: filteredChartData.map(item => item[capitalizedFolder] || 0),
                          backgroundColor: folderColors[capitalizedFolder],
                          borderRadius: 4
                        };
                      })
                    }}
                  />
                </div>
              ) : (
                <div style={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  color: '#a0aec0',
                  textAlign: 'center',
                  padding: '24px'
                }}>
                  <FileOutlined style={{ fontSize: 32, marginBottom: 12 }} />
                  <Text style={{ color: '#a0aec0' }}>No uploads yet</Text>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column - Activity Logs */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          gap: '16px',
          minWidth: 0
        }}>
          {/* Audit Logs Card */}
          <Card 
            title={
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>Recent Audit Logs</span>
                <Button 
                  type="link" 
                  size="small" 
                  onClick={() => navigate('audit-logs')}
                  style={{ padding: 0, height: 'auto' }}
                >
                  View All
                </Button>
              </div>
            }
            style={{ 
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
            bodyStyle={{ 
              padding: 0,
              flex: 1,
              overflow: 'auto'
            }}
          >
            {auditLogs.length > 0 ? (
              <List
                size="small"
                dataSource={auditLogs.slice(0, 10)}
                renderItem={(item) => {
                  // Parse the action and details to create a more user-friendly message
                  const getActionIcon = (action) => {
                    switch(action?.toLowerCase()) {
                      case 'login':
                        return <CheckCircleOutlined style={{ color: '#10b981', marginRight: 8 }} />;
                      case 'upload':
                        return <FileOutlined style={{ color: '#3b82f6', marginRight: 8 }} />;
                      case 'delete':
                        return <FileOutlined style={{ color: '#ef4444', marginRight: 8 }} />;
                      case 'update':
                        return <FileOutlined style={{ color: '#f59e0b', marginRight: 8 }} />;
                      default:
                        return <MessageOutlined style={{ color: '#8b5cf6', marginRight: 8 }} />;
                    }
                  };

                  // Format the timestamp to be more readable
                  const formatTimeAgo = (dateString) => {
                    const date = new Date(dateString);
                    const now = new Date();
                    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
                    
                    if (diffInHours < 1) {
                      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
                      return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
                    } else if (diffInHours < 24) {
                      return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
                    } else {
                      return date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                    }
                  };

                  // Parse the details to extract relevant information
                  const parseDetails = (details, item) => {
                    try {
                      // If details is a string that looks like JSON, parse it
                      let message = details;
                      if (typeof details === 'string' && (details.startsWith('{') || details.startsWith('['))) {
                        const parsed = JSON.parse(details);
                        if (parsed.message) message = parsed.message;
                      }
                      
                      // Get the current username from the item
                      const currentUsername = item.user_name || 'System';
                      
                      // If this is a file/folder operation, format the message
                      const action = (item.action || '').toLowerCase();
                      if (['upload', 'delete', 'update', 'create', 'modify', 'rename', 'move', 'copy'].includes(action)) {
                        // Remove the username from the message if it's already shown in the header
                        let cleanMessage = message;
                        if (message.startsWith(`${currentUsername} `)) {
                          cleanMessage = message.substring(currentUsername.length).trim();
                        }
                        
                        const actionText = action.endsWith('e') ? `${action}d` : `${action}ed`;
                        return (
                          <span>
                            {cleanMessage}
                          </span>
                        );
                      }
                      
                      // For other types of messages, just return as is
                      return <span>{message}</span>;
                    } catch (e) {
                      return details;
                    }
                  };

                  return (
                    <List.Item 
                      style={{ 
                        padding: '12px 16px',
                        borderBottom: '1px solid #edf2f7',
                        transition: 'background-color 0.2s',
                        display: 'flex',
                        alignItems: 'flex-start'
                      }}
                      className="hover:bg-gray-50"
                    >
                      <div style={{ marginRight: 12, marginTop: 2 }}>
                        {getActionIcon(item.action)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          marginBottom: 4,
                          alignItems: 'center'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <UserOutlined style={{ color: '#718096', marginRight: 6, fontSize: 12 }} />
                            <Text strong style={{ fontSize: 13, color: '#2d3748' }}>
                              {item.user_name || 'System'}
                            </Text>
                          </div>
                          <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                            {formatTimeAgo(item.created_at)}
                          </Text>
                        </div>
                        <div style={{ 
                          fontSize: 13,
                          lineHeight: 1.4,
                          color: '#4a5568',
                          wordBreak: 'break-word'
                        }}>
                          {parseDetails(item.details, item)}
                        </div>
                        {item.action && (
                          <div style={{ 
                            marginTop: 4,
                            display: 'inline-block',
                            padding: '2px 6px',
                            backgroundColor: '#f7fafc',
                            borderRadius: 4,
                            border: '1px solid #e2e8f0',
                            fontSize: 11,
                            color: '#4a5568',
                            textTransform: 'capitalize'
                          }}>
                            {item.action}
                          </div>
                        )}
                      </div>
                    </List.Item>
                  );
                }}
              />
            ) : (
              <div style={{ 
                padding: '24px', 
                textAlign: 'center',
                color: '#a0aec0'
              }}>
                No audit logs available
              </div>
            )}
          </Card>

          {/* Activities Card */}
          <Card 
            title={
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>Recent Activities</span>
                <Button 
                  type="link" 
                  size="small" 
                  onClick={() => navigate('user-activities')}
                  style={{ padding: 0, height: 'auto' }}
                >
                  View All
                </Button>
              </div>
            }
            style={{ 
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
            bodyStyle={{ 
              padding: 0,
              flex: 1,
              overflow: 'auto'
            }}
          >
            {activities.length > 0 ? (
              <List
                size="small"
                dataSource={activities
                  .filter(item => {
                    const event = (item.event || '').toLowerCase();
                    // Exclude file and folder related activities
                    return !(
                      event.includes('file') ||
                      event.includes('folder') ||
                      event.includes('upload') ||
                      event.includes('download') ||
                      event.includes('delete file') ||
                      event.includes('create file') ||
                      event.includes('modify file') ||
                      event.includes('rename file')
                    );
                  })
                  .slice(0, 10)}
                renderItem={(item) => {
                  // Parse the event message to extract relevant information
                  const event = item.event || '';
                  const userName = item.user_name || 'System';
                  const timestamp = new Date(item.timestamp || item.created_at);
                  const timeString = timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                  const dateString = timestamp.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                  
                  // Format the activity message with highlighted username
                  const formatActivityMessage = (event, currentUserName) => {
                    // Don't modify system messages
                    if (currentUserName.toLowerCase() === 'system') {
                      return event;
                    }
                    
                    // Format similar to audit log
                    const action = event;
                    let actionText = action;
                    
                    // Simple formatting that matches audit log style
                    return (
                      <span>
                        <span style={{ color: '#4f46e5', fontWeight: 'bold' }}>{currentUserName}</span>
                        {` ${actionText}`}
                      </span>
                    );
                  };
                  
                  // Determine icon and color based on event type
                  let icon = <MessageOutlined />;
                  let iconColor = '#4f46e5';
                  
                  if (event.toLowerCase().includes('login')) {
                    icon = <LoginOutlined />;
                    iconColor = '#10b981'; // Green
                  } else if (event.toLowerCase().includes('logout')) {
                    icon = <LogoutOutlined />;
                    iconColor = '#ef4444'; // Red
                  } else if (event.toLowerCase().includes('upload')) {
                    icon = <FileOutlined />;
                    iconColor = '#3b82f6'; // Blue
                  } else if (event.toLowerCase().includes('delete')) {
                    icon = <DeleteOutlined />;
                    iconColor = '#ef4444'; // Red
                  }
                  
                  return (
                    <List.Item 
                      style={{ 
                        padding: '12px 16px',
                        borderBottom: '1px solid #edf2f7',
                        transition: 'background-color 0.2s',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px'
                      }}
                      className="hover:bg-gray-50"
                    >
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        backgroundColor: `${iconColor}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {React.cloneElement(icon, { 
                          style: { color: iconColor, fontSize: 14 } 
                        })}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          marginBottom: 4,
                          alignItems: 'center'
                        }}>
                          <div style={{ 
                            width: '70%',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }} />
                          <Text type="secondary" style={{ 
                            fontSize: 11, 
                            color: '#718096',
                            whiteSpace: 'nowrap',
                            marginLeft: 8
                          }}>
                            {timeString}
                          </Text>
                        </div>
                        <div style={{ 
                          fontSize: 13,
                          lineHeight: 1.4,
                          color: '#4a5568',
                          wordBreak: 'break-word',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}>
                          {userName && userName.toLowerCase() !== 'system' ? (
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: '#f0f5ff',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              width: 'fit-content',
                              marginBottom: '2px'
                            }}>
                              <UserOutlined style={{ fontSize: '12px', color: '#4f46e5' }} />
                              <span style={{
                                color: '#4f46e5',
                                fontWeight: '600',
                                fontSize: '13px',
                                letterSpacing: '0.3px'
                              }}>
                                {userName}
                              </span>
                            </div>
                          ) : null}
                          {event && (
                            <div style={{
                              marginTop: userName && userName.toLowerCase() !== 'system' ? '0' : '4px',
                              lineHeight: '1.5'
                            }}>
                              {event}
                            </div>
                          )}
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {dateString}
                          </Text>
                        </div>
                      </div>
                    </List.Item>
                )}}
              />
            ) : (
              <div style={{ 
                padding: '24px', 
                textAlign: 'center',
                color: '#a0aec0'
              }}>
                No activities to show
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardHome;

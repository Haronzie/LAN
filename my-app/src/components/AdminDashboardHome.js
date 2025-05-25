import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Statistic, List, Button, Typography, message, DatePicker, Space } from 'antd';
import { UserOutlined, FileOutlined, TeamOutlined, CalendarOutlined, FilterOutlined } from '@ant-design/icons';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title as ChartTitle, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import axios from 'axios';
import moment from 'moment';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTitle, Tooltip, Legend);

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

const { Text, Title } = Typography;

const AdminDashboardHome = () => {
  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [dateRange, setDateRange] = useState(null);
  const [filteredChartData, setFilteredChartData] = useState([]);
  const navigate = useNavigate();

  const getRole = (user) => user.role || user.userRole || user.type || '';

  const totalUsers = users.length;
  const totalFiles = files.length;
  const adminCount = users.filter((u) => getRole(u) === 'admin').length;
  const regularCount = users.filter((u) => getRole(u) === 'user').length;

  // Prepare chart data: uploads per folder per month (robust)
const getMonthYear = (dateString) => {
  const date = new Date(dateString);
  const month = date.toLocaleString('default', { month: 'long' });
  const year = date.getFullYear();
  return `${month} ${year}`;
};

// Only consider these folders, normalize to lowercase
const validFolders = ['operation', 'training', 'research'];
const uploadsPerFolderMonth = {};
files.forEach(file => {
  let folder = (file.directory || '').toLowerCase();
  if (!validFolders.includes(folder)) return;
  const dateField = file.created_at; // or file.uploaded_at if available
  if (!dateField) return;
  const monthYear = getMonthYear(dateField);

  if (!uploadsPerFolderMonth[monthYear]) uploadsPerFolderMonth[monthYear] = {};
  if (!uploadsPerFolderMonth[monthYear][folder]) uploadsPerFolderMonth[monthYear][folder] = 0;
  uploadsPerFolderMonth[monthYear][folder] += 1;
});

// Transform data for Chart.js format - we need each month to have all folder values
const transformedChartData = [];

// For sorting months
const monthOrder = [
  'January','February','March','April','May','June','July','August','September','October','November','December'
];

// Get unique month/years
const uniqueMonthYears = [...new Set(Object.keys(uploadsPerFolderMonth))];

// Function to get the actual date from a file for filtering
const getFileDate = (file) => {
  return new Date(file.created_at || file.uploaded_at || file.modified_at || new Date());
};

// Parse month and year to Date object for filtering
const parseMonthYear = (monthYear) => {
  const [month, year] = monthYear.split(' ');
  const monthIndex = monthOrder.indexOf(month);
  return new Date(parseInt(year), monthIndex, 1);
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
      setAuditLogs(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      message.error('Failed to fetch audit logs: ' + (error.message || 'Unknown error'));
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/activities`, { withCredentials: true });
      setActivities(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error fetching activities:', error);
      message.error('Failed to fetch activities: ' + (error.message || 'Unknown error'));
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchFiles();
    fetchAuditLogs();
    fetchActivities();
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
        <Card 
          style={{ 
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            transition: 'all 0.3s ease',
            border: 'none',
            height: '100%'
          }}
          bodyStyle={{ 
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            height: '100%'
          }}
          className="hover:shadow-lg"
        >
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
        </Card>

        {/* Total Files Card */}
        <Card 
          style={{ 
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            transition: 'all 0.3s ease',
            border: 'none',
            height: '100%'
          }}
          bodyStyle={{ 
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            height: '100%'
          }}
          className="hover:shadow-lg"
        >
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
        </Card>

        {/* Admin Users Card */}
        <Card 
          style={{ 
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            transition: 'all 0.3s ease',
            border: 'none',
            height: '100%'
          }}
          bodyStyle={{ 
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            height: '100%'
          }}
          className="hover:shadow-lg"
        >
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
        </Card>

        {/* Regular Users Card */}
        <Card 
          style={{ 
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            transition: 'all 0.3s ease',
            border: 'none',
            height: '100%'
          }}
          bodyStyle={{ 
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            height: '100%'
          }}
          className="hover:shadow-lg"
        >
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
                      scales: {
                        x: { grid: { display: false } },
                        y: { 
                          beginAtZero: true,
                          grid: { color: 'rgba(0,0,0,0.05)' },
                          ticks: { stepSize: 1 }
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

        {/* Right Column - Logs */}
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
                renderItem={(item) => (
                  <List.Item 
                    style={{ 
                      padding: '12px 16px',
                      borderBottom: '1px solid #edf2f7',
                      transition: 'background-color 0.2s'
                    }}
                    className="hover:bg-gray-50"
                  >
                    <div style={{ width: '100%' }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        marginBottom: 4
                      }}>
                        <Text strong style={{ fontSize: 12, color: '#4a5568' }}>
                          {new Date(item.created_at).toLocaleString()}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.user_name || 'System'}
                        </Text>
                      </div>
                      <Text style={{ 
                        display: 'block',
                        fontSize: 13,
                        lineHeight: 1.4
                      }}>
                        {item.details}
                      </Text>
                    </div>
                  </List.Item>
                )}
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
                  onClick={() => navigate('activities')}
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
                dataSource={activities.slice(0, 10)}
                renderItem={(item) => (
                  <List.Item 
                    style={{ 
                      padding: '12px 16px',
                      borderBottom: '1px solid #edf2f7',
                      transition: 'background-color 0.2s'
                    }}
                    className="hover:bg-gray-50"
                  >
                    <div style={{ width: '100%' }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        marginBottom: 4
                      }}>
                        <Text strong style={{ fontSize: 12, color: '#4a5568' }}>
                          {new Date(item.timestamp || item.created_at).toLocaleString()}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.user_name || 'System'}
                        </Text>
                      </div>
                      <Text style={{ 
                        display: 'block',
                        fontSize: 13,
                        lineHeight: 1.4
                      }}>
                        {item.action || item.details}
                      </Text>
                    </div>
                  </List.Item>
                )}
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

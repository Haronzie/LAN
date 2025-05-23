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

// Colors matching the original chart
const folderColors = {
  'Operation': '#13c2c2',
  'Training': '#faad14',
  'Research': '#52c41a'
};

// Convert array of colors to array format
const folderColorsArray = Object.values(folderColors);



  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await axios.get('/users', { withCredentials: true });
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
      const res = await axios.get('/files/all', { withCredentials: true });
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
      const res = await axios.get('/auditlogs', { withCredentials: true });
      setAuditLogs(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      message.error('Failed to fetch audit logs: ' + (error.message || 'Unknown error'));
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await axios.get('/activities', { withCredentials: true });
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
    <div className="dashboard-container" style={{ 
      maxWidth: 1200, 
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Title level={3} style={{ marginBottom: 24, textAlign: 'center' }}>
        Welcome to the Admin Dashboard
      </Title>
      
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card 
            bodyStyle={{ padding: '24px' }}
            style={{ height: '100%', borderRadius: 8 }}
            hoverable
          >
            <Statistic 
              title="Total Users" 
              value={totalUsers} 
              loading={loadingUsers}
              valueStyle={{ fontSize: 32, fontWeight: 600 }}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={8}>
          <Card 
            bodyStyle={{ padding: '24px' }}
            style={{ height: '100%', borderRadius: 8 }}
            hoverable
          >
            <Statistic 
              title="Total Files" 
              value={totalFiles} 
              loading={loadingFiles}
              valueStyle={{ fontSize: 32, fontWeight: 600 }}
              prefix={<FileOutlined />}
            />
          </Card>
        </Col>
        
        <Col xs={24} md={8}>
          <Card 
            bodyStyle={{ padding: '24px' }}
            style={{ height: '100%', borderRadius: 8 }}
            hoverable
          >
            <Statistic 
              title="Admin Users" 
              value={adminCount} 
              loading={loadingUsers}
              valueStyle={{ fontSize: 32, fontWeight: 600 }}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card 
            style={{ 
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}
            bodyStyle={{ padding: '0' }}
          >
            {/* Chart Header with Improved Layout */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '20px 24px 0',
              borderBottom: '1px solid #f0f0f0'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}>
                <Title level={4} style={{ margin: 0, fontSize: '18px' }}>
                  <CalendarOutlined style={{ marginRight: 8 }} /> 
                  File Upload Analytics
                </Title>
                
                {dateRange && (
                  <Button 
                    size="small"
                    type="primary" 
                    icon={<FilterOutlined />} 
                    onClick={() => setDateRange(null)}
                    style={{ marginLeft: 'auto', marginRight: '8px' }}
                  >
                    Clear Filter
                  </Button>
                )}
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: '8px' }}>
                  Select date range to filter data:
                </Text>
                <DatePicker.RangePicker 
                  onChange={(dates) => setDateRange(dates)}
                  format="MMM DD, YYYY"
                  placeholder={['Start Date', 'End Date']}
                  allowClear={true}
                  style={{ 
                    width: '100%',
                    height: '38px'
                  }}
                />
              </div>
            </div>
            {filteredChartData.length > 0 ? (
              <div style={{ width: '100%', height: 380, padding: '24px 24px 40px 24px' }}>
                <Bar
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                      padding: {
                        left: 24,
                        right: 24,
                        top: 24,
                        bottom: 40
                      }
                    },
                    plugins: {
                      legend: {
                        position: 'top',
                        align: 'center',
                        labels: {
                          boxWidth: 16,
                          usePointStyle: true,
                          pointStyle: 'circle',
                          padding: 20,
                          font: {
                            size: 13,
                            weight: 500
                          }
                        }
                      },
                      title: {
                        display: false,
                      },
                      tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        titleFont: {
                          size: 14,
                          weight: 'bold'
                        },
                        bodyFont: {
                          size: 13
                        },
                        padding: 12,
                        cornerRadius: 6,
                        boxPadding: 6,
                        callbacks: {
                          title: (tooltipItems) => {
                            return tooltipItems[0].label;
                          },
                          label: (context) => {
                            const folderName = context.dataset.label;
                            const value = context.raw || 0;
                            return `${folderName}: ${value}`;
                          }
                        }
                      }
                    },
                    scales: {
                      x: {
                        title: {
                          display: true,
                          text: 'Month',
                          color: '#333',
                          font: {
                            weight: '600',
                            size: 16,
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                          },
                          padding: { top: 5, bottom: 25 }
                        },
                        grid: {
                          display: true,
                          drawBorder: true,
                          borderDash: [],
                          color: 'rgba(0, 0, 0, 0.05)',
                          drawOnChartArea: false,
                          drawTicks: false
                        },
                        ticks: {
                          maxRotation: 0,
                          minRotation: 0,
                          padding: 15,
                          font: {
                            size: 14,
                            weight: '600',
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                          },
                          color: '#333',
                          autoSkip: false
                        }
                      },
                      y: {
                        title: {
                          display: true,
                          text: 'Number of Files',
                          color: '#555',
                          font: {
                            weight: '600',
                            size: 14,
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                          },
                          padding: { bottom: 10, top: 10, left: 10, right: 10 },
                          rotation: 0,
                          position: 'left'
                        },
                        afterFit: function(scaleInstance) {
                          // Add some extra padding for the horizontal label
                          scaleInstance.paddingLeft += 15;
                        },
                        beginAtZero: true,
                        border: {
                          display: true,
                          dash: [4, 4],
                          color: 'rgba(0, 0, 0, 0.1)'
                        },
                        grid: {
                          display: true,
                          color: 'rgba(0, 0, 0, 0.05)',
                          borderDash: [2, 4]
                        },
                        ticks: {
                          precision: 0,
                          stepSize: 1,
                          padding: 10,
                          color: '#666',
                          font: {
                            size: 12,
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                          }
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
                        backgroundColor: folderColorsArray[index],
                      };
                    })
                  }}
                />
              </div>
            ) : (
              <Text type="secondary">No uploads available</Text>
            )}
          </Card>
        </Col>
        
        <Col xs={24} lg={12}>
          <Card 
            title="Recent Audit Logs"
            style={{ borderRadius: 8, marginBottom: 24 }}
            headStyle={{ borderBottom: 0, padding: '16px 24px 8px' }}
            bodyStyle={{ padding: '16px 24px' }}
            extra={
              <Button 
                type="link" 
                size="small" 
                onClick={() => navigate('audit-logs')}
                style={{ padding: '0 4px' }}
              >
                View All
              </Button>
            }
          >
            {auditLogs.length > 0 ? (
              <List
                size="small"
                dataSource={auditLogs.slice(0, 5)}
                renderItem={(item) => (
                  <List.Item style={{ padding: '8px 0' }}>
                    <div style={{ width: '100%' }}>
                      <Text strong style={{ display: 'block' }}>
                        {new Date(item.created_at).toLocaleString()}
                      </Text>
                      <Text type="secondary" style={{ display: 'block' }}>
                        {item.details}
                      </Text>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">No audit logs available</Text>
            )}
          </Card>
          
          <Card 
            title="Recent User Activities"
            style={{ borderRadius: 8 }}
            headStyle={{ borderBottom: 0, padding: '16px 24px 8px' }}
            bodyStyle={{ padding: '16px 24px' }}
            extra={
              <Button 
                type="link" 
                size="small" 
                onClick={() => navigate('user-activities')}
                style={{ padding: '0 4px' }}
              >
                View All
              </Button>
            }
          >
            {activities.length > 0 ? (
              <List
                size="small"
                dataSource={activities.slice(0, 3)}
                renderItem={(item) => (
                  <List.Item style={{ padding: '8px 0' }}>
                    <div style={{ width: '100%' }}>
                      <Text strong style={{ display: 'block' }}>
                        {new Date(item.timestamp).toLocaleString()}
                      </Text>
                      <Text type="secondary" style={{ display: 'block' }}>
                        {item.event}
                      </Text>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">No user activities available</Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AdminDashboardHome;

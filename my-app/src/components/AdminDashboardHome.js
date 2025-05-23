import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Statistic, List, Button, Typography, message } from 'antd';
import { UserOutlined, FileOutlined, TeamOutlined } from '@ant-design/icons';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title as ChartTitle, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import axios from 'axios';

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

// Transform data for Recharts format - we need each month to have all folder values
const transformedChartData = [];

// Get unique month/years
const uniqueMonthYears = [...new Set(Object.keys(uploadsPerFolderMonth))];

// Sort by month/year
const monthOrder = [
  'January','February','March','April','May','June','July','August','September','October','November','December'
];

uniqueMonthYears.sort((a, b) => {
  const [aMonth, aYear] = a.split(' ');
  const [bMonth, bYear] = b.split(' ');
  if (aYear !== bYear) return parseInt(aYear) - parseInt(bYear);
  return monthOrder.indexOf(aMonth) - monthOrder.indexOf(bMonth);
});

// Create data points with all folders for each month
uniqueMonthYears.forEach(monthYear => {
  const dataPoint = { monthYear };
  
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

console.log('Transformed Chart data:', transformedChartData);

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
    <div style={{ padding: '16px 24px', maxWidth: 1200, margin: '0 auto' }}>
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
            title="Uploads Per User Per Month"
            style={{ borderRadius: 8 }}
            headStyle={{ borderBottom: 0, padding: '16px 24px 8px' }}
            bodyStyle={{ padding: '16px 24px' }}
          >
            {transformedChartData.length > 0 ? (
              <div style={{ width: '100%', height: 320 }}>
                <Bar
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top',
                      },
                      title: {
                        display: false,
                      },
                      tooltip: {
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
                          text: 'MONTH'
                        },
                        ticks: {
                          maxRotation: 45,
                          minRotation: 45
                        }
                      },
                      y: {
                        title: {
                          display: true,
                          text: 'NUMBER OF UPLOAD FILES'
                        },
                        beginAtZero: true,
                        ticks: {
                          precision: 0
                        }
                      }
                    }
                  }}
                  data={{
                    labels: transformedChartData.map(item => item.monthYear),
                    datasets: validFolders.map((folder, index) => {
                      const capitalizedFolder = folder.charAt(0).toUpperCase() + folder.slice(1);
                      return {
                        label: capitalizedFolder,
                        data: transformedChartData.map(item => item[capitalizedFolder] || 0),
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

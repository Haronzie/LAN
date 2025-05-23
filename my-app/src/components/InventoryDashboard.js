import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Row, Col, Card, Statistic, Table, Button, Modal, Form, Input, InputNumber, Tag, message,
  Space, Typography, Tooltip, Select, DatePicker, Tabs, Progress, Empty, Badge, Dropdown, Menu
} from 'antd';
import { 
  PlusOutlined, 
  SearchOutlined, 
  FilterOutlined, 
  SyncOutlined,
  StockOutlined,
  ShoppingCartOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  DownloadOutlined,
  AppstoreOutlined,
  TableOutlined,
  MoreOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  BarcodeOutlined,
  BarChartOutlined,
  EditOutlined,
  CopyOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  ShopOutlined,
  SafetyCertificateOutlined,
  MedicineBoxOutlined,
  ToolOutlined,
  AlertOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { Bar } from 'react-chartjs-2';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import 'chart.js/auto';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/en';

// Extend dayjs with relativeTime plugin
dayjs.extend(relativeTime);
dayjs.locale('en');

// Helper function to safely format dates
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = dayjs(dateString);
  return date.isValid() ? date.fromNow() : 'N/A';
};

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const statusFilters = [
  { text: 'In Stock', value: 'in_stock' },
  { text: 'Low Stock', value: 'low_stock' },
  { text: 'Out of Stock', value: 'out_of_stock' },
];

const InventoryDashboard = () => {
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [editingItem, setEditingItem] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [viewMode, setViewMode] = useState('table');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: [],
    searchText: '',
    dateRange: null,
    category: []
  });
  const [tableParams, setTableParams] = useState({
    pagination: {
      current: 1,
      pageSize: 10,
    },
    sorter: {
      field: 'updatedAt',
      order: 'descend',
    },
  });

  // CDRRMO specific categories
  const categories = [
    'Medical Supplies',
    'First Aid Kits',
    'Emergency Equipment',
    'Rescue Gear',
    'Food & Water',
    'Hygiene Kits',
    'Communication Devices',
    'Safety Equipment'
  ];

  // Common CDRRMO inventory items with default thresholds
  const defaultItems = [
    { name: 'Alcohol (500ml)', category: 'Medical Supplies', quantity: 50, lowStockThreshold: 15, unit: 'bottles' },
    { name: 'Surgical Masks (box)', category: 'Medical Supplies', quantity: 30, lowStockThreshold: 5, unit: 'boxes' },
    { name: 'Bandages (set)', category: 'First Aid Kits', quantity: 100, lowStockThreshold: 20, unit: 'sets' },
    { name: 'First Aid Kit', category: 'First Aid Kits', quantity: 25, lowStockThreshold: 5, unit: 'kits' },
    { name: 'Emergency Blanket', category: 'Emergency Equipment', quantity: 50, lowStockThreshold: 10, unit: 'pcs' },
    { name: 'Flashlight', category: 'Emergency Equipment', quantity: 20, lowStockThreshold: 5, unit: 'pcs' },
    { name: 'Batteries (AA)', category: 'Emergency Equipment', quantity: 100, lowStockThreshold: 30, unit: 'pcs' },
    { name: 'Bottled Water (1L)', category: 'Food & Water', quantity: 200, lowStockThreshold: 50, unit: 'bottles' },
    { name: 'Emergency Food Pack', category: 'Food & Water', quantity: 100, lowStockThreshold: 25, unit: 'packs' },
    { name: 'Hygiene Kit', category: 'Hygiene Kits', quantity: 50, lowStockThreshold: 10, unit: 'kits' },
    { name: 'Two-Way Radio', category: 'Communication Devices', quantity: 15, lowStockThreshold: 3, unit: 'units' },
    { name: 'Megaphone', category: 'Communication Devices', quantity: 5, lowStockThreshold: 1, unit: 'units' },
    { name: 'Helmet', category: 'Safety Equipment', quantity: 30, lowStockThreshold: 5, unit: 'pcs' },
    { name: 'Safety Vest', category: 'Safety Equipment', quantity: 25, lowStockThreshold: 5, unit: 'pcs' },
    { name: 'Life Vest', category: 'Rescue Gear', quantity: 20, lowStockThreshold: 5, unit: 'pcs' },
    { name: 'Rope (50m)', category: 'Rescue Gear', quantity: 10, lowStockThreshold: 2, unit: 'rolls' },
    { name: 'Portable Generator', category: 'Emergency Equipment', quantity: 5, lowStockThreshold: 1, unit: 'units' },
    { name: 'Tarp (4x6m)', category: 'Emergency Equipment', quantity: 15, lowStockThreshold: 3, unit: 'pcs' },
    { name: 'Portable Toilet', category: 'Hygiene Kits', quantity: 10, lowStockThreshold: 2, unit: 'units' },
    { name: 'Whistle', category: 'Safety Equipment', quantity: 50, lowStockThreshold: 10, unit: 'pcs' }
  ];

  // Status options for filtering with CDRRMO specific labels and icons
  const statusOptions = [
    { 
      value: 'in_stock', 
      label: 'Adequate Stock',
      icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />
    },
    { 
      value: 'low_stock', 
      label: 'Needs Restocking',
      icon: <ExclamationCircleOutlined style={{ color: '#faad14' }} />
    },
    { 
      value: 'out_of_stock', 
      label: 'Critical - Out of Stock',
      icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
    }
  ];

  // Create status filters for the table with icons
  const statusFilters = statusOptions.map(opt => ({
    text: (
      <span>
        {React.cloneElement(opt.icon, { style: { ...opt.icon.props.style, marginRight: 8 } })}
        {opt.label}
      </span>
    ),
    value: opt.value
  }));

  // Helper functions for status
  const getStatusColor = (status) => {
    switch(status) {
      case 'In Stock': return 'green';
      case 'Low Stock': return 'orange';
      case 'Out of Stock': return 'red';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'In Stock': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'Low Stock': return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      case 'Out of Stock': return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default: return <InfoCircleOutlined />;
    }
  };

  // Calculate item status
  const getItemStatus = (item) => {
    const quantity = item.quantity || 0;
    const lowStockThreshold = item.lowStockThreshold || 5;
    
    if (quantity === 0) return 'Out of Stock';
    if (quantity <= lowStockThreshold) return 'Low Stock';
    return 'In Stock';
  };

  // Render content area based on view mode
  const renderContentArea = () => {
    if (loading) {
      return (
        <Card style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <SyncOutlined spin style={{ fontSize: 32, marginBottom: 16, color: '#1890ff' }} />
            <div>Loading inventory data...</div>
          </div>
        </Card>
      );
    }

    if (filteredItems.length === 0) {
      return (
        <Card style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="No inventory items found" />
        </Card>
      );
    }

    if (viewMode === 'table') {
      return (
        <Table 
          columns={columns} 
          dataSource={filteredItems} 
          rowKey="id"
          pagination={{ 
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100']
          }}
        />
      );
    }

    // Card view
    return (
      <Row gutter={[16, 16]}>
        {filteredItems.map(item => (
          <Col key={item.id} xs={24} sm={12} lg={8} xl={6}>
            <Card 
              hoverable
              cover={
                <div style={{ 
                  height: 140, 
                  backgroundColor: '#f0f2f5', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center'
                }}>
                  {getStatusIcon(getItemStatus(item))}
                </div>
              }
              actions={[
                <EditOutlined key="edit" onClick={() => handleEdit(item)} />,
                <DeleteOutlined key="delete" onClick={() => handleDelete(item.id)} />
              ]}
            >
              <Card.Meta
                title={item.name}
                description={
                  <>
                    <div>SKU: {item.sku || 'N/A'}</div>
                    <div>Category: {item.category || 'Uncategorized'}</div>
                    <div>Quantity: {item.quantity} {item.unit || 'units'}</div>
                    <div>
                      Status: <Tag color={getStatusColor(getItemStatus(item))}>
                        {getItemStatus(item)}
                      </Tag>
                    </div>
                  </>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

  // Calculate statistics for CDRRMO dashboard
  const { stats, categoryStats, statusStats } = useMemo(() => {
    const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const totalItems = items.length;
    const itemsNeedingRestock = items.filter(item => (item.quantity || 0) <= (item.lowStockThreshold || 5)).length;
    
    const lowStockItems = items.filter(item => {
      const qty = item.quantity || 0;
      return qty > 0 && qty <= (item.lowStockThreshold || 5);
    }).length;
    
    const outOfStockItems = items.filter(item => (item.quantity || 0) === 0).length;
    const inStockItems = totalItems - lowStockItems - outOfStockItems;
    
    // Calculate category distribution
    const categoryDistribution = {};
    items.forEach(item => {
      const category = item.category || 'Uncategorized';
      categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;
    });
    
    return {
      stats: {
        totalItems,
        totalQuantity,
        lowStockItems,
        outOfStockItems,
        inStockItems: totalItems - lowStockItems - outOfStockItems,
        itemsNeedingRestock,
        restockUrgency: itemsNeedingRestock > 10 ? 'High' : itemsNeedingRestock > 5 ? 'Medium' : 'Low'
      },
      categoryStats: Object.entries(categoryDistribution).map(([name, count]) => ({
        name,
        count,
        percent: Math.round((count / totalItems) * 100) || 0
      })),
      statusStats: {
        inStock: inStockItems,
        lowStock: lowStockItems,
        outOfStock: outOfStockItems
      }
    };
  }, [items]);

  // Chart data for inventory status
  const statusChartData = {
    labels: ['In Stock', 'Low Stock', 'Out of Stock'],
    datasets: [{
      label: 'Items by Status',
      data: [
        statusStats.inStock,
        statusStats.lowStock,
        statusStats.outOfStock
      ],
      backgroundColor: [
        'rgba(75, 192, 192, 0.6)',
        'rgba(255, 206, 86, 0.6)',
        'rgba(255, 99, 132, 0.6)'
      ],
      borderColor: [
        'rgba(75, 192, 192, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(255, 99, 132, 1)'
      ],
      borderWidth: 1
    }]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Inventory Status Distribution',
      },
    },
  };

  // Fetch inventory from backend
  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:8080/inventory', { 
        withCredentials: true,
        params: {
          page: tableParams.pagination.current,
          pageSize: tableParams.pagination.pageSize,
          sortField: tableParams.sorter.field,
          sortOrder: tableParams.sorter.order,
          ...(filters.status?.length && { status: filters.status }),
          ...(filters.searchText && { search: filters.searchText }),
          ...(filters.dateRange && filters.dateRange[0] && filters.dateRange[1] && {
            startDate: filters.dateRange[0].format('YYYY-MM-DD'),
            endDate: filters.dateRange[1].format('YYYY-MM-DD')
          })
        }
      });
      
      // Transform the response to match the expected format
      const items = Array.isArray(res.data) ? res.data : [];
      setItems(items);
      setFilteredItems(items);
      setTableParams(prev => ({
        ...prev,
        pagination: {
          ...prev.pagination,
          total: items.length,
        },
      }));
    } catch (error) {
      console.error('Error fetching inventory:', error);
      message.error('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  }, [tableParams.pagination.current, tableParams.pagination.pageSize, tableParams.sorter, filters]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Handle table changes (pagination, filters, sorter)
  const handleTableChange = (pagination, filters, sorter) => {
    setTableParams({
      pagination,
      sorter: {
        field: sorter.field,
        order: sorter.order,
      },
    });
  };

  // Handle form submission
  const onFinish = async (values) => {
    try {
      const baseUrl = 'http://localhost:8080/inventory';
      
      if (editingItem) {
        // Update existing item
        await axios.put(`${baseUrl}/${editingItem.id}`, values, { withCredentials: true });
        message.success('Item updated successfully');
      } else {
        // Add new item
        await axios.post(baseUrl, values, { withCredentials: true });
        message.success('Item added successfully');
      }
      
      setModalVisible(false);
      form.resetFields();
      setEditingItem(null);
      fetchInventory();
    } catch (error) {
      console.error('Error saving item:', error);
      message.error(error.response?.data?.message || `Failed to ${editingItem ? 'update' : 'add'} item`);
    }
  };

  // Handle edit item
  const handleEdit = (record) => {
    setEditingItem(record);
    form.setFieldsValue({
      ...record,
      lowStockThreshold: record.lowStockThreshold || 5,
      category: record.category || undefined
    });
    setModalVisible(true);
  };

  // Handle delete item
  const handleDelete = async (id) => {
    Modal.confirm({
      title: 'Are you sure you want to delete this item?',
      content: 'This action cannot be undone.',
      okText: 'Yes, delete it',
      okType: 'danger',
      cancelText: 'No, cancel',
      onOk: async () => {
        try {
          await axios.delete(`http://localhost:8080/inventory/${id}`, { 
            withCredentials: true 
          });
          message.success('Item deleted successfully');
          fetchInventory();
        } catch (error) {
          console.error('Error deleting item:', error);
          message.error(error.response?.data?.message || 'Failed to delete item');
        }
      },
    });
  };

  // Handle search
  const handleSearch = (value) => {
    setFilters(prev => ({ ...prev, searchText: value }));
  };

  // Handle status filter
  const handleStatusFilter = (value) => {
    setFilters(prev => ({ ...prev, status: value }));
  };

  // Handle date range filter
  const handleDateRangeChange = (dates) => {
    setFilters(prev => ({ ...prev, dateRange: dates }));
  };

  // Reset all filters
  const resetFilters = () => {
    setFilters({
      status: [],
      searchText: '',
      dateRange: null
    });
  };

  // CDRRMO Table columns with enhanced organization
  const columns = [
    {
      title: 'Item Details',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      fixed: 'left',
      width: 300,
      render: (text, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: getStatusColor(getItemStatus(record)) + '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {getStatusIcon(getItemStatus(record))}
          </div>
          <div>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>{text}</div>
            <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
              <Tag color="blue" style={{ margin: 0 }}>{record.category}</Tag>
              <span>SKU: {record.sku}</span>
            </div>
          </div>
        </div>
      ),
      render: (text, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: 'var(--ant-primary-1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <BarcodeOutlined style={{ color: 'var(--ant-primary-color)' }} />
          </div>
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.sku || 'No SKU'}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      filters: categories.map(cat => ({ text: cat, value: cat })),
      filteredValue: filters.category,
      onFilter: (value, record) => record.category === value,
      render: (category) => category || 'Uncategorized',
      width: 150,
    },
    {
      title: 'Status',
      key: 'status',
      filters: statusOptions,
      filteredValue: filters.status,
      onFilter: (value, record) => {
        const status = getItemStatus(record);
        return status.toLowerCase().replace(' ', '_') === value;
      },
      render: (_, record) => {
        const status = getItemStatus(record);
        const color = getStatusColor(status);
        const icon = getStatusIcon(status);
        
        return (
          <Tag 
            color={color} 
            icon={icon}
            style={{ 
              margin: 0,
              display: 'flex', 
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 4
            }}
          >
            {status}
          </Tag>
        );
      },
      width: 150,
    },
    {
      title: 'Inventory Details',
      key: 'inventoryDetails',
      render: (_, record) => {
        const quantity = record.quantity || 0;
        const threshold = record.lowStockThreshold || 5;
        const daysSinceRestock = record.lastRestocked 
          ? Math.floor((new Date() - new Date(record.lastRestocked)) / (1000 * 60 * 60 * 24)) 
          : null;
        const expiryDate = record.expiryDate ? new Date(record.expiryDate) : null;
        const daysToExpiry = expiryDate ? Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
        
        return (
          <div style={{ minWidth: 250 }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Current Stock:</Text>
                <Text strong>{quantity} {record.unit || 'pcs'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Minimum Required:</Text>
                <Text>{record.minRequired || Math.ceil(threshold * 0.5)} {record.unit || 'pcs'}</Text>
              </div>
              {daysSinceRestock !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Last Restocked:</Text>
                  <Tooltip title={dayjs(record.lastRestocked).format('MMM D, YYYY')}>
                    <Text>{daysSinceRestock} days ago</Text>
                  </Tooltip>
                </div>
              )}
              {daysToExpiry !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Expires in:</Text>
                  <Text type={daysToExpiry <= 30 ? 'danger' : 'secondary'}>
                    {daysToExpiry > 0 ? `${daysToExpiry} days` : 'Expired'}
                  </Text>
                </div>
              )}
            </div>
          </div>
        );
      },
      width: 250,
    },
    {
      title: 'Location & Supplier',
      key: 'locationSupplier',
      render: (_, record) => (
        <div style={{ minWidth: 200 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <EnvironmentOutlined style={{ color: '#1890ff' }} />
              <div>
                <div style={{ fontWeight: 500 }}>{record.location || 'Main Storage'}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>Location</Text>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShopOutlined style={{ color: '#722ed1' }} />
              <div>
                <div style={{ fontWeight: 500 }}>{record.supplier || 'CDRRMO Central Supply'}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>Supplier</Text>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(0, 0, 0, 0.45)' }}>
            Updated {formatDate(record.updatedAt)}
          </div>
        </div>
      ),
      width: 250,
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_, record) => (
        <Dropdown
          overlay={
            <Menu>
              <Menu.Item key="edit" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                Edit
              </Menu.Item>
              <Menu.Item key="duplicate" icon={<CopyOutlined />}>
                Duplicate
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item 
                key="delete" 
                icon={<DeleteOutlined />} 
                danger
                onClick={() => {
                  Modal.confirm({
                    title: 'Delete Item',
                    content: `Are you sure you want to delete "${record.name}"?`,
                    okText: 'Delete',
                    okType: 'danger',
                    cancelText: 'Cancel',
                    onOk: () => handleDelete(record.id),
                  });
                }}
              >
                Delete
              </Menu.Item>
            </Menu>
          }
          trigger={['click']}
        >
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  // Render inventory item card
  const renderItemCard = (item) => {
    const status = getItemStatus(item);
    const statusColor = getStatusColor(status);
    
    return (
      <Card 
        key={item.id}
        style={{ width: '100%', marginBottom: 16, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
        actions={[
          <Button type="link" onClick={() => handleEdit(item)}>Edit</Button>,
          <Button type="link" danger onClick={() => handleDelete(item.id)}>Delete</Button>
        ]}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              backgroundColor: `var(--ant-primary-1)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <BarcodeOutlined style={{ fontSize: 20, color: 'var(--ant-primary-color)' }} />
            </div>
            <div>
              <Title level={5} style={{ margin: 0 }}>{item.name}</Title>
              <Text type="secondary">SKU: {item.sku || 'N/A'}</Text>
            </div>
          </div>
          <Tag color={statusColor} style={{ margin: 0 }}>
            {status}
          </Tag>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '16px 0' }}>
          <div>
            <Text type="secondary">Quantity</Text>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {item.quantity || 0} {item.unit || 'units'}
            </div>
          </div>
          <div>
            <Text type="secondary">Threshold</Text>
            <div>{item.lowStockThreshold || 5} units</div>
          </div>
          <div>
            <Text type="secondary">Last Updated</Text>
            <div>{item.updatedAt ? dayjs(item.updatedAt).format('MMM D, YYYY') : 'N/A'}</div>
          </div>
        </div>
        
        {item.quantity > 0 && (
          <div style={{ marginTop: 8 }}>
            <Progress 
              percent={Math.min(100, Math.round(((item.quantity || 0) / ((item.lowStockThreshold || 5) * 2)) * 100))}
              status={status === 'Low Stock' ? 'exception' : status === 'Out of Stock' ? 'exception' : 'normal'}
              strokeColor={status === 'Low Stock' ? '#faad14' : status === 'Out of Stock' ? '#ff4d4f' : '#52c41a'}
              showInfo={false}
            />
          </div>
        )}
      </Card>
    );
  };

  // Export functions
  const exportToExcel = () => {
    try {
      const dataToExport = filteredItems.map(item => ({
        'Item Name': item.name,
        'Category': item.category,
        'Quantity': item.quantity,
        'Unit': item.unit || 'pcs',
        'Minimum Required': item.minRequired || 0,
        'Status': getItemStatus(item),
        'Last Updated': dayjs(item.updatedAt).format('YYYY-MM-DD HH:mm'),
        'Expiry Date': item.expiryDate ? dayjs(item.expiryDate).format('YYYY-MM-DD') : 'N/A',
        'Location': item.location || 'Main Storage',
        'Last Restocked': item.lastRestocked ? dayjs(item.lastRestocked).format('YYYY-MM-DD') : 'N/A',
        'Supplier': item.supplier || 'CDRRMO Central Supply',
        'Notes': '' // Empty column for manual notes
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'CDRRMO_Inventory');
      
      // Auto-size columns
      const wscols = [
        { wch: 30 }, // Item Name
        { wch: 20 }, // Category
        { wch: 10 }, // Quantity
        { wch: 10 }, // Unit
        { wch: 15 }, // Minimum Required
        { wch: 20 }, // Status
        { wch: 20 }, // Last Updated
        { wch: 15 }, // Expiry Date
        { wch: 15 }, // Location
        { wch: 15 }, // Last Restocked
        { wch: 25 }, // Supplier
        { wch: 30 }  // Notes
      ];
      worksheet['!cols'] = wscols;
      
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(data, `CDRRMO_Inventory_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`);
      
      message.success('CDRRMO inventory exported successfully');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      message.error('Failed to export CDRRMO inventory');
    } finally {
      setExportLoading(false);
    }
  };

  // Fetch inventory data from backend API
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // TODO: Replace with your actual API endpoint
      const response = await axios.get('/api/inventory', { withCredentials: true });
      setItems(response.data);
      setFilteredItems(response.data);
    } catch (error) {
      console.error('Error fetching inventory data:', error);
      message.error('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div style={{ 
      padding: '24px', 
      background: '#f0f2f5', 
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start'
    }}>
      <div style={{ 
        width: '100%',
        maxWidth: '1600px',
        margin: 0,
        padding: 0
      }}>
        {/* Header */}
        <div style={{ 
          backgroundColor: '#fff',
          padding: '16px 24px',
          borderRadius: '8px',
          marginBottom: '24px',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingCartOutlined />
              <span>Inventory Management</span>
            </Title>
            <Text type="secondary">Manage and track your inventory items</Text>
          </div>
          <Space>
            <Dropdown 
              overlay={
                <Menu>
                  <Menu.Item key="exportExcel" icon={<FileExcelOutlined />} onClick={exportToExcel}>
                    Export to Excel
                  </Menu.Item>
                  <Menu.Item key="exportPDF" icon={<FilePdfOutlined />} disabled>
                    Export to PDF (Coming Soon)
                  </Menu.Item>
                </Menu>
              }
              trigger={['click']}
            >
              <Button loading={exportLoading} icon={<DownloadOutlined />}>
                Export
              </Button>
            </Dropdown>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => {
                setEditingItem(null);
                form.resetFields();
                setModalVisible(true);
              }}
            >
              Add Item
            </Button>
          </Space>
        </div>

        {/* Tabs for different views */}
        <div style={{ 
          marginBottom: 24,
          backgroundColor: '#fff',
          padding: '16px 24px',
          borderRadius: '8px',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)'
        }}>
          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab}
          >
            <TabPane tab={<span><BarChartOutlined /> Overview</span>} key="overview">
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={6}>
                  <Card>
                    <Statistic 
                      title="Total Items" 
                      value={stats.totalItems}
                      prefix={<ShoppingCartOutlined style={{ color: '#1890ff' }} />}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card>
                    <Statistic 
                      title="Total Quantity" 
                      value={stats.totalQuantity}
                      prefix={<StockOutlined style={{ color: '#52c41a' }} />}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card>
                    <Statistic 
                      title="Low Stock" 
                      value={stats.lowStockItems}
                      prefix={<ExclamationCircleOutlined style={{ color: '#faad14' }} />}
                      valueStyle={{ color: '#faad14' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card>
                    <Statistic 
                      title="Out of Stock" 
                      value={stats.outOfStockItems}
                      prefix={stats.outOfStockItems > 0 ? 
                        <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> : 
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                      valueStyle={{ 
                        color: stats.outOfStockItems > 0 ? '#ff4d4f' : '#52c41a' 
                      }}
                    />
                  </Card>
                </Col>
              </Row>

              {/* Charts Row */}
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} lg={16}>
                  <Card title="Inventory Status" style={{ height: '100%' }}>
                    <Bar data={statusChartData} options={chartOptions} />
                  </Card>
                </Col>
                <Col xs={24} lg={8}>
                  <Card title="Categories" style={{ height: '100%' }}>
                    {categoryStats.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {categoryStats.map(cat => (
                          <div key={cat.name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text>{cat.name}</Text>
                              <Text strong>{cat.count} ({cat.percent}%)</Text>
                            </div>
                            <Progress 
                              percent={cat.percent} 
                              showInfo={false}
                              strokeColor="var(--ant-primary-color)"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty description="No category data available" />
                    )}
                  </Card>
                </Col>
              </Row>
            </TabPane>
            
            <TabPane 
              tab={<span><TableOutlined /> All Items</span>} 
              key="items"
              tabBarExtraContent={{
                right: (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button 
                      type={viewMode === 'table' ? 'primary' : 'default'} 
                      icon={<TableOutlined />} 
                      onClick={() => setViewMode('table')}
                      title="Table View"
                    />
                    <Button 
                      type={viewMode === 'card' ? 'primary' : 'default'} 
                      icon={<AppstoreOutlined />} 
                      onClick={() => setViewMode('card')}
                      title="Card View"
                    />
                  </div>
                )
              }}
            >
              <div style={{ marginTop: 16 }}>
                {renderContentArea()}
              </div>
            </TabPane>
          </Tabs>
        </div>

        {/* Add/Edit Item Modal */}
        <Modal
          title={editingItem ? 'Edit Item' : 'Add New Item'}
          open={modalVisible}
          onCancel={() => {
            form.resetFields();
            setModalVisible(false);
          }}
          footer={null}
          width={600}
          destroyOnClose
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{ lowStockThreshold: 5 }}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="name"
                  label="Item Name"
                  rules={[{ required: true, message: 'Please enter item name' }]}
                >
                  <Input placeholder="Enter item name" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="sku"
                  label="SKU"
                  rules={[{ required: true, message: 'Please enter SKU' }]}
                >
                  <Input placeholder="Enter SKU" />
                </Form.Item>
              </Col>
            </Row>
            
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="quantity"
                  label="Quantity"
                  rules={[{ required: true, message: 'Please enter quantity' }]}
                >
                  <InputNumber 
                    min={0}
                    style={{ width: '100%' }} 
                    placeholder="Enter quantity" 
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="lowStockThreshold"
                  label="Low Stock Threshold"
                  tooltip="Alert when quantity falls below this number"
                >
                  <InputNumber 
                    min={1}
                    style={{ width: '100%' }} 
                    placeholder="Enter threshold" 
                  />
                </Form.Item>
              </Col>
            </Row>
            
            <Form.Item
              name="description"
              label="Description"
            >
              <Input.TextArea rows={3} placeholder="Enter item description (optional)" />
            </Form.Item>
            
            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Button 
                style={{ marginRight: 8 }} 
                onClick={() => {
                  form.resetFields();
                  setModalVisible(false);
                }}
              >
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                {form.getFieldValue('id') ? 'Update Item' : 'Add Item'}
              </Button>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default InventoryDashboard;
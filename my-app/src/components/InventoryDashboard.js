import React, { useState, useEffect } from 'react';
import {
  Layout, Row, Col, Card, Statistic, List, Button, Modal, Form, Input, message, Divider,
} from 'antd';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bar, Pie } from '@ant-design/charts';

const { Content } = Layout;

const InventoryDashboard = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const navigate = useNavigate();

  // Fetch inventory from backend
  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/inventory', { withCredentials: true });
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      message.error('Error fetching inventory data');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Compute total quantity
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  // Handle form submission
  const onFinish = async (values) => {
    try {
      const payload = {
        item_name: values.item_name,
        quantity: Number(values.quantity),
      };
      await axios.post('/inventory', payload, { withCredentials: true });
      message.success('Item added successfully');
      form.resetFields();
      setModalVisible(false);
      fetchInventory();
    } catch (error) {
      message.error('Error adding item');
    }
  };

  // Bar chart data
  const barConfig = {
    data: items.map((item) => ({ name: item.item_name, quantity: item.quantity })),
    xField: 'quantity',
    yField: 'name',
    seriesField: 'name',
    legend: false,
  };

  // Pie chart data
  const pieConfig = {
    data: items.map((item) => ({ type: item.item_name, value: item.quantity })),
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    label: { type: 'inner', content: '{name} ({percentage})' },
  };

  return (
    <Content style={{ padding: '24px', background: '#f0f2f5' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Back Button */}
        <Row style={{ marginBottom: 16 }}>
          <Col>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/user/home')}>
              Back to Dashboard
            </Button>
          </Col>
        </Row>

        {/* Statistics & Add Item Button */}
        <Row gutter={[16, 16]} justify="space-between">
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic title="Total Inventory Quantity" value={totalQuantity} />
            </Card>
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              Add New Item
            </Button>
          </Col>
        </Row>

        <Divider />

        {/* Charts */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card title="Inventory Distribution">
              <Pie {...pieConfig} />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="Inventory Breakdown">
              <Bar {...barConfig} />
            </Card>
          </Col>
        </Row>

        <Divider />

        {/* Inventory List */}
        <Row>
          <Col span={24}>
            <Card title="Inventory List">
              <List
                loading={loading}
                itemLayout="horizontal"
                dataSource={items}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta title={item.item_name} description={`Quantity: ${item.quantity}`} />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>

        {/* Add Item Modal */}
        <Modal
          title="Add New Item"
          open={modalVisible}
          onCancel={() => setModalVisible(false)}
          footer={null}
        >
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Form.Item
              name="item_name"
              label="Item Name"
              rules={[{ required: true, message: 'Please enter the item name' }]}
            >
              <Input placeholder="Enter item name" />
            </Form.Item>
            <Form.Item
              name="quantity"
              label="Quantity"
              rules={[{ required: true, message: 'Please enter the quantity' }]}
            >
              <Input type="number" placeholder="Enter quantity" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                Add Item
              </Button>
            </Form.Item>
          </Form>
        </Modal>

      </div>
    </Content>
  );
};

export default InventoryDashboard;

import React, { useState, useEffect } from 'react';
import { Layout, Row, Col, Card, Statistic, List, Input, Button, Form, message, Divider } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Content } = Layout;

const InventoryDashboard = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // Fetch inventory list from backend
  const fetchInventory = async () => {
    setLoading(true);
    try {
      // The backend returns an array of items: [{ id, item_name, quantity, created_at, updated_at }, ...]
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

  // Compute total quantity from all items
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  // Handle form submission to add a new item
  const onFinish = async (values) => {
    try {
      // Match the backend’s expected JSON fields: { item_name, quantity }
      const payload = {
        item_name: values.item_name,
        quantity: Number(values.quantity),
      };
      await axios.post('/inventory', payload, { withCredentials: true });
      message.success('Item added successfully');
      form.resetFields();
      fetchInventory(); // Refresh the list
    } catch (error) {
      message.error('Error adding item');
    }
  };

  return (
    <Content style={{ padding: '24px', background: '#f0f2f5' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Row for "Back to Dashboard" button */}
        <Row style={{ marginBottom: 16 }}>
          <Col>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/user/home')}
            >
              Back to Dashboard
            </Button>
          </Col>
        </Row>

        {/* Statistics */}
        <Row gutter={[16, 16]} justify="center">
          <Col xs={24} sm={12}>
            <Card>
              <Statistic title="Total Quantity" value={totalQuantity} />
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
                    <List.Item.Meta
                      title={item.item_name}
                      description={`Quantity: ${item.quantity}`}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>

        <Divider />

        {/* Add Inventory Item Form */}
        <Card title="Add New Item">
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
        </Card>

      </div>
    </Content>
  );
};

export default InventoryDashboard;

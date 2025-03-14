import React, { useState, useEffect } from 'react';
import { Layout, Row, Col, Card, Statistic, List, Input, Button, Form, message, Divider } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';  // Import the arrow icon
import { useNavigate } from 'react-router-dom';          // For navigation
import axios from 'axios';

const { Content } = Layout;

const InventoryDashboard = () => {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // Fetch equipment list from backend
  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/inventory', { withCredentials: true });
      // Ensure that the equipment state is always an array
      setEquipment(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      message.error('Error fetching inventory data');
      setEquipment([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Compute totals from the equipment array
  const totalEquipment = equipment.reduce((sum, item) => sum + item.total_quantity, 0);
  const remainingEquipment = equipment.reduce((sum, item) => sum + item.remaining_quantity, 0);

  // Handle form submission to add new equipment
  const onFinish = async (values) => {
    try {
      const payload = {
        name: values.name,
        total_quantity: values.total_quantity,
        remaining_quantity: values.total_quantity, // Initially, remaining equals total
        reorder_level: values.reorder_level || 0,
      };
      await axios.post('/inventory', payload, { withCredentials: true });
      message.success('Equipment added successfully');
      form.resetFields();
      fetchInventory();
    } catch (error) {
      message.error('Error adding equipment');
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
              <Statistic title="Total Equipment" value={totalEquipment} />
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic title="Remaining Equipment" value={remainingEquipment} />
            </Card>
          </Col>
        </Row>

        <Divider />

        {/* Equipment List */}
        <Row>
          <Col span={24}>
            <Card title="Equipment List">
              <List
                loading={loading}
                itemLayout="horizontal"
                dataSource={equipment}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={item.name}
                      description={`Total: ${item.total_quantity}, Remaining: ${item.remaining_quantity}, Reorder Level: ${item.reorder_level}`}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>

        <Divider />

        {/* Add Equipment Form */}
        <Card title="Add Equipment">
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Form.Item
              name="name"
              label="Equipment Name"
              rules={[{ required: true, message: 'Please input the equipment name' }]}
            >
              <Input placeholder="Enter equipment name" />
            </Form.Item>
            <Form.Item
              name="total_quantity"
              label="Total Quantity"
              rules={[{ required: true, message: 'Please input the total quantity' }]}
            >
              <Input type="number" placeholder="Enter total quantity" />
            </Form.Item>
            <Form.Item name="reorder_level" label="Reorder Level">
              <Input type="number" placeholder="Enter reorder level (optional)" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                Add Equipment
              </Button>
            </Form.Item>
          </Form>
        </Card>

      </div>
    </Content>
  );
};

export default InventoryDashboard;

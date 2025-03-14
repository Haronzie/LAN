import React, { useState, useEffect } from 'react';
import { Layout, Row, Col, Card, Statistic, List, Input, Button, Form, message, Divider } from 'antd';
import axios from 'axios';

const { Content } = Layout;

const InventoryDashboard = () => {
  const [inventoryData, setInventoryData] = useState({
    totalEquipment: 0,
    remainingEquipment: 0,
    equipment: [],
  });
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  // Fetch inventory metrics and equipment list from backend
  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/inventory', { withCredentials: true });
      // Expected response structure: { totalEquipment, remainingEquipment, equipment: [{ id, name, count }] }
      setInventoryData(res.data);
    } catch (error) {
      message.error('Error fetching inventory data');
      // Fallback dummy data for demonstration purposes
      setInventoryData({
        totalEquipment: 10,
        remainingEquipment: 7,
        equipment: [
          { id: 1, name: 'Laptop', count: 5 },
          { id: 2, name: 'Projector', count: 2 },
          { id: 3, name: 'Tablet', count: 3 },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Handle form submission to add new equipment
  const onFinish = async (values) => {
    try {
      await axios.post('/inventory', values, { withCredentials: true });
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
        <Row gutter={[16, 16]} justify="center">
          <Col xs={24} sm={12}>
            <Card>
              <Statistic title="Total Equipment" value={inventoryData.totalEquipment} />
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic title="Remaining Equipment" value={inventoryData.remainingEquipment} />
            </Card>
          </Col>
        </Row>

        <Divider />

        <Row>
          <Col span={24}>
            <Card title="Equipment List">
              <List
                loading={loading}
                itemLayout="horizontal"
                dataSource={inventoryData.equipment}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={item.name}
                      description={`Count: ${item.count}`}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>

        <Divider />

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
              name="count"
              label="Count"
              rules={[{ required: true, message: 'Please input the count' }]}
            >
              <Input type="number" placeholder="Enter count" />
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

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import 'antd/dist/reset.css'; // Import Ant Design reset styles for version 5
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();

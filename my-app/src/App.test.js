import { render } from '@testing-library/react';
import App from './App';
import { BrowserRouter } from 'react-router-dom';

// Mock axios to prevent actual API calls during tests
jest.mock('axios', () => ({
  get: jest.fn(() => Promise.resolve({ data: { exists: true } })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
}));

test('renders App component without crashing', () => {
  // Wrap App in BrowserRouter since it uses react-router
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );

  // Test that the component renders without throwing
  expect(document.body).toBeInTheDocument();
});

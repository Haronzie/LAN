@echo off
echo Installing dependencies...
echo This may take a few minutes...

REM Install core dependencies
npm install react react-dom react-scripts

REM Install Ant Design and icons
npm install antd@5.4.0 @ant-design/icons@5.0.1

REM Install routing and HTTP libraries
npm install react-router-dom@6.10.0 axios@1.3.5

REM Install utility libraries
npm install lodash.debounce@4.0.8 path-browserify@1.0.1 react-toastify@9.1.2

REM Install testing libraries
npm install --save-dev @testing-library/jest-dom@5.16.5 @testing-library/react@13.4.0 @testing-library/user-event@13.5.0

echo Dependencies installed successfully!
echo You can now run the application using start-app.bat
pause

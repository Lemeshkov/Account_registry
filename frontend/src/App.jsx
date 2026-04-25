
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Импорт страниц
import DefectSheetPage from './pages/DefectSheetPage';
import ApprovalsPage from './pages/ApprovalsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegistryPage';
import MySheetsPage from './pages/MySheetsPage';
import DashboardPage from './pages/DashboardPage'; 
import RegistryPage from './pages/RegistryPage'; 
import AdminUsersPage from './pages/AdminUsersPage';
// Импорт компонентов
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import NotificationSnackbar from './components/NotificationSnackbar';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <NotificationProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="defect-sheets" element={<DefectSheetPage />} />
                <Route path="defect-sheet/:sheetId" element={<DefectSheetPage />} />
                <Route path="approvals" element={<ApprovalsPage />} />
                <Route path="my-sheets" element={<MySheetsPage />} />
                <Route path="payment-registry" element={<RegistryPage />} />
                <Route path="admin/users" element={<AdminUsersPage />} />
              </Route>
              
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            <NotificationSnackbar />
          </Router>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
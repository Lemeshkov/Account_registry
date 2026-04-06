
// import React from 'react';
// import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// import { ThemeProvider, createTheme } from '@mui/material/styles';
// import CssBaseline from '@mui/material/CssBaseline';

// // Импорт страниц
// import DefectSheetPage from './pages/DefectSheetPage';
// import ApprovalsPage from './pages/ApprovalsPage';
// import LoginPage from './pages/LoginPage';
// import RegisterPage from './pages/RegisterPage';
// import MySheetsPage from './pages/MySheetsPage';
// import { NotificationProvider } from './context/NotificationContext';

// // Импорт компонентов
// import Layout from './components/Layout';
// import ProtectedRoute from './components/ProtectedRoute';
// import NotificationSnackbar from './components/NotificationSnackbar';
// import { AuthProvider } from './context/AuthContext';

// const theme = createTheme({
//   palette: {
//     primary: { main: '#1976d2' },
//     secondary: { main: '#dc004e' },
//   },
// });

// function App() {
//   return (
//     <ThemeProvider theme={theme}>
//       <CssBaseline />
//       <AuthProvider>
//         <Router>
//           <Routes>
//             <Route path="/login" element={<LoginPage />} />
//             <Route path="/register" element={<RegisterPage />} />
            
//             <Route path="/" element={
//               <ProtectedRoute>
//                 <Layout />
//               </ProtectedRoute>
//             }>
//               <Route index element={<Navigate to="/defect-sheets" replace />} />
//               <Route path="defect-sheets" element={<DefectSheetPage />} />
//               <Route path="defect-sheet/:sheetId" element={<DefectSheetPage />} />
//               <Route path="approvals" element={<ApprovalsPage />} />
//               <Route path="my-sheets" element={<MySheetsPage />} />
//             </Route>
            
//             <Route path="*" element={<Navigate to="/" replace />} />
//           </Routes>
//           {/*  ВАЖНО: NotificationSnackbar должен быть ВНУТРИ Router, но после Routes */}
//           <NotificationSnackbar />
//         </Router>
//       </AuthProvider>
//     </ThemeProvider>
//   );
// }

// export default App;

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Импорт страниц
import DefectSheetPage from './pages/DefectSheetPage';
import ApprovalsPage from './pages/ApprovalsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MySheetsPage from './pages/MySheetsPage';

// Импорт компонентов
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import NotificationSnackbar from './components/NotificationSnackbar';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext'; // Добавляем импорт

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
        <NotificationProvider> {/* NotificationProvider должен быть внутри AuthProvider */}
          <Router>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/defect-sheets" replace />} />
                <Route path="defect-sheets" element={<DefectSheetPage />} />
                <Route path="defect-sheet/:sheetId" element={<DefectSheetPage />} />
                <Route path="approvals" element={<ApprovalsPage />} />
                <Route path="my-sheets" element={<MySheetsPage />} />
              </Route>
              
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            {/* NotificationSnackbar должен быть ВНУТРИ Router, но после Routes */}
            <NotificationSnackbar />
          </Router>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
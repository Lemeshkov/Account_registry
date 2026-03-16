// frontend/src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Убираем локальное состояние token, так как api сервис уже хранит токен

  useEffect(() => {
    // Проверяем наличие токена при загрузке
    const token = localStorage.getItem('token');
    if (token) {
      // Устанавливаем токен в api сервис
      api.setToken(token);
      loadUser();
    } else {
      setLoading(false);
    }
  }, []); // Пустой массив зависимостей - выполняется только при монтировании

  const loadUser = async () => {
    try {
      console.log('🔍 Loading user data...');
      const userData = await api.get('/users/me');
      console.log('✅ User loaded:', userData);
      setUser(userData);
    } catch (error) {
      console.error('❌ Failed to load user:', error);
      // Если не удалось загрузить пользователя, очищаем токен
      api.setToken(null);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      console.log('📝 Login attempt for:', username);
      
      // Создаем FormData для отправки
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);
      
      // Отправляем запрос на получение токена
      // Используем специальный метод login из api сервиса
      const data = await api.login(username, password);
      
      console.log('✅ Login successful, token received');
      
      // Загружаем данные пользователя
      await loadUser();
      
      return { success: true };
    } catch (error) {
      console.error('❌ Login failed:', error);
      return { 
        success: false, 
        error: error.message || 'Ошибка входа. Проверьте имя пользователя и пароль.' 
      };
    }
  };

  const register = async (userData) => {
    try {
      await api.post('/users', userData);
      return { success: true };
    } catch (error) {
      console.error('❌ Registration failed:', error);
      return { 
        success: false, 
        error: error.message || 'Ошибка регистрации' 
      };
    }
  };

  const logout = () => {
    console.log('👋 Logging out...');
    api.setToken(null);
    localStorage.removeItem('token');
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    isApprover: user?.role === 'approver' || user?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
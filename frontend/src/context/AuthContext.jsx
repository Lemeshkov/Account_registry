
import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastWebSocketMessage, setLastWebSocketMessage] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const wsConnectedRef = useRef(false);

  // Функция для установки WebSocket соединения
  const setupWebSocket = (userId) => {
    if (!userId || wsConnectedRef.current) return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8000/ws/${userId}`;
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('🔌 WebSocket connected for user:', userId);
        wsConnectedRef.current = true;
        setWsConnected(true);
        ws.send(JSON.stringify({
          type: 'authenticate',
          user_id: String(userId)
        }));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket message:', data);
          setLastWebSocketMessage(data);
          window.dispatchEvent(new CustomEvent('websocket-message', { detail: data }));
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };
      
      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        wsConnectedRef.current = false;
        setWsConnected(false);
        // Раскомментируйте если нужно авто-переподключение
        // setTimeout(() => {
        //   if (user?.id) setupWebSocket(user.id);
        // }, 5000);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        wsConnectedRef.current = false;
        setWsConnected(false);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  };

  // Функция logout
  const logout = () => {
    console.log('👋 Logging out...');
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    wsConnectedRef.current = false;
    setWsConnected(false);
    api.setToken(null);
    localStorage.removeItem('token');
    setUser(null);
    setLastWebSocketMessage(null);
  };

  const loadUser = async () => {
    try {
      console.log('🔍 Loading user data...');
      console.log('📝 Current token:', localStorage.getItem('token')?.substring(0, 20) + '...');
      
      const userData = await api.get('/users/me');
      console.log('✅ User loaded:', userData);
      setUser(userData);
      
      if (userData?.id) {
        setupWebSocket(userData.id);
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to load user:', error);
      
      // Если 401 - просто чистим токен и редиректим
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        console.log('🔒 Unauthorized, clearing token');
        api.setToken(null);
        localStorage.removeItem('token');
        setUser(null);
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  // useEffect для инициализации при монтировании
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      console.log('🔑 Initial token found:', !!token);
      
      if (token) {
        api.setToken(token);
        await loadUser();
      } else {
        setLoading(false);
      }
    };
    
    initAuth();
  }, []);

  // useEffect для обработки события выхода из системы
  useEffect(() => {
    const handleAuthLogout = () => {
      console.log('🔒 Auth logout event received');
      logout();
    };
    
    window.addEventListener('auth:logout', handleAuthLogout);
    
    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout);
    };
  }, []);

  const login = async (username, password) => {
    setLoading(true);
    try {
      console.log('📝 Login attempt for:', username);
      
      const data = await api.login(username, password);
      
      console.log('✅ Login successful, token saved');
      console.log('🔑 Token saved:', localStorage.getItem('token')?.substring(0, 20) + '...');
      
      // Загружаем пользователя
      await loadUser();
      
      return { success: true };
    } catch (error) {
      console.error('❌ Login failed:', error);
      return { 
        success: false, 
        error: error.message || 'Ошибка входа. Проверьте имя пользователя и пароль.' 
      };
    } finally {
      setLoading(false);
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

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    isApprover: user?.role === 'approver' || user?.role === 'admin',
    lastWebSocketMessage,
    wsConnected,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
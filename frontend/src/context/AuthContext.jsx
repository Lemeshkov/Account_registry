
// import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
// import api from '../services/api';

// const AuthContext = createContext();

// export const useAuth = () => useContext(AuthContext);

// export const AuthProvider = ({ children }) => {
//   const [user, setUser] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [lastWebSocketMessage, setLastWebSocketMessage] = useState(null);
//   const wsRef = useRef(null);
//   const wsConnectedRef = useRef(false);

//   // Функция для установки WebSocket соединения
//   const setupWebSocket = (userId) => {
//     if (!userId || wsConnectedRef.current) return;
    
//     const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
//     const wsUrl = `${protocol}//${window.location.hostname}:8000/ws/client_${userId}_${Date.now()}`;
    
//     try {
//       const ws = new WebSocket(wsUrl);
      
//       ws.onopen = () => {
//         console.log('🔌 WebSocket connected for user:', userId);
//         wsConnectedRef.current = true;
//         // Отправляем аутентификацию
//         ws.send(JSON.stringify({
//           type: 'authenticate',
//           user_id: String(userId)
//         }));
//       };
      
//        ws.onmessage = (event) => {
//       try {
//         const data = JSON.parse(event.data);
//         console.log('📨 WebSocket message:', data);
//         setLastWebSocketMessage(data); // <-- Сохраняем в состояние
//         window.dispatchEvent(new CustomEvent('websocket-message', { detail: data }));
//       } catch (e) {
//         console.error('Failed to parse WebSocket message:', e);
//       }
//     };
      
//       ws.onclose = () => {
//         console.log('🔌 WebSocket disconnected');
//         wsConnectedRef.current = false;
//         // Пытаемся переподключиться через 5 секунд
//         setTimeout(() => {
//           if (user?.id) setupWebSocket(user.id);
//         }, 5000);
//       };
      
//       ws.onerror = (error) => {
//         console.error('WebSocket error:', error);
//         wsConnectedRef.current = false;
//       };
      
//       wsRef.current = ws;
//     } catch (error) {
//       console.error('Failed to create WebSocket:', error);
//     }
//   };

//   useEffect(() => {
//     // Проверяем наличие токена при загрузке
//     const token = localStorage.getItem('token');
//     if (token) {
//       api.setToken(token);
//       loadUser();
//     } else {
//       setLoading(false);
//     }
//   }, []);

//   const loadUser = async () => {
//     try {
//       console.log('🔍 Loading user data...');
//       const userData = await api.get('/users/me');
//       console.log('✅ User loaded:', userData);
//       setUser(userData);
      
//       // Устанавливаем WebSocket соединение после загрузки пользователя
//       if (userData?.id) {
//         setupWebSocket(userData.id);
//       }
//     } catch (error) {
//       console.error('❌ Failed to load user:', error);
//       api.setToken(null);
//       localStorage.removeItem('token');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const login = async (username, password) => {
//     try {
//       console.log('📝 Login attempt for:', username);
      
//       const formData = new FormData();
//       formData.append('username', username);
//       formData.append('password', password);
      
//       const data = await api.login(username, password);
      
//       console.log('✅ Login successful, token received');
      
//       await loadUser();
      
//       return { success: true };
//     } catch (error) {
//       console.error('❌ Login failed:', error);
//       return { 
//         success: false, 
//         error: error.message || 'Ошибка входа. Проверьте имя пользователя и пароль.' 
//       };
//     }
//   };

//   const register = async (userData) => {
//     try {
//       await api.post('/users', userData);
//       return { success: true };
//     } catch (error) {
//       console.error('❌ Registration failed:', error);
//       return { 
//         success: false, 
//         error: error.message || 'Ошибка регистрации' 
//       };
//     }
//   };

//   const logout = () => {
//     console.log('👋 Logging out...');
//     if (wsRef.current) {
//       wsRef.current.close();
//       wsRef.current = null;
//     }
//     wsConnectedRef.current = false;
//     api.setToken(null);
//     localStorage.removeItem('token');
//     setUser(null);
//   };

//   const value = {
//     user,
//     loading,
//     login,
//     register,
//     logout,
//     isAuthenticated: !!user,
//     isApprover: user?.role === 'approver' || user?.role === 'admin',
//     lastWebSocketMessage,
//   };

//   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
// };

// frontend/src/context/AuthContext.jsx
// frontend/src/context/AuthContext.jsx
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
        setTimeout(() => {
          if (user?.id) setupWebSocket(user.id);
        }, 5000);
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

  // Функция logout должна быть объявлена ДО того, как используется в useEffect
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
      const userData = await api.get('/users/me');
      console.log('✅ User loaded:', userData);
      setUser(userData);
      
      if (userData?.id) {
        setupWebSocket(userData.id);
      }
    } catch (error) {
      console.error('❌ Failed to load user:', error);
      api.setToken(null);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  // useEffect для инициализации при монтировании
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.setToken(token);
      loadUser();
    } else {
      setLoading(false);
    }
  }, []); // Пустой массив зависимостей - выполняется один раз

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
  }, []); // Пустой массив зависимостей - logout стабильная функция

  const login = async (username, password) => {
    try {
      console.log('📝 Login attempt for:', username);
      
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);
      
      const data = await api.login(username, password);
      
      console.log('✅ Login successful, token received');
      
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
// import React, { useState, useEffect } from "react";
// import {
//   Dialog,
//   DialogTitle,
//   DialogContent,
//   DialogActions,
//   TextField,
//   Button,
//   FormControl,
//   InputLabel,
//   Select,
//   MenuItem,
//   Alert,
//   Box,
//   Grid,
//   Typography,
// } from "@mui/material";

// const UserFormDialog = ({ open, user, onClose, onSave, currentUser }) => {
//   const [formData, setFormData] = useState({
//     username: "",
//     email: "",
//     full_name: "",
//     password: "",
//     role: "user",
//   });
//   const [errors, setErrors] = useState({});
//   const [isSubmitting, setIsSubmitting] = useState(false);

//   const isEditMode = !!user;

//   useEffect(() => {
//     if (user) {
//       setFormData({
//         username: user.username,
//         email: user.email || "",
//         full_name: user.full_name || "",
//         password: "",
//         role: user.role,
//       });
//     } else {
//       setFormData({
//         username: "",
//         email: "",
//         full_name: "",
//         password: "",
//         role: "user",
//       });
//     }
//     setErrors({});
//   }, [user, open]);

//   const validate = () => {
//     const newErrors = {};

//     if (!formData.username.trim()) {
//       newErrors.username = "Username обязателен";
//     } else if (formData.username.length < 3) {
//       newErrors.username = "Username должен содержать минимум 3 символа";
//     } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
//       newErrors.username =
//         "Username может содержать только буквы, цифры и underscore";
//     }

//     if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
//       newErrors.email = "Неверный формат email";
//     }

//     if (!isEditMode && !formData.password) {
//       newErrors.password = "Пароль обязателен при создании";
//     } else if (!isEditMode && formData.password.length < 6) {
//       newErrors.password = "Пароль должен содержать минимум 6 символов";
//     } else if (
//       isEditMode &&
//       formData.password &&
//       formData.password.length < 6
//     ) {
//       newErrors.password = "Пароль должен содержать минимум 6 символов";
//     }

//     return newErrors;
//   };

//   const handleChange = (field) => (event) => {
//     setFormData((prev) => ({ ...prev, [field]: event.target.value }));
//     if (errors[field]) {
//       setErrors((prev) => ({ ...prev, [field]: "" }));
//     }
//   };

//   const handleSubmit = async () => {
//     const validationErrors = validate();
//     if (Object.keys(validationErrors).length > 0) {
//       setErrors(validationErrors);
//       return;
//     }

//     setIsSubmitting(true);
//     try {
//       const submitData = { ...formData };
//       if (isEditMode && !submitData.password) {
//         delete submitData.password;
//       }
//       await onSave(submitData);
//       onClose();
//     } catch (error) {
//       console.error("Save error:", error);
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   return (
//     <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
//       <DialogTitle>
//         {isEditMode ? "Редактирование пользователя" : "Создание пользователя"}
//       </DialogTitle>
//       <DialogContent>
//         <Box sx={{ mt: 2 }}>
//           <Grid container spacing={2}>
//             <Grid item xs={12}>
//               <TextField
//                 fullWidth
//                 label="Username *"
//                 value={formData.username}
//                 onChange={handleChange("username")}
//                 error={!!errors.username}
//                 helperText={errors.username}
//                 disabled={isEditMode}
//                 required
//               />
//             </Grid>

//             <Grid item xs={12}>
//               <TextField
//                 fullWidth
//                 label="Email"
//                 type="email"
//                 value={formData.email}
//                 onChange={handleChange("email")}
//                 error={!!errors.email}
//                 helperText={errors.email}
//               />
//             </Grid>

//             <Grid item xs={12}>
//               <TextField
//                 fullWidth
//                 label="ФИО"
//                 value={formData.full_name}
//                 onChange={handleChange("full_name")}
//                 error={!!errors.full_name}
//                 helperText={errors.full_name}
//               />
//             </Grid>

//             <Grid item xs={12}>
//               <TextField
//                 fullWidth
//                 label={
//                   isEditMode
//                     ? "Новый пароль (оставьте пустым, чтобы не менять)"
//                     : "Пароль *"
//                 }
//                 type="password"
//                 value={formData.password}
//                 onChange={handleChange("password")}
//                 error={!!errors.password}
//                 helperText={errors.password}
//                 required={!isEditMode}
//               />
//             </Grid>

//             <Grid item xs={12}>
//               <FormControl fullWidth>
//                 <InputLabel>Роль</InputLabel>
//                 <Select
//                   value={formData.role}
//                   label="Роль"
//                   onChange={handleChange("role")}
//                 >
//                   <MenuItem value="user">Пользователь</MenuItem>
//                   <MenuItem value="approver">Согласователь</MenuItem>
//                   <MenuItem value="admin">Администратор</MenuItem>
//                 </Select>
//               </FormControl>
//             </Grid>
//           </Grid>

//           {isEditMode && user?.id === currentUser?.id && (
//             <Alert severity="info" sx={{ mt: 2 }}>
//               Вы редактируете свою учетную запись. Будьте осторожны с изменением
//               роли.
//             </Alert>
//           )}
//         </Box>
//       </DialogContent>
//       <DialogActions>
//         <Button onClick={onClose}>Отмена</Button>
//         <Button
//           onClick={handleSubmit}
//           variant="contained"
//           disabled={isSubmitting}
//         >
//           {isSubmitting ? "Сохранение..." : "Сохранить"}
//         </Button>
//       </DialogActions>
//     </Dialog>
//   );
// };

// export default UserFormDialog;
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Box,
  Grid,
  Typography,
} from '@mui/material';

const UserFormDialog = ({ open, user, onClose, onSave, currentUser }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'user',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = !!user;

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        email: user.email || '',
        full_name: user.full_name || '',
        password: '',
        role: user.role,
      });
    } else {
      setFormData({
        username: '',
        email: '',
        full_name: '',
        password: '',
        role: 'user',
      });
    }
    setErrors({});
  }, [user, open]);

  const validate = () => {
    const newErrors = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username обязателен';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username должен содержать минимум 3 символа';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username может содержать только буквы, цифры и underscore';
    }
    
    // Email валидация только если он заполнен
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Неверный формат email';
    }
    
    if (!isEditMode && !formData.password) {
      newErrors.password = 'Пароль обязателен при создании';
    } else if (!isEditMode && formData.password.length < 6) {
      newErrors.password = 'Пароль должен содержать минимум 6 символов';
    } else if (isEditMode && formData.password && formData.password.length < 6) {
      newErrors.password = 'Пароль должен содержать минимум 6 символов';
    }
    
    return newErrors;
  };

  const handleChange = (field) => (event) => {
    setFormData(prev => ({ ...prev, [field]: event.target.value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const submitData = { ...formData };
      
      // Если email пустая строка, отправляем null
      if (submitData.email === '') {
        submitData.email = null;
      }
      
      // Если full_name пустая строка, отправляем null
      if (submitData.full_name === '') {
        submitData.full_name = null;
      }
      
      if (isEditMode && !submitData.password) {
        delete submitData.password;
      }
      await onSave(submitData);
      onClose();
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isEditMode ? 'Редактирование пользователя' : 'Создание пользователя'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Username *"
                value={formData.username}
                onChange={handleChange('username')}
                error={!!errors.username}
                helperText={errors.username}
                disabled={isEditMode}
                required
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email (необязательно)"
                type="email"
                value={formData.email}
                onChange={handleChange('email')}
                error={!!errors.email}
                helperText={errors.email || 'Email можно не указывать'}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="ФИО (необязательно)"
                value={formData.full_name}
                onChange={handleChange('full_name')}
                error={!!errors.full_name}
                helperText={errors.full_name}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={isEditMode ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль *'}
                type="password"
                value={formData.password}
                onChange={handleChange('password')}
                error={!!errors.password}
                helperText={errors.password}
                required={!isEditMode}
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Роль</InputLabel>
                <Select
                  value={formData.role}
                  label="Роль"
                  onChange={handleChange('role')}
                >
                  <MenuItem value="user">Пользователь</MenuItem>
                  <MenuItem value="approver">Согласователь</MenuItem>
                  <MenuItem value="admin">Администратор</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          
          {isEditMode && user?.id === currentUser?.id && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Вы редактируете свою учетную запись. Будьте осторожны с изменением роли.
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserFormDialog;
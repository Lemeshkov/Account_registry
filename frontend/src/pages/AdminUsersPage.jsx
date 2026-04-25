import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Card,
  CardContent,
  Alert,
  Snackbar,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  VpnKey as KeyIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Restore as RestoreIcon,
  PersonAdd as PersonAddIcon,
  People as PeopleIcon,
  VerifiedUser as VerifiedUserIcon,
  SupervisorAccount as SupervisorAccountIcon,
} from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import UserFormDialog from "../components/UserFormDialog";

const AdminUsersPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [filters, setFilters] = useState({
    role: "",
    is_active: null,
    search: "",
  });
  const [stats, setStats] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resetPasswordDialog, setResetPasswordDialog] = useState(null);
  const [deactivateDialog, setDeactivateDialog] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // Загрузка пользователей
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      // Строим params только с валидными значениями
      const params = {
        skip: page * rowsPerPage,
        limit: rowsPerPage,
      };

      // Добавляем role только если она задана и не 'all'
      if (filters.role && filters.role !== "" && filters.role !== "all") {
        params.role = filters.role;
      }

      // Добавляем is_active только если это boolean (не null)
      if (
        filters.is_active !== null &&
        filters.is_active !== undefined &&
        filters.is_active !== ""
      ) {
        params.is_active =
          filters.is_active === true || filters.is_active === "true";
      }

      // Добавляем search только если не пустой
      if (filters.search && filters.search.trim() !== "") {
        params.search = filters.search.trim();
      }

      console.log("📡 Loading users with params:", params);
      const data = await api.getAdminUsers(params);
      setUsers(data);
      setTotalUsers(data.length);
    } catch (error) {
      console.error("Failed to load users:", error);
      let errorMessage = "Ошибка загрузки пользователей";
      if (error.message) {
        errorMessage += ": " + error.message;
      }
      showSnackbar(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filters]);

  // Загрузка статистики
  const loadStats = useCallback(async () => {
    try {
      const data = await api.getAdminStats();
      setStats(data);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadStats();
  }, [loadUsers, loadStats]);

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleFilterChange = (key, value) => {
    // Для is_active преобразуем пустую строку в null
    if (key === "is_active" && value === "") {
      value = null;
    }
    // Для role преобразуем 'all' в ''
    if (key === "role" && value === "all") {
      value = "";
    }
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setDialogOpen(true);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setDialogOpen(true);
  };

  const handleSaveUser = async (userData) => {
    try {
      if (editingUser) {
        // Обновление
        await api.updateUserByAdmin(editingUser.id, userData);
        showSnackbar(
          `Пользователь ${userData.username || editingUser.username} обновлен`,
          "success",
        );
      } else {
        // Создание
        await api.createUserByAdmin(userData);
        showSnackbar(`Пользователь ${userData.username} создан`, "success");
      }
      loadUsers();
      loadStats();
      setDialogOpen(false);
    } catch (error) {
      showSnackbar(error.message || "Ошибка сохранения пользователя", "error");
    }
  };

  const handleResetPassword = async (user) => {
    try {
      const result = await api.resetUserPassword(user.id);
      showSnackbar(
        result.temporary_password
          ? `Временный пароль для ${user.username}: ${result.temporary_password}`
          : `Пароль для ${user.username} сброшен`,
        "info",
      );
      setResetPasswordDialog(null);
    } catch (error) {
      showSnackbar(error.message || "Ошибка сброса пароля", "error");
    }
  };

  const handleDeactivate = async (user) => {
    try {
      await api.deactivateUser(user.id);
      showSnackbar(`Пользователь ${user.username} деактивирован`, "success");
      loadUsers();
      loadStats();
      setDeactivateDialog(null);
    } catch (error) {
      showSnackbar(error.message || "Ошибка деактивации", "error");
    }
  };

  const handleReactivate = async (user) => {
    try {
      await api.reactivateUser(user.id);
      showSnackbar(`Пользователь ${user.username} активирован`, "success");
      loadUsers();
      loadStats();
    } catch (error) {
      showSnackbar(error.message || "Ошибка активации", "error");
    }
  };

  const getRoleChip = (role) => {
    const config = {
      admin: {
        label: "Администратор",
        color: "error",
        icon: <SupervisorAccountIcon fontSize="small" />,
      },
      approver: {
        label: "Согласователь",
        color: "warning",
        icon: <VerifiedUserIcon fontSize="small" />,
      },
      user: {
        label: "Пользователь",
        color: "default",
        icon: <PeopleIcon fontSize="small" />,
      },
    };
    const { label, color, icon } = config[role] || config.user;
    return <Chip icon={icon} label={label} size="small" color={color} />;
  };

  const getStatusChip = (isActive) => {
    return isActive ? (
      <Chip
        icon={<CheckCircleIcon />}
        label="Активен"
        size="small"
        color="success"
      />
    ) : (
      <Chip
        icon={<CancelIcon />}
        label="Деактивирован"
        size="small"
        color="error"
      />
    );
  };

  return (
    <Box>
      {/* Статистика */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Всего пользователей
                </Typography>
                <Typography variant="h3">{stats.total_users}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Активные
                </Typography>
                <Typography variant="h3" color="success.main">
                  {stats.active_users}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Согласователи
                </Typography>
                <Typography variant="h3" color="warning.main">
                  {stats.users_by_role?.approver || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Администраторы
                </Typography>
                <Typography variant="h3" color="error.main">
                  {stats.users_by_role?.admin || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Фильтры */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Поиск по имени, email..."
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Роль</InputLabel>
              <Select
                value={filters.role}
                label="Роль"
                onChange={(e) => handleFilterChange("role", e.target.value)}
              >
                <MenuItem value="">Все</MenuItem>
                <MenuItem value="user">Пользователь</MenuItem>
                <MenuItem value="approver">Согласователь</MenuItem>
                <MenuItem value="admin">Администратор</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Статус</InputLabel>
              <Select
                value={
                  filters.is_active === null ? "" : filters.is_active.toString()
                }
                label="Статус"
                onChange={(e) => {
                  const value = e.target.value;
                  // Пустая строка = все пользователи
                  handleFilterChange(
                    "is_active",
                    value === "" ? null : value === "true",
                  );
                }}
              >
                <MenuItem value="">Все</MenuItem>
                <MenuItem value="true">Активен</MenuItem>
                <MenuItem value="false">Деактивирован</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateUser}
            >
              Создать
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Таблица пользователей */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Username</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>ФИО</TableCell>
              <TableCell>Роль</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Дата создания</TableCell>
              <TableCell align="center">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                  <Typography color="textSecondary">
                    Пользователи не найдены
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow
                  key={user.id}
                  sx={{ opacity: user.is_active ? 1 : 0.6 }}
                >
                  <TableCell>{user.id}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {user.username}
                    </Typography>
                  </TableCell>
                  <TableCell>{user.email || "—"}</TableCell>
                  <TableCell>{user.full_name || "—"}</TableCell>
                  <TableCell>{getRoleChip(user.role)}</TableCell>
                  <TableCell>{getStatusChip(user.is_active)}</TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString("ru-RU")}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Редактировать">
                      <IconButton
                        size="small"
                        onClick={() => handleEditUser(user)}
                        disabled={
                          !user.is_active && user.id === currentUser?.id
                        }
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Сбросить пароль">
                      <IconButton
                        size="small"
                        onClick={() => setResetPasswordDialog(user)}
                        disabled={!user.is_active}
                      >
                        <KeyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    {user.is_active ? (
                      <Tooltip title="Деактивировать">
                        <IconButton
                          size="small"
                          onClick={() => setDeactivateDialog(user)}
                          disabled={user.id === currentUser?.id}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Активировать">
                        <IconButton
                          size="small"
                          onClick={() => handleReactivate(user)}
                          color="success"
                        >
                          <RestoreIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={totalUsers}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          labelRowsPerPage="Строк на странице:"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} из ${count}`
          }
        />
      </TableContainer>

      {/* Диалог создания/редактирования */}
      <UserFormDialog
        open={dialogOpen}
        user={editingUser}
        onClose={() => setDialogOpen(false)}
        onSave={handleSaveUser}
        currentUser={currentUser}
      />

      {/* Диалог сброса пароля */}
      <Dialog
        open={!!resetPasswordDialog}
        onClose={() => setResetPasswordDialog(null)}
      >
        <DialogTitle>Сброс пароля</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы уверены, что хотите сбросить пароль для пользователя{" "}
            <strong>{resetPasswordDialog?.username}</strong>? Будет сгенерирован
            временный пароль, который необходимо будет сменить при следующем
            входе.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetPasswordDialog(null)}>Отмена</Button>
          <Button
            onClick={() => handleResetPassword(resetPasswordDialog)}
            variant="contained"
            color="warning"
          >
            Сбросить пароль
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог деактивации */}
      <Dialog
        open={!!deactivateDialog}
        onClose={() => setDeactivateDialog(null)}
      >
        <DialogTitle>Деактивация пользователя</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы уверены, что хотите деактивировать пользователя{" "}
            <strong>{deactivateDialog?.username}</strong>? Деактивированный
            пользователь не сможет войти в систему.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeactivateDialog(null)}>Отмена</Button>
          <Button
            onClick={() => handleDeactivate(deactivateDialog)}
            variant="contained"
            color="error"
          >
            Деактивировать
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar уведомления */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminUsersPage;

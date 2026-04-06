// frontend/src/components/AddRowModal.jsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Box,
  Typography,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

const AddRowModal = ({ open, onClose, onAdd, loading, sheetStatus }) => {
  const [formData, setFormData] = useState({
    position: '',
    address: '',
    material_name: '',
    requested_quantity: '',
    weight_tons: '',
  });

  const handleChange = (field) => (event) => {
    setFormData({
      ...formData,
      [field]: event.target.value,
    });
  };

  const handleSubmit = () => {
    onAdd(formData);
  };

  const handleClose = () => {
    setFormData({
      position: '',
      address: '',
      material_name: '',
      requested_quantity: '',
      weight_tons: '',
    });
    onClose();
  };

  // Проверяем, можно ли добавлять строки
  const canAdd = sheetStatus === 'draft' || sheetStatus === 'pending';

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <AddIcon color="success" />
          <Typography variant="h6">Добавление новой строки</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {!canAdd && (
          <Box sx={{ mb: 2, p: 1, bgcolor: 'warning.light', borderRadius: 1 }}>
            <Typography variant="body2" color="warning.contrastText">
              ⚠️ Ведомость уже отправлена на согласование. Добавление строк может быть ограничено.
            </Typography>
          </Box>
        )}
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="№ п/п (позиция)"
              type="number"
              value={formData.position}
              onChange={handleChange('position')}
              helperText="Необязательно, будет определен автоматически"
              disabled={loading}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Адрес / Марка"
              value={formData.address}
              onChange={handleChange('address')}
              placeholder="например: ул. Ленина, 1"
              disabled={loading}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Наименование материала"
              value={formData.material_name}
              onChange={handleChange('material_name')}
              placeholder="например: Труба стальная 50x3"
              disabled={loading}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Затреб (тонн)"
              type="number"
              inputProps={{ step: "0.001", min: 0 }}
              value={formData.requested_quantity}
              onChange={handleChange('requested_quantity')}
              helperText="Вес в тоннах"
              disabled={loading}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Вес (тонн)"
              type="number"
              inputProps={{ step: "0.001", min: 0 }}
              value={formData.weight_tons}
              onChange={handleChange('weight_tons')}
              helperText="Вес в тоннах"
              disabled={loading}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Отмена
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          color="success" 
          disabled={loading || !formData.material_name}
          startIcon={<AddIcon />}
        >
          {loading ? 'Добавление...' : 'Добавить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddRowModal;
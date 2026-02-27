import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Grid,
  Alert
} from '@mui/material';

const MetalCalculator = ({ open, onClose, onCalculate, formulas }) => {
  const [selectedType, setSelectedType] = useState('pipe');
  const [params, setParams] = useState({});
  const [errors, setErrors] = useState({});

  const handleTypeChange = (event) => {
    const type = event.target.value;
    setSelectedType(type);
    setParams({});
    setErrors({});
  };

  const handleParamChange = (param, value) => {
    setParams(prev => ({
      ...prev,
      [param]: value
    }));
    
    // Очищаем ошибку для этого параметра
    if (errors[param]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[param];
        return newErrors;
      });
    }
  };

  const validateParams = () => {
    const formula = formulas.find(f => f.type === selectedType);
    if (!formula) return true;

    const newErrors = {};
    formula.params.forEach(param => {
      if (!params[param] || params[param] === '') {
        newErrors[param] = 'Обязательное поле';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCalculate = () => {
    if (!validateParams()) return;
    onCalculate(selectedType, params);
    onClose();
  };

  const getParamLabel = (param) => {
    const labels = {
      d: 'Диаметр (мм)',
      t: 'Толщина стенки (мм)',
      a: 'Полка A (мм)',
      b: 'Полка B (мм)',
      width: 'Ширина (м)',
      profile_number: 'Номер профиля'
    };
    return labels[param] || param;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Калькулятор пересчета тонн в метры
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Тип профиля</InputLabel>
            <Select
              value={selectedType}
              onChange={handleTypeChange}
              label="Тип профиля"
            >
              {formulas.map((formula) => (
                <MenuItem key={formula.type} value={formula.type}>
                  {formula.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedType && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Формула: {formulas.find(f => f.type === selectedType)?.formula}
              </Typography>
              
              <Typography variant="caption" color="text.secondary" paragraph>
                {formulas.find(f => f.type === selectedType)?.description}
              </Typography>

              <Grid container spacing={2} sx={{ mt: 1 }}>
                {formulas.find(f => f.type === selectedType)?.params.map((param) => (
                  <Grid item xs={6} key={param}>
                    <TextField
                      fullWidth
                      label={getParamLabel(param)}
                      value={params[param] || ''}
                      onChange={(e) => handleParamChange(param, e.target.value)}
                      type="number"
                      error={!!errors[param]}
                      helperText={errors[param]}
                    />
                  </Grid>
                ))}
              </Grid>

              <Alert severity="info" sx={{ mt: 2 }}>
                Пересчет будет выполнен для выбранных строк на основе веса из поля "Затреб"
              </Alert>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button 
          onClick={handleCalculate} 
          variant="contained" 
          color="primary"
          disabled={Object.keys(errors).length > 0}
        >
          Пересчитать
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MetalCalculator;
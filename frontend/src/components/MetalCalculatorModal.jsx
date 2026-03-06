// frontend/src/components/MetalCalculatorModal.jsx
import React, { useState, useEffect } from 'react';
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
  FormControlLabel,
  Checkbox,
  Box,
  Typography,
  Chip,
  Alert,
  Grid,
  Paper,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  Calculate as CalculateIcon,
  Close as CloseIcon,
  AutoFixHigh as AutoDetectIcon,
  Info as InfoIcon,
  Preview as PreviewIcon
} from '@mui/icons-material';

const PROFILE_TYPES = {
  pipe: {
    name: 'Труба стальная',
    icon: '🔴',
    description: 'ВГП, электросварная, профильная',
    params: [
      { name: 'd', label: 'Диаметр (мм)', type: 'number', min: 10, max: 500, step: 1, required: true },
      { name: 't', label: 'Толщина стенки (мм)', type: 'number', min: 1, max: 50, step: 0.5, required: true }
    ],
    formula: '({d} - {t}) * {t} * 0.02466'
  },
  rebar: {
    name: 'Арматура',
    icon: '⚡',
    description: 'Стержневая арматура, катанка',
    params: [
      { name: 'd', label: 'Диаметр (мм)', type: 'number', min: 6, max: 40, step: 1, required: true }
    ],
    formula: '{d}^2 * 0.00617'
  },
  sheet: {
    name: 'Лист стальной',
    icon: '📄',
    description: 'Г/к, х/к, оцинкованный',
    params: [
      { name: 'thickness', label: 'Толщина (мм)', type: 'number', min: 0.5, max: 100, step: 0.1, required: true },
      { name: 'width', label: 'Ширина (м)', type: 'number', min: 0.5, max: 3, step: 0.1, required: true },
      { name: 'length', label: 'Длина (м)', type: 'number', min: 1, max: 12, step: 0.1, required: true }
    ],
    formula: '{thickness} * {width} * {length} * 7.85'
  },
  angle: {
    name: 'Уголок',
    icon: '📐',
    description: 'Равнополочный, неравнополочный',
    params: [
      { name: 'a', label: 'Полка A (мм)', type: 'number', min: 20, max: 250, step: 1, required: true },
      { name: 'b', label: 'Полка B (мм)', type: 'number', min: 20, max: 250, step: 1, required: true },
      { name: 't', label: 'Толщина (мм)', type: 'number', min: 3, max: 30, step: 0.5, required: true }
    ],
    formula: '({a} + {b} - {t}) * {t} * 0.00785'
  },
  beam: {
    name: 'Балка двутавровая',
    icon: '🏗️',
    description: 'Двутавр, швеллер',
    params: [
      { 
        name: 'profile_number', 
        label: 'Номер профиля', 
        type: 'select', 
        options: [10, 12, 14, 16, 18, 20, 22, 24, 27, 30, 36, 40, 45, 50, 55, 60],
        required: true 
      }
    ],
    formula: 'Справочник ГОСТ'
  }
};

const MetalCalculatorModal = ({ 
  open, 
  onClose, 
  onCalculate, 
  selectedItems = [], 
  itemsData = [],
  formulas = PROFILE_TYPES 
}) => {
  const [selectedType, setSelectedType] = useState('pipe');
  const [params, setParams] = useState({});
  const [applyToAll, setApplyToAll] = useState(true);
  const [autoDetected, setAutoDetected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedItemsInfo, setSelectedItemsInfo] = useState([]);

  // Загружаем информацию о выбранных строках
  useEffect(() => {
    if (selectedItems.length > 0 && itemsData.length > 0) {
      const info = itemsData.filter(item => selectedItems.includes(item.id));
      setSelectedItemsInfo(info);
      
      // Автоопределение параметров из первой строки
      if (info.length > 0) {
        detectFromFirstItem(info[0]);
      }
    }
  }, [selectedItems, itemsData]);

  // Автоопределение параметров из наименования материала
  const detectFromFirstItem = (item) => {
    if (!item?.material_name) return;
    
    const detected = detectParamsFromName(item.material_name);
    if (detected) {
      setSelectedType(detected.type);
      setParams(detected.params);
      setAutoDetected(true);
      setErrors({});
    }
  };

  const detectParamsFromName = (materialName) => {
    if (!materialName) return null;
    
    const name = materialName.toLowerCase();
    
    // Паттерны для трубы: 108х4, 159*6, труба 108х4.5, ду 108х4
    const pipePatterns = [
      /(\d+)[\sхx*\/]+(\d+(?:\.\d+)?)/i,
      /труб[аы][^\d]*(\d+)[^\d]*(\d+(?:\.\d+)?)/i,
      /ду[^\d]*(\d+)[^\d]*(\d+(?:\.\d+)?)/i,
      /d[ny]\s*(\d+)\s*x\s*(\d+(?:\.\d+)?)/i
    ];
    
    for (const pattern of pipePatterns) {
      const match = name.match(pattern);
      if (match) {
        return {
          type: 'pipe',
          params: { 
            d: parseInt(match[1]), 
            t: parseFloat(match[2]) 
          }
        };
      }
    }
    
    // Паттерны для арматуры: арматура 12, а400с 14, стержень 10
    const rebarPatterns = [
      /арматур[аы][^\d]*(\d+)/i,
      /а[0-9]{3}[^\d]*(\d+)/i,
      /стерж[её]н[ь]*[^\d]*(\d+)/i,
      /d(\d+)\s*a[0-9]/i
    ];
    
    for (const pattern of rebarPatterns) {
      const match = name.match(pattern);
      if (match) {
        return {
          type: 'rebar',
          params: { d: parseInt(match[1]) }
        };
      }
    }
    
    // Паттерны для листа: лист 10, лист 8х1500х6000
    const sheetPatterns = [
      /лист[^\d]*(\d+(?:\.\d+)?)/i,
      /лист[^\d]*(\d+(?:\.\d+)?)[\sхx*]+(\d+(?:\.\d+)?)[\sхx*]+(\d+(?:\.\d+)?)/i
    ];
    
    for (const pattern of sheetPatterns) {
      const match = name.match(pattern);
      if (match) {
        if (match.length === 2) {
          return {
            type: 'sheet',
            params: { 
              thickness: parseFloat(match[1]),
              width: 1.5,
              length: 6
            }
          };
        } else if (match.length === 4) {
          return {
            type: 'sheet',
            params: { 
              thickness: parseFloat(match[1]),
              width: parseFloat(match[2]) / 1000,
              length: parseFloat(match[3]) / 1000
            }
          };
        }
      }
    }
    
    // Паттерны для уголка: уголок 75х50х5, 75x50x5
    const anglePatterns = [
      /угол[о]?к[^\d]*(\d+)[\sхx*]+(\d+)[\sхx*]+(\d+(?:\.\d+)?)/i,
      /l[^\d]*(\d+)[\sхx*]+(\d+)[\sхx*]+(\d+(?:\.\d+)?)/i
    ];
    
    for (const pattern of anglePatterns) {
      const match = name.match(pattern);
      if (match) {
        return {
          type: 'angle',
          params: { 
            a: parseInt(match[1]),
            b: parseInt(match[2]),
            t: parseFloat(match[3])
          }
        };
      }
    }
    
    return null;
  };

  // Валидация параметров
  const validateParams = () => {
    const newErrors = {};
    const profile = formulas[selectedType];
    
    if (!profile) return false;
    
    profile.params.forEach(param => {
      const value = params[param.name];
      
      if (param.required && (value === undefined || value === null || value === '')) {
        newErrors[param.name] = `Поле обязательно`;
      } else if (value !== undefined && value !== '') {
        if (param.type === 'number') {
          const num = parseFloat(value);
          if (isNaN(num)) {
            newErrors[param.name] = `Должно быть числом`;
          } else if (param.min && num < param.min) {
            newErrors[param.name] = `Мин. значение ${param.min}`;
          } else if (param.max && num > param.max) {
            newErrors[param.name] = `Макс. значение ${param.max}`;
          }
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Получение предпросмотра расчета
  const getPreview = async () => {
    if (!validateParams() || selectedItemsInfo.length === 0) return;
    
    setPreviewLoading(true);
    
    try {
      // Берем первую выбранную строку для предпросмотра
      const firstItem = selectedItemsInfo[0];
      const weight = parseFloat(firstItem.weight_tons || firstItem.requested_quantity || 0);
      
      if (!weight) {
        setPreview({ error: 'Нет данных о весе' });
        return;
      }
      
      // Имитация расчета (в реальности здесь может быть API запрос)
      let meters = 0;
      let formula = '';
      
      if (selectedType === 'pipe') {
        const d = parseFloat(params.d);
        const t = parseFloat(params.t);
        const weightPerMeter = (d - t) * t * 0.02466;
        meters = (weight * 1000) / weightPerMeter;
        formula = `(${d} - ${t}) * ${t} * 0.02466 = ${weightPerMeter.toFixed(3)} кг/м`;
      } else if (selectedType === 'rebar') {
        const d = parseFloat(params.d);
        const weightPerMeter = d * d * 0.00617;
        meters = (weight * 1000) / weightPerMeter;
        formula = `${d}^2 * 0.00617 = ${weightPerMeter.toFixed(3)} кг/м`;
      } else if (selectedType === 'sheet') {
        const thickness = parseFloat(params.thickness);
        const width = parseFloat(params.width);
        const length = parseFloat(params.length);
        const weightPerM2 = thickness * 7.85;
        const weightPerSheet = weightPerM2 * width * length;
        meters = (weight * 1000) / weightPerSheet;
        formula = `${thickness}мм * 7.85 = ${weightPerM2.toFixed(3)} кг/м²`;
      } else {
        // Для других типов используем заглушку
        meters = weight * 100;
        formula = 'Справочная формула';
      }
      
      setPreview({
        weightTons: weight,
        meters: meters.toFixed(2),
        formula: formula,
        itemName: firstItem.material_name
      });
      
    } catch (error) {
      console.error('Preview error:', error);
      setPreview({ error: error.message });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Обработчик изменения параметра
  const handleParamChange = (paramName, value) => {
    setParams(prev => ({
      ...prev,
      [paramName]: value
    }));
    
    // Очищаем ошибку для этого поля
    if (errors[paramName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[paramName];
        return newErrors;
      });
    }
    
    // Сбрасываем предпросмотр при изменении параметров
    setPreview(null);
  };

  // Обработчик отправки
  const handleCalculate = async () => {
    if (!validateParams()) {
      return;
    }
    
    if (selectedItems.length === 0) {
      alert('Выберите строки для пересчета');
      return;
    }
    
    setLoading(true);
    
    try {
      await onCalculate(selectedType, params, applyToAll);
      onClose();
    } catch (error) {
      console.error('Calculation error:', error);
      alert(`Ошибка: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Ручное автоопределение
  const handleAutoDetect = () => {
    if (selectedItemsInfo.length > 0) {
      detectFromFirstItem(selectedItemsInfo[0]);
    }
  };

  // Сброс при смене типа
  const handleTypeChange = (type) => {
    setSelectedType(type);
    setParams({});
    setErrors({});
    setPreview(null);
    setAutoDetected(false);
  };

  const currentProfile = formulas[selectedType];
  const isValid = Object.keys(errors).length === 0 && 
                  Object.keys(params).length === currentProfile?.params.length;

  // Подсчет общего веса выбранных строк
  const totalWeight = selectedItemsInfo.reduce((sum, item) => 
    sum + parseFloat(item.weight_tons || item.requested_quantity || 0), 0
  ).toFixed(3);

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { minHeight: '600px', maxHeight: '90vh' } }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <CalculateIcon color="primary" />
            <Typography variant="h6">Пересчет металлопроката</Typography>
            <Chip 
              label={`Выбрано: ${selectedItems.length} строк`}
              size="small"
              color="primary"
              variant="outlined"
            />
            {totalWeight > 0 && (
              <Chip 
                label={`${totalWeight} т`}
                size="small"
                color="secondary"
                variant="outlined"
              />
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* Тип профиля */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom color="textSecondary">
              Тип профиля
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              {Object.entries(formulas).map(([type, profile]) => (
                <Chip
                  key={type}
                  label={`${profile.icon} ${profile.name}`}
                  onClick={() => handleTypeChange(type)}
                  color={selectedType === type ? 'primary' : 'default'}
                  variant={selectedType === type ? 'filled' : 'outlined'}
                  sx={{ 
                    cursor: 'pointer',
                    '&:hover': { bgcolor: selectedType === type ? 'primary.dark' : 'action.hover' }
                  }}
                />
              ))}
            </Box>
          </Grid>

          {/* Параметры профиля */}
          <Grid item xs={12}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2" gutterBottom color="textSecondary">
                Параметры профиля
              </Typography>
              {autoDetected && (
                <Chip 
                  icon={<AutoDetectIcon />} 
                  label="Автоопределено" 
                  size="small" 
                  color="success"
                  variant="outlined"
                />
              )}
            </Box>
            
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
              <Grid container spacing={2}>
                {currentProfile?.params.map(param => (
                  <Grid item xs={12} sm={6} md={4} key={param.name}>
                    {param.type === 'select' ? (
                      <FormControl fullWidth size="small" error={!!errors[param.name]}>
                        <InputLabel>{param.label}</InputLabel>
                        <Select
                          value={params[param.name] || ''}
                          onChange={(e) => handleParamChange(param.name, e.target.value)}
                          label={param.label}
                        >
                          <MenuItem value="">-- Выберите --</MenuItem>
                          {param.options.map(opt => (
                            <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                          ))}
                        </Select>
                        {errors[param.name] && (
                          <Typography variant="caption" color="error">
                            {errors[param.name]}
                          </Typography>
                        )}
                      </FormControl>
                    ) : (
                      <TextField
                        fullWidth
                        size="small"
                        label={param.label}
                        type="number"
                        value={params[param.name] || ''}
                        onChange={(e) => handleParamChange(param.name, e.target.value)}
                        error={!!errors[param.name]}
                        helperText={errors[param.name]}
                        inputProps={{
                          min: param.min,
                          max: param.max,
                          step: param.step
                        }}
                      />
                    )}
                  </Grid>
                ))}
              </Grid>

              <Box mt={2} display="flex" justifyContent="flex-end">
                <Button
                  size="small"
                  startIcon={<AutoDetectIcon />}
                  onClick={handleAutoDetect}
                  disabled={selectedItemsInfo.length === 0}
                >
                  Автоопределение из наименования
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* Настройки применения */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom color="textSecondary">
              Настройки применения
            </Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={applyToAll}
                    onChange={(e) => setApplyToAll(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">
                      Применить ко всем выбранным строкам
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      даже если тип профиля не совпадает
                    </Typography>
                  </Box>
                }
              />
            </Paper>
          </Grid>

          {/* Предпросмотр расчета */}
          <Grid item xs={12}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="subtitle2" gutterBottom color="textSecondary">
                Предпросмотр расчета
              </Typography>
              {isValid && (
                <Button
                  size="small"
                  startIcon={<PreviewIcon />}
                  onClick={getPreview}
                  disabled={previewLoading}
                >
                  {previewLoading ? <CircularProgress size={20} /> : 'Показать'}
                </Button>
              )}
            </Box>
            
            {preview && !preview.error && (
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'info.50' }}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">
                      Для строки: {preview.itemName}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      Вес: <strong>{preview.weightTons} т</strong>
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      Результат: <strong color="primary">{preview.meters} м</strong>
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="caption" color="textSecondary">
                      Формула: {preview.formula}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            )}

            {preview?.error && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {preview.error}
              </Alert>
            )}
          </Grid>

          {/* Информация о выбранных строках */}
          {selectedItemsInfo.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom color="textSecondary">
                Выбранные строки
              </Typography>
              <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto' }}>
                {selectedItemsInfo.slice(0, 5).map(item => (
                  <Box 
                    key={item.id} 
                    sx={{ 
                      p: 1.5, 
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 'none' }
                    }}
                  >
                    <Typography variant="body2" fontWeight="500">
                      {item.material_name || 'Без названия'}
                    </Typography>
                    <Box display="flex" gap={2} mt={0.5}>
                      <Chip 
                        label={`${item.weight_tons || item.requested_quantity || 0} т`}
                        size="small"
                        variant="outlined"
                      />
                      {item.profile_type && (
                        <Chip 
                          label={formulas[item.profile_type]?.name || item.profile_type}
                          size="small"
                          color="info"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </Box>
                ))}
                {selectedItemsInfo.length > 5 && (
                  <Box sx={{ p: 1, textAlign: 'center', bgcolor: 'action.hover' }}>
                    <Typography variant="caption" color="textSecondary">
                      и еще {selectedItemsInfo.length - 5} строк...
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          )}
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Box>
          <Tooltip title="Информация о расчете">
            <IconButton size="small">
              <InfoIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Box>
          <Button onClick={onClose} sx={{ mr: 1 }}>
            Отмена
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCalculate}
            disabled={loading || !isValid || selectedItems.length === 0}
            startIcon={loading ? <CircularProgress size={20} /> : <CalculateIcon />}
          >
            {loading ? 'Расчет...' : 'Пересчитать'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default MetalCalculatorModal;
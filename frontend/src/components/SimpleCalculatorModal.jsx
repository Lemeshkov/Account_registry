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
  Box,
  Typography,
  Grid,
  Alert,
  Chip,
  Paper,
  Divider,
  IconButton,
  InputAdornment,
  Tab,
  Tabs,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Calculate as CalculateIcon,
  Close as CloseIcon,
  SwapHoriz as SwapIcon,
  AutoFixHigh as AutoDetectIcon,
  Add as AddIcon,
  Save as SaveIcon,
} from '@mui/icons-material';

// Формулы для расчета веса металлопроката
const calculateWeight = (type, params, meters) => {
  if (!meters || meters <= 0) return 0;
  
  try {
    switch (type) {
      case 'pipe': {
        const d = parseFloat(params.d);
        const t = parseFloat(params.t);
        if (!d || !t) return 0;
        // Вес 1 метра трубы в кг
        const weightPerMeter = (d - t) * t * 0.02466;
        return (weightPerMeter * meters) / 1000; // переводим в тонны
      }
      
      case 'rebar': {
        const d = parseFloat(params.d);
        if (!d) return 0;
        // Вес 1 метра арматуры в кг
        const weightPerMeter = d * d * 0.00617;
        return (weightPerMeter * meters) / 1000;
      }
      
      case 'sheet': {
        const thickness = parseFloat(params.thickness);
        const width = parseFloat(params.width);
        const length = parseFloat(params.length);
        if (!thickness || !width || !length) return 0;
        // Вес листа в кг: толщина(мм) * 7.85 * ширина(м) * длина(м)
        const weightPerSheet = thickness * 7.85 * width * length;
        return (weightPerSheet * (meters / length)) / 1000;
      }
      
      case 'angle': {
        const a = parseFloat(params.a);
        const b = parseFloat(params.b);
        const t = parseFloat(params.t);
        if (!a || !b || !t) return 0;
        // Вес 1 метра уголка в кг
        const weightPerMeter = (a + b - t) * t * 0.00785;
        return (weightPerMeter * meters) / 1000;
      }
      
      case 'beam': {
        // Для двутавра используем справочные данные
        const profileNumber = parseInt(params.profile_number);
        const weightPerMeter = getBeamWeight(profileNumber);
        return (weightPerMeter * meters) / 1000;
      }
      
      default:
        return 0;
    }
  } catch (error) {
    console.error('Calculation error:', error);
    return 0;
  }
};

// Справочник весов двутавров (кг/м)
const getBeamWeight = (profileNumber) => {
  const beamWeights = {
    10: 9.46,
    12: 11.5,
    14: 13.7,
    16: 15.9,
    18: 18.4,
    20: 21.0,
    22: 24.0,
    24: 27.3,
    27: 31.5,
    30: 36.5,
    36: 48.6,
    40: 57.0,
    45: 66.5,
    50: 78.5,
    55: 92.6,
    60: 108.0,
  };
  return beamWeights[profileNumber] || 0;
};

// Обратный расчет: из тонн в метры
const calculateMeters = (type, params, tons) => {
  if (!tons || tons <= 0) return 0;
  
  try {
    switch (type) {
      case 'pipe': {
        const d = parseFloat(params.d);
        const t = parseFloat(params.t);
        if (!d || !t) return 0;
        const weightPerMeter = (d - t) * t * 0.02466;
        return (tons * 1000) / weightPerMeter;
      }
      
      case 'rebar': {
        const d = parseFloat(params.d);
        if (!d) return 0;
        const weightPerMeter = d * d * 0.00617;
        return (tons * 1000) / weightPerMeter;
      }
      
      case 'sheet': {
        const thickness = parseFloat(params.thickness);
        const width = parseFloat(params.width);
        const length = parseFloat(params.length);
        if (!thickness || !width || !length) return 0;
        const weightPerSheet = thickness * 7.85 * width * length;
        return (tons * 1000) / (weightPerSheet / length);
      }
      
      case 'angle': {
        const a = parseFloat(params.a);
        const b = parseFloat(params.b);
        const t = parseFloat(params.t);
        if (!a || !b || !t) return 0;
        const weightPerMeter = (a + b - t) * t * 0.00785;
        return (tons * 1000) / weightPerMeter;
      }
      
      case 'beam': {
        const profileNumber = parseInt(params.profile_number);
        const weightPerMeter = getBeamWeight(profileNumber);
        return (tons * 1000) / weightPerMeter;
      }
      
      default:
        return 0;
    }
  } catch (error) {
    console.error('Calculation error:', error);
    return 0;
  }
};

// Автоопределение параметров из наименования
const detectParamsFromName = (materialName) => {
  if (!materialName) return null;
  
  const name = materialName.toLowerCase();
  
  // Паттерны для трубы: 108х4, 159*6, труба 108х4.5
  const pipePatterns = [
    /(\d+)[\sхx*\/]+(\d+(?:\.\d+)?)/i,
    /труб[аы][^\d]*(\d+)[^\d]*(\d+(?:\.\d+)?)/i,
    /ду[^\d]*(\d+)[^\d]*(\d+(?:\.\d+)?)/i,
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
  
  // Паттерны для арматуры: арматура 12, а400с 14
  const rebarPatterns = [
    /арматур[аы][^\d]*(\d+)/i,
    /а[0-9]{3}[^\d]*(\d+)/i,
    /стерж[её]н[ь]*[^\d]*(\d+)/i,
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
  
  // Паттерны для уголка: уголок 75х50х5
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

const SimpleCalculatorModal = ({ open, onClose, onCalculate, item, itemsData, formulas }) => {
  const [selectedType, setSelectedType] = useState('pipe');
  const [params, setParams] = useState({});
  const [meters, setMeters] = useState('');
  const [tons, setTons] = useState('');
  const [result, setResult] = useState(null);
  const [calculationMode, setCalculationMode] = useState('metersToTons');
  const [errors, setErrors] = useState({});
  const [autoDetected, setAutoDetected] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [newRowData, setNewRowData] = useState({
    position: '',
    address: '',
    material_name: '',
  });
  const [createNewRow, setCreateNewRow] = useState(false);

  // Сброс при открытии
  useEffect(() => {
    if (open) {
      if (item) {
        // Если есть выбранная строка, пробуем автоопределить
        setSelectedType(item.profile_type || 'pipe');
        if (item.profile_params) {
          setParams(item.profile_params);
        } else {
          const detected = detectParamsFromName(item.material_name);
          if (detected) {
            setSelectedType(detected.type);
            setParams(detected.params);
            setAutoDetected(true);
          }
        }
        // Подставляем вес если есть
        if (item.weight_tons) {
          setTons(item.weight_tons.toString());
          setCalculationMode('tonsToMeters');
        } else if (item.calculated_meters) {
          setMeters(item.calculated_meters.toString());
          setCalculationMode('metersToTons');
        }
        setCreateNewRow(false);
      } else {
        // Сброс для нового расчета
        setSelectedType('pipe');
        setParams({});
        setMeters('');
        setTons('');
        setResult(null);
        setAutoDetected(false);
        setErrors({});
        setCreateNewRow(true);
        // Генерируем следующий номер позиции
        if (itemsData && itemsData.length > 0) {
          const maxPosition = Math.max(...itemsData.map(i => parseInt(i.position) || 0));
          setNewRowData({
            position: (maxPosition + 1).toString(),
            address: '',
            material_name: '',
          });
        } else {
          setNewRowData({
            position: '1',
            address: '',
            material_name: '',
          });
        }
      }
    }
  }, [open, item, itemsData]);

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
        const num = parseFloat(value);
        if (isNaN(num)) {
          newErrors[param.name] = `Должно быть числом`;
        } else if (param.min && num < param.min) {
          newErrors[param.name] = `Мин. ${param.min}`;
        } else if (param.max && num > param.max) {
          newErrors[param.name] = `Макс. ${param.max}`;
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Расчет
  const handleCalculate = () => {
    if (!validateParams()) return;
    
    if (calculationMode === 'metersToTons') {
      if (!meters || parseFloat(meters) <= 0) {
        setErrors({ meters: 'Введите количество метров' });
        return;
      }
      const weight = calculateWeight(selectedType, params, parseFloat(meters));
      setResult({
        meters: parseFloat(meters),
        tons: weight,
        formula: getFormulaDescription(selectedType, params),
        type: selectedType,
      });
    } else {
      if (!tons || parseFloat(tons) <= 0) {
        setErrors({ tons: 'Введите вес в тоннах' });
        return;
      }
      const metersCalc = calculateMeters(selectedType, params, parseFloat(tons));
      setResult({
        tons: parseFloat(tons),
        meters: metersCalc,
        formula: getFormulaDescription(selectedType, params),
        type: selectedType,
      });
    }
  };

  // Применить результат к строке
  const handleApply = () => {
    if (!result) return;
    
    if (createNewRow) {
      // Создаем новую строку
      if (!newRowData.material_name) {
        alert('Введите наименование материала');
        return;
      }
      
      const newItem = {
        id: Date.now(), // временный ID, при сохранении заменится на реальный
        position: newRowData.position || '1',
        address: newRowData.address || '',
        material_name: newRowData.material_name,
        requested_quantity: result.tons.toFixed(3),
        weight_tons: result.tons.toFixed(3),
        calculated_meters: result.meters.toFixed(2),
        profile_type: selectedType,
        profile_params: params,
        is_calculated: true,
        formula_used: result.formula,
      };
      
      onCalculate({
        ...result,
        isNewRow: true,
        newRowData: newItem
      });
    } else {
      // Обновляем существующую строку
      const resultData = {
        id: item?.id || Date.now(),
        meters: result.meters.toFixed(2),
        weightTons: result.tons.toFixed(3),
        profileType: selectedType,
        formula: result.formula,
      };
      
      onCalculate(resultData);
    }
    
    onClose();
  };

  // Описание формулы
  const getFormulaDescription = (type, params) => {
    const profile = formulas[type];
    if (!profile) return '';
    
    let formula = profile.formula;
    Object.entries(params).forEach(([key, value]) => {
      formula = formula.replace(`{${key}}`, value);
    });
    return formula;
  };

  // Обработчик изменения параметра
  const handleParamChange = (paramName, value) => {
    setParams(prev => ({
      ...prev,
      [paramName]: value
    }));
    setResult(null);
    if (errors[paramName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[paramName];
        return newErrors;
      });
    }
  };

  // Автоопределение
  const handleAutoDetect = () => {
    if (createNewRow && newRowData.material_name) {
      const detected = detectParamsFromName(newRowData.material_name);
      if (detected) {
        setSelectedType(detected.type);
        setParams(detected.params);
        setAutoDetected(true);
        setResult(null);
      }
    } else if (item?.material_name) {
      const detected = detectParamsFromName(item.material_name);
      if (detected) {
        setSelectedType(detected.type);
        setParams(detected.params);
        setAutoDetected(true);
        setResult(null);
      }
    }
  };

  const currentProfile = formulas[selectedType];
  const isParamsValid = Object.keys(errors).length === 0 && 
    currentProfile?.params.every(p => params[p.name] !== undefined && params[p.name] !== '');

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { minHeight: '600px' } }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <CalculateIcon color="primary" />
            <Typography variant="h6">
              Калькулятор металлопроката
            </Typography>
            {item && !createNewRow && (
              <Chip 
                label={`Строка №${item.position}`}
                size="small"
                color="info"
                variant="outlined"
              />
            )}
            {createNewRow && (
              <Chip 
                label="Новая строка"
                size="small"
                color="success"
                icon={<AddIcon />}
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
          {/* Переключатель режима */}
          {!item && (
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={createNewRow}
                    onChange={(e) => setCreateNewRow(e.target.checked)}
                    color="primary"
                  />
                }
                label="Создать новую строку"
              />
            </Grid>
          )}

          {/* Поля для новой строки */}
          {createNewRow && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom color="textSecondary">
                Данные новой строки
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="№ позиции"
                      value={newRowData.position}
                      onChange={(e) => setNewRowData({...newRowData, position: e.target.value})}
                    />
                  </Grid>
                  <Grid item xs={12} sm={9}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Адрес (Марка)"
                      value={newRowData.address}
                      onChange={(e) => setNewRowData({...newRowData, address: e.target.value})}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Наименование материала"
                      value={newRowData.material_name}
                      onChange={(e) => setNewRowData({...newRowData, material_name: e.target.value})}
                      required
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          )}

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
                  onClick={() => {
                    setSelectedType(type);
                    setParams({});
                    setResult(null);
                    setAutoDetected(false);
                  }}
                  color={selectedType === type ? 'primary' : 'default'}
                  variant={selectedType === type ? 'filled' : 'outlined'}
                  sx={{ cursor: 'pointer' }}
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
              {(item || (createNewRow && newRowData.material_name)) && (
                <Button
                  size="small"
                  startIcon={<AutoDetectIcon />}
                  onClick={handleAutoDetect}
                  disabled={autoDetected}
                >
                  {autoDetected ? 'Автоопределено' : 'Автоопределить'}
                </Button>
              )}
            </Box>
            
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
              <Grid container spacing={2}>
                {currentProfile?.params.map(param => (
                  <Grid item xs={12} sm={6} key={param.name}>
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
            </Paper>
          </Grid>

          {/* Режим расчета */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom color="textSecondary">
              Режим расчета
            </Typography>
            <Tabs 
              value={calculationMode} 
              onChange={(e, val) => {
                setCalculationMode(val);
                setResult(null);
                setErrors({});
              }}
              variant="fullWidth"
            >
              <Tab 
                value="metersToTons" 
                label="Метры → Тонны" 
                icon={<SwapIcon sx={{ transform: 'rotate(90deg)' }} />}
                iconPosition="start"
              />
              <Tab 
                value="tonsToMeters" 
                label="Тонны → Метры" 
                icon={<SwapIcon />}
                iconPosition="start"
              />
            </Tabs>
          </Grid>

          {/* Ввод значений */}
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={2} alignItems="flex-end">
                {calculationMode === 'metersToTons' ? (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Количество метров"
                      type="number"
                      value={meters}
                      onChange={(e) => {
                        setMeters(e.target.value);
                        setResult(null);
                        setErrors({});
                      }}
                      error={!!errors.meters}
                      helperText={errors.meters}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">м</InputAdornment>,
                      }}
                    />
                  </Grid>
                ) : (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Вес в тоннах"
                      type="number"
                      value={tons}
                      onChange={(e) => {
                        setTons(e.target.value);
                        setResult(null);
                        setErrors({});
                      }}
                      error={!!errors.tons}
                      helperText={errors.tons}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">т</InputAdornment>,
                      }}
                    />
                  </Grid>
                )}
                
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleCalculate}
                    disabled={!isParamsValid}
                    startIcon={<CalculateIcon />}
                    fullWidth
                  >
                    Рассчитать
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Результат */}
          {result && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom color="textSecondary">
                Результат
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'success.50' }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      {calculationMode === 'metersToTons' ? 'Введено метров:' : 'Введено тонн:'}
                    </Typography>
                    <Typography variant="h6">
                      {calculationMode === 'metersToTons' ? result.meters.toFixed(2) : result.tons.toFixed(3)}
                      <Typography component="span" variant="body2" color="textSecondary" sx={{ ml: 1 }}>
                        {calculationMode === 'metersToTons' ? 'м' : 'т'}
                      </Typography>
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      {calculationMode === 'metersToTons' ? 'Вес:' : 'Длина:'}
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {calculationMode === 'metersToTons' ? result.tons.toFixed(3) : result.meters.toFixed(2)}
                      <Typography component="span" variant="body2" color="textSecondary" sx={{ ml: 1 }}>
                        {calculationMode === 'metersToTons' ? 'т' : 'м'}
                      </Typography>
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="caption" color="textSecondary">
                      Формула: {result.formula}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          )}

          {/* Информация о выбранной строке */}
          {item && !createNewRow && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom color="textSecondary">
                Текущая строка
              </Typography>
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'info.50' }}>
                <Typography variant="body2">
                  <strong>Наименование:</strong> {item.material_name}
                </Typography>
                <Box display="flex" gap={2} mt={1}>
                  {item.weight_tons && (
                    <Chip 
                      label={`Вес: ${item.weight_tons} т`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                  {item.calculated_meters && (
                    <Chip 
                      label={`Пересчитано: ${item.calculated_meters} м`}
                      size="small"
                      color="success"
                      variant="outlined"
                    />
                  )}
                </Box>
              </Paper>
            </Grid>
          )}
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Button onClick={onClose}>
          Отмена
        </Button>
        {result && (
          <Button
            variant="contained"
            color="success"
            onClick={handleApply}
            startIcon={createNewRow ? <AddIcon /> : <SaveIcon />}
          >
            {createNewRow ? 'Создать строку' : 'Применить к строке'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default SimpleCalculatorModal;


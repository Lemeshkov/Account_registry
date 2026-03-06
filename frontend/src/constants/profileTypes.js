export const PROFILE_TYPES = {
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
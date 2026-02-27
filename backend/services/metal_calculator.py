"""
Сервис для пересчета металлопроката из тонн в метры
"""
import math
import logging
from typing import Dict, Any, Optional, List, Tuple
from enum import Enum

logger = logging.getLogger(__name__)

class ProfileType(str, Enum):
    """Типы профилей металлопроката"""
    PIPE = "pipe"  # труба
    REBAR = "rebar"  # арматура
    BEAM = "beam"  # балка
    SHEET = "sheet"  # лист
    ANGLE = "angle"  # уголок
    CHANNEL = "channel"  # швеллер
    OTHER = "other"  # другое


class MetalCalculator:
    """
    Калькулятор для пересчета веса металлопроката в метры.
    Использует теоретический вес 1 метра для каждого типа профиля.
    """
    
    # Константы
    STEEL_DENSITY = 7850  # кг/м³ (плотность стали)
    
    def __init__(self):
        # Кэш для формул (можно расширить из БД или конфига)
        self.formulas = self._init_formulas()
    
    def _init_formulas(self) -> Dict[str, Dict]:
        """Инициализация формул для разных типов профилей"""
        return {
            ProfileType.PIPE: {
                "name": "Труба",
                "formula": "(D - t) * t * 0.02466",
                "description": "D - диаметр (мм), t - толщина стенки (мм)",
                "params": ["d", "t"],
                "function": self._calculate_pipe_weight_per_meter
            },
            ProfileType.REBAR: {
                "name": "Арматура",
                "formula": "(d^2 * 0.00617)",
                "description": "d - диаметр (мм)",
                "params": ["d"],
                "function": self._calculate_rebar_weight_per_meter
            },
            ProfileType.BEAM: {
                "name": "Балка",
                "formula": "Зависит от номера профиля",
                "description": "Используется справочник ГОСТ",
                "params": ["profile_number"],
                "function": self._calculate_beam_weight_per_meter
            },
            ProfileType.SHEET: {
                "name": "Лист",
                "formula": "t * 7.85",
                "description": "t - толщина (мм), вес 1 м² в кг",
                "params": ["t"],
                "function": self._calculate_sheet_weight_per_meter
            },
            ProfileType.ANGLE: {
                "name": "Уголок",
                "formula": "Зависит от размеров",
                "description": "Используется справочник",
                "params": ["a", "b", "t"],
                "function": self._calculate_angle_weight_per_meter
            },
            ProfileType.CHANNEL: {
                "name": "Швеллер",
                "formula": "Зависит от номера",
                "description": "Используется справочник",
                "params": ["profile_number"],
                "function": self._calculate_channel_weight_per_meter
            }
        }
    
    def calculate_meters(self, 
                        weight_tons: float, 
                        profile_type: str, 
                        params: Dict[str, Any]) -> Tuple[Optional[float], Optional[str], Optional[str]]:
        """
        Пересчитывает тонны в метры.
        
        Args:
            weight_tons: вес в тоннах
            profile_type: тип профиля
            params: параметры профиля (зависят от типа)
            
        Returns:
            Tuple[метры, использованная формула, сообщение об ошибке]
        """
        try:
            if profile_type not in self.formulas:
                return None, None, f"Неподдерживаемый тип профиля: {profile_type}"
            
            profile_info = self.formulas[profile_type]
            weight_per_meter_kg = profile_info["function"](params)
            
            if weight_per_meter_kg <= 0:
                return None, None, "Не удалось рассчитать вес погонного метра"
            
            # Пересчет: тонны -> кг, делим на вес метра
            weight_kg = weight_tons * 1000
            meters = weight_kg / weight_per_meter_kg
            
            # Округляем до 2 знаков
            meters = round(meters, 2)
            
            return meters, profile_info["formula"], None
            
        except Exception as e:
            logger.error(f"Calculation error: {e}")
            return None, None, str(e)
    
    def calculate_batch(self, 
                        items: List[Dict[str, Any]], 
                        default_profile_type: str = "pipe",
                        default_params: Optional[Dict] = None) -> List[Dict[str, Any]]:
        """
        Пакетный пересчет нескольких строк.
        
        Args:
            items: список словарей с полями weight_tons, profile_type, profile_params
            default_profile_type: тип профиля по умолчанию
            default_params: параметры по умолчанию
            
        Returns:
            Список результатов с добавленными полями calculated_meters, formula_used, error
        """
        results = []
        
        for item in items:
            result = item.copy()
            
            weight = item.get("weight_tons") or item.get("requested_quantity")
            if not weight:
                result["error"] = "Нет данных о весе"
                result["calculated_meters"] = None
                results.append(result)
                continue
            
            profile_type = item.get("profile_type", default_profile_type)
            params = item.get("profile_params") or default_params or {}
            
            meters, formula, error = self.calculate_meters(
                weight_tons=float(weight),
                profile_type=profile_type,
                params=params
            )
            
            result["calculated_meters"] = meters
            result["formula_used"] = formula
            result["error"] = error
            result["is_calculated"] = error is None
            
            results.append(result)
        
        return results
    
    # ----- Формулы для расчета веса погонного метра (кг/м) -----
    
    def _calculate_pipe_weight_per_meter(self, params: Dict) -> float:
        """
        Вес 1 метра трубы: (D - t) * t * 0.02466
        D - наружный диаметр (мм)
        t - толщина стенки (мм)
        """
        d = params.get("d")
        t = params.get("t")
        
        if not d or not t:
            raise ValueError("Для трубы нужны параметры: d (диаметр) и t (толщина стенки)")
        
        return (float(d) - float(t)) * float(t) * 0.02466
    
    def _calculate_rebar_weight_per_meter(self, params: Dict) -> float:
        """
        Вес 1 метра арматуры: d² * 0.00617
        d - диаметр (мм)
        """
        d = params.get("d")
        
        if not d:
            raise ValueError("Для арматуры нужен параметр: d (диаметр)")
        
        return float(d) ** 2 * 0.00617
    
    def _calculate_beam_weight_per_meter(self, params: Dict) -> float:
        """
        Вес балки по номеру профиля (упрощенно)
        В реальности нужно использовать справочник ГОСТ
        """
        profile_number = params.get("profile_number")
        
        if not profile_number:
            raise ValueError("Для балки нужен номер профиля")
        
        # Упрощенная формула для демо
        try:
            num = float(profile_number)
            # Примерная зависимость: вес ~ номер * 10 кг/м
            return num * 10
        except:
            return 30  # значение по умолчанию
    
    def _calculate_sheet_weight_per_meter(self, params: Dict) -> float:
        """
        Вес 1 м² листа: t * 7.85
        t - толщина (мм)
        Для пересчета в метры нужно знать ширину листа
        """
        t = params.get("t")
        width = params.get("width", 1.5)  # ширина листа в метрах (по умолчанию 1.5м)
        
        if not t:
            raise ValueError("Для листа нужен параметр: t (толщина)")
        
        # Вес 1 м²
        weight_per_sqm = float(t) * 7.85
        
        # Вес 1 погонного метра при заданной ширине
        return weight_per_sqm * width
    
    def _calculate_angle_weight_per_meter(self, params: Dict) -> float:
        """
        Вес уголка (упрощенно)
        """
        a = params.get("a")  # полка 1
        b = params.get("b", a)  # полка 2
        t = params.get("t")  # толщина
        
        if not a or not t:
            raise ValueError("Для уголка нужны параметры: a (полка) и t (толщина)")
        
        # Упрощенная формула
        return (float(a) + float(b) - float(t)) * float(t) * 0.031
    
    def _calculate_channel_weight_per_meter(self, params: Dict) -> float:
        """
        Вес швеллера по номеру (упрощенно)
        """
        profile_number = params.get("profile_number")
        
        if not profile_number:
            raise ValueError("Для швеллера нужен номер профиля")
        
        try:
            num = float(profile_number)
            # Примерная зависимость
            return num * 8.5
        except:
            return 25


# Глобальный экземпляр для использования
metal_calculator = MetalCalculator()


def calculate_pipe_meters(weight_tons: float, diameter_mm: float, wall_thickness_mm: float) -> float:
    """Удобная функция для пересчета трубы"""
    params = {"d": diameter_mm, "t": wall_thickness_mm}
    meters, _, _ = metal_calculator.calculate_meters(weight_tons, "pipe", params)
    return meters
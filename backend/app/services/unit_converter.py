"""
Standalone unit converter utilities.
"""
from typing import Optional


def level_pct_to_volume(level_pct: float, shape: str, dimensions: dict) -> float:
    """Convert level percentage to absolute volume in litres."""
    import math
    if shape == "cylindrical":
        r = dimensions.get("diameter_cm", 0) / 2
        h = dimensions.get("height_cm", 0)
        cap_litres = math.pi * r ** 2 * h / 1000
    elif shape == "rectangular":
        l = dimensions.get("length_cm", 0)
        w = dimensions.get("width_cm", 0)
        h = dimensions.get("height_cm", 0)
        cap_litres = l * w * h / 1000
    else:
        cap_litres = 0.0
    return round(cap_litres * level_pct / 100, 4)


def volume_to_level_pct(volume_litres: float, shape: str, dimensions: dict) -> Optional[float]:
    """Inverse: volume in litres → level percentage."""
    import math
    if shape == "cylindrical":
        r = dimensions.get("diameter_cm", 0) / 2
        h = dimensions.get("height_cm", 0)
        cap_litres = math.pi * r ** 2 * h / 1000
    elif shape == "rectangular":
        cap_litres = dimensions.get("length_cm", 0) * dimensions.get("width_cm", 0) * dimensions.get("height_cm", 0) / 1000
    else:
        return None
    if cap_litres <= 0:
        return None
    return round(volume_litres / cap_litres * 100, 4)

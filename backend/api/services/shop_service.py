from django.db import transaction
from api.models import UserProfile

@transaction.atomic
def buy_item(user, item_id: str, cost: int, heal_amount: int = 0, is_consumable: bool = False):
    """
    Покупка предмета в магазине.
    Использует select_for_update() для атомарного списания золота.
    """
    # Блокируем профиль пользователя до конца транзакции
    profile = UserProfile.objects.select_for_update().get(user=user)

    if profile.gold < cost:
        return False, "Not enough gold", profile

    # Списываем золото
    profile.gold -= cost

    # Применяем эффекты предмета
    if heal_amount > 0:
        profile.hp = min(profile.hp_max, profile.hp + heal_amount)
    
    # Если предмет не расходник, добавляем в инвентарь
    if not is_consumable:
        if not isinstance(profile.inventory, list):
            profile.inventory = []
        
        # Добавляем ID предмета в инвентарь
        profile.inventory.append({"id": item_id})

    profile.save()

    return True, "Item purchased successfully", profile

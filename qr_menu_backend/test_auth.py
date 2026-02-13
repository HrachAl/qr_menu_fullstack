#!/usr/bin/env python3
"""
Простой скрипт для тестирования авторизации
"""
import json
from utils import read_json, verify_password

print("=" * 50)
print("Тест системы авторизации")
print("=" * 50)

# Читаем пользователей
users = read_json("users.json")
print(f"\nНайдено пользователей: {len(users)}")

for user in users:
    print(f"\nПользователь:")
    print(f"  ID: {user['id']}")
    print(f"  Username: {user['username']}")
    print(f"  Password: {user['password']}")
    print(f"  Role: {user['role']}")

# Тестируем логин админа
print("\n" + "=" * 50)
print("Тест логина админа")
print("=" * 50)

test_username = "admin"
test_password = "123456"

user = next((u for u in users if u["username"] == test_username), None)

if user:
    print(f"\n✓ Пользователь '{test_username}' найден")
    print(f"  Сохраненный пароль: {user['password']}")
    print(f"  Тестовый пароль: {test_password}")
    
    if verify_password(test_password, user["password"]):
        print(f"\n✓ Пароль верный!")
        print(f"  Роль: {user['role']}")
    else:
        print(f"\n✗ Пароль неверный!")
else:
    print(f"\n✗ Пользователь '{test_username}' не найден")

print("\n" + "=" * 50)

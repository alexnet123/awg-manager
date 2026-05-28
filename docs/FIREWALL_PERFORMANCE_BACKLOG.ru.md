# Firewall Performance Backlog (RU)

## Цель
Единый файл для фиксации проблем производительности Firewall UI/API, текущих метрик и гипотез перед отдельным спринтом оптимизации.

## Контекст (на 2026-05-22)
- `collections` функционально работают стабильно.
- Основной лаг наблюдается при операциях, которые вызывают полный `apply_firewall_rules()`.
- Операции без runtime-`apply` выполняются почти мгновенно.

## Замеры (стенд `132.243.237.120`)
Источник: ручной API-профилинг (серии из 5-8 повторов).

| Сценарий | Среднее время |
|---|---:|
| `POST` set disabled (create/update comment only) | ~0.8 ms |
| UI flow: `POST + GET sets + GET maps` (без apply) | ~1.9 ms |
| `POST` set enabled + runtime change (apply expected) | ~625 ms |
| UI flow с runtime-save (`POST + GET sets + GET maps`) | ~647 ms |
| `DELETE` enabled set | ~602 ms |
| `DELETE` disabled set | ~0.9 ms |
| `POST /firewall/apply` (чистый вызов) | ~570 ms |

## Текущее заключение
Узкое место: **полный runtime-реapply (`apply_firewall_rules`)**, а не UI/сеть/обычный API-сериализатор.

## Подозрительные зоны в коде
- Полная пересборка runtime-таблиц/цепочек/объектов вместо инкрементальных изменений.
- Серия внешних вызовов `nft` через `subprocess`.
- Рост количества custom tables увеличивает стоимость полного apply.

## Что уже сделано частично
- Убраны лишние apply для части non-runtime операций `collections`.
- Добавлена защита/логика для timeout-коллекций (read-only + cleanup).

## Бэклог оптимизации (отложено на отдельный спринт)
1. Fast-path для `sets/maps/vmaps`: точечные `nft add/delete/replace` без полного apply.
2. Полный apply оставить только для topology-изменений (tables/chains/rules schema changes).
3. Очередь/дебаунс apply при burst-кликах в UI.
4. Отдельный benchmark-скрипт с отчетом `p50/p95/max` по ключевым операциям.

## Шаблон для новых наблюдений
### [YYYY-MM-DD] Краткий заголовок
- Симптом:
- Точка входа (UI/API):
- Шаги воспроизведения:
- Метрики (n, avg, p50, p95, max):
- Предполагаемая причина:
- Временный workaround:
- Решение (если внедрено):


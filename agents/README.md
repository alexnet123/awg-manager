# Материалы для агентов

`agents/` хранит репозиторные материалы, которые помогают агентам работать
одинаково в этом проекте.

Это не автоподключаемая папка Codex. Codex по-прежнему обнаруживает skills из
локального `~/.codex/skills/`, но repo-копии здесь позволяют переносить знания
вместе с кодом.

## Структура

```text
agents/
└── skills/
    └── awg-manager-ui-style/
        └── SKILL.md
```

## Как обновлять skill snapshot

Если локальный skill `awg-manager-ui-style` менялся или активно использовался в
UI-задачах, синхронизируйте его repo-копию не чаще одного раза в день:

```bash
cp ~/.codex/skills/awg-manager-ui-style/SKILL.md \
  agents/skills/awg-manager-ui-style/SKILL.md
```

Перед коммитом проверьте diff:

```bash
git diff -- agents/skills/awg-manager-ui-style/SKILL.md
```

Не копируйте сюда личные, экспериментальные или не относящиеся к AWG Manager
skills без явного решения владельца проекта.

# AWG Manager (RU)

AWG Manager — это инструмент управления AmneziaWG:

- CLI
- HTTP API
- Web UI (`/ui/`)
- экспорт клиентских `.conf` и QR
- поддержка AWG v1 и v2 (по умолчанию v2)

English README: [README.md](README.md)

## Быстрый запуск (около 10 минут)

```bash
git clone https://github.com/alexnet123/awg-manager.git
cd awg-manager
sudo ./scripts/install_test_stand.sh --project-dir /root/awg-manager --host 0.0.0.0 --port 8787
```

Открыть UI:

`http://IP_СЕРВЕРА:8787/ui/`

Ключи после установки:

- API key: `/root/key/api.key`
- Encryption key: `/root/key/encryption.key`

## Важно про UI

Папка `webui/dist` хранится в репозитории, чтобы стенд поднимался сразу и без обязательной сборки фронтенда на сервере.

Собирать UI нужно только если меняли фронтенд:

```bash
cd webui
npm install
npm run build
```

## Требования

- Python 3.9+
- бинарники `awg` и `ip`
- root-права для runtime операций

Установка Python-зависимостей:

```bash
python3 -m pip install -r requirements.txt
```

## Основные команды

CLI:

```bash
python3 awg_manager.py
```

Восстановление после перезагрузки:

```bash
python3 awg_manager.py -r /etc/wg-manager/encryption.key
```

Запуск API:

```bash
python3 awg_api.py 0.0.0.0 8787 -r /etc/wg-manager/encryption.key
```

## Авторизация API

Используется заголовок:

- `X-API-Key`

Источник ключа:

- `/etc/wg-manager/api.key`
- или env `AWG_MANAGER_API_KEY`

## Версии AWG

- v1: `Jc Jmin Jmax S1 S2 H1 H2 H3 H4`
- v2: `v1 + S3 S4 I1 I2 I3 I4 I5`

## Документация

- [docs/API.md](docs/API.md)
- [docs/DEPLOY.md](docs/DEPLOY.md)

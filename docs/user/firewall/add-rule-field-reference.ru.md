# Firewall Add Rule: справочник полей

Дата первого черновика: 2026-06-08

Этот файл нужен как живой справочник по форме `Firewall -> policy -> Add`. Здесь фиксируем понятные объяснения для пользователя: что означает поле, когда его заполнять, какие значения оно должно принимать, и какие UX/validation gaps мы нашли во время просмотра стенда.

Связанные документы:

- `docs/FIREWALL_ADMIN_GUIDE.ru.md` — основной учебник.
- `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md` — проверка сценариев на стенде.
- `docs/FIREWALL_CAPABILITY_MATRIX.ru.md` — матрица возможностей и ограничений.

## Как заполнять этот справочник

Для каждого поля используем один и тот же формат:

```text
Поле:
Где находится:
Что делает:
Когда заполнять:
Что должно принимать:
Примеры:
Что не принимать:
Текущий статус:
UX заметки:
```

Правило для optional fields: если поле открывается кнопкой `+`, пользователь должен понимать, что `+` включает дополнительное условие правила. Пустое выключенное поле не должно попадать в payload.

## Base match

### Source address

Поле: `Source address`

Где находится: `Add Firewall Rule -> Base match -> L3 address match`

Что делает: ограничивает правило по адресу источника пакета.

Когда заполнять:

- когда правило должно применяться только к конкретному хосту;
- когда правило должно применяться только к одной подсети;
- когда правило должно применяться к заранее созданной группе адресов.

Что должно принимать:

- один IPv4-адрес: `192.168.1.10`;
- один IPv4 CIDR-префикс: `192.168.1.0/24`;
- один IPv6-адрес: `2001:db8::10`;
- один IPv6 CIDR-префикс: `2001:db8::/64`;
- одну collection-ссылку: `@trusted_hosts`.

Примеры:

```text
192.168.1.10
192.168.1.0/24
2001:db8::10
2001:db8::/64
@trusted_hosts
```

Пример правила:

```text
Chain: input
Source address: 192.168.1.0/24
Protocol: tcp
Destination port: 443
Action: accept
```

Смысл правила: разрешить входящий TCP/443 только от клиентов из подсети `192.168.1.0/24`.

Если нужно несколько адресов, пользовательский путь должен быть через `collections`, а не через перечисление в этом поле:

```text
Firewall -> collections -> address set -> trusted_hosts
Add Rule -> Source address -> @trusted_hosts
```

Что не принимать:

- несколько значений через запятую: `192.168.1.10,192.168.1.11`;
- inline set/list: `{ 192.168.1.10, 192.168.1.11 }`;
- диапазон адресов в одном поле: `192.168.1.10-192.168.1.20`;
- произвольное nft expression;
- одновременно IP/CIDR и collection.

Текущий статус:

- IP/префикс поддерживается backend validation через `ip_network(..., strict=False)`;
- collection-ссылка вида `@trusted_hosts` поддерживается как один set reference;
- несколько значений в одном поле отклоняются: для нескольких адресов нужно создавать `collections -> address set`.

UX заметки:

- placeholder `192.168.1.0/24 or @trusted_hosts` понятный, но рядом с `+` нужна подсказка, что это включение optional match field;
- если пользователь вводит несколько адресов, UI должен предлагать создать `collections -> address set`;
- следующий UX/backend слой: проверять существование `@trusted_hosts` как address collection в текущем `family/table` context до apply/runtime.

### Destination address

Поле: `Destination address`

Где находится: `Add Firewall Rule -> Base match -> L3 address match`

Что делает: ограничивает правило по адресу назначения пакета.

Когда заполнять:

- когда правило должно применяться только к конкретному серверу;
- когда правило должно применяться только к одной подсети назначения;
- когда правило должно применяться к заранее созданной группе серверов/адресов назначения.

Что должно принимать:

- один IPv4-адрес: `10.0.0.10`;
- один IPv4 CIDR-префикс: `10.0.0.0/24`;
- один IPv6-адрес: `2001:db8:10::10`;
- один IPv6 CIDR-префикс: `2001:db8:10::/64`;
- одну collection-ссылку: `@servers`.

Примеры:

```text
10.0.0.10
10.0.0.0/24
2001:db8:10::10
2001:db8:10::/64
@servers
```

Пример правила:

```text
Chain: input
Source address: 192.168.1.0/24
Destination address: 10.0.0.10
Protocol: tcp
Destination port: 443
Action: accept
```

Смысл правила: разрешить входящий TCP/443 от клиентов из `192.168.1.0/24` только к серверу `10.0.0.10`.

Если серверов несколько, пользовательский путь должен быть через `collections`, а не через перечисление в этом поле:

```text
Firewall -> collections -> address set -> servers
Add Rule -> Destination address -> @servers
```

Что не принимать:

- несколько значений через запятую: `10.0.0.10,10.0.0.11`;
- inline set/list: `{ 10.0.0.10, 10.0.0.11 }`;
- диапазон адресов в одном поле: `10.0.0.10-10.0.0.20`;
- произвольное nft expression;
- одновременно IP/CIDR и collection.

Текущий статус:

- IP/префикс поддерживается backend validation через `ip_network(..., strict=False)`;
- collection-ссылка вида `@servers` поддерживается как один set reference;
- несколько значений в одном поле отклоняются: для нескольких адресов назначения нужно создавать `collections -> address set`.

UX заметки:

- placeholder `10.0.0.10 or @servers` понятный, но рядом с `+` нужна подсказка, что это включение optional match field;
- если пользователь вводит несколько серверов, UI должен предлагать создать `collections -> address set`;
- следующий UX/backend слой: проверять существование `@servers` как address collection в текущем `family/table` context до apply/runtime.

### Protocol

Поле: `Protocol`

Где находится: `Add Firewall Rule -> Base match -> L4 protocol and port match`

Что делает: ограничивает правило по L4-протоколу пакета.

Когда заполнять:

- когда правило должно применяться только к TCP, UDP, ICMP или ICMPv6;
- когда нужно указать протокол через числовой ID из IP protocol numbers;
- когда ниже используются `Source port` или `Destination port`.

Что должно принимать:

- одно имя протокола из базового набора: `tcp`, `udp`, `icmp`, `icmpv6`;
- один числовой protocol ID в диапазоне `0..255`;
- пустое значение означает `any`, то есть правило не добавляет условие `meta l4proto`.

Частые числовые значения:

```text
1  = icmp
6  = tcp
17 = udp
47 = gre
50 = esp
58 = icmpv6
```

Примеры:

```text
tcp
udp
icmp
icmpv6
6
17
47
```

Пример правила с именем:

```text
Chain: input
Protocol: tcp
Destination port: 443
Action: accept
```

Пример правила с числом:

```text
Chain: input
Protocol: 6
Destination port: 443
Action: accept
```

Оба примера означают TCP/443. Backend сохранит введенный protocol token (`tcp` или `6`), а renderer для портов подставит правильный transport expression (`tcp dport 443`) там, где это требуется nftables.

Правило для портов:

- `Source port` и `Destination port` можно использовать только с `tcp`, `udp`, `6` или `17`;
- для `icmp`, `icmpv6`, `1` и `58` порты не используются;
- для GRE/ESP через `47`/`50` порты тоже не используются.

Что не принимать:

- числа меньше `0` или больше `255`;
- несколько протоколов в одном поле: `tcp,udp`;
- inline set/list: `{ tcp, udp }`;
- произвольное nft expression;
- имя протокола вне текущего базового allowlist. Например, для GRE сейчас нужно вводить `47`, а не `gre`.

Текущий статус:

- backend validation принимает `tcp`, `udp`, `icmp`, `icmpv6` и numeric protocol ID `0..255`;
- UI поле работает как постоянно видимый combo input: можно печатать значение вручную или выбрать один популярный протокол из выпадающих подсказок;
- `6` и `17` разрешают `Source port`/`Destination port`;
- `1`, `58`, `47`, `50` работают как protocol match без port match.

UX заметки:

- placeholder должен быть коротким: `any`; это означает пустое значение без protocol match;
- выпадающий список должен подсказывать безопасные значения в формате `имя слева / номер справа`: `tcp 6`, `udp 17`, `icmp 1`, `icmpv6 58`, `gre 47`, `esp 50`;
- поле принимает только один protocol token; несколько протоколов нужно делать отдельными правилами или через будущий vmap/collection сценарий;
- если пользователь вводит `gre`/`esp`, хороший следующий UX-слой должен подсказать: `use 47 for gre` или `use 50 for esp`;
- следующий backend/UI слой: решить, хотим ли мы расширить allowlist имен протоколов или оставляем расширенные протоколы только через числовой ID.

### Source port / Destination port

Поля: `Source port`, `Destination port`

Где находятся: `Add Firewall Rule -> Base match -> L4 protocol and port match`

Что делают:

- `Source port` ограничивает правило по исходному L4-порту (`sport`);
- `Destination port` ограничивает правило по целевому L4-порту (`dport`).

Когда заполнять:

- когда `Protocol` выбран как `tcp`, `udp`, `6` или `17`;
- когда нужно открыть/закрыть конкретный сервисный порт, диапазон портов или набор портов;
- когда есть именованная port collection в `collections`, например `@admin_ports`.

Что должно принимать:

- один порт: `443`;
- диапазон через подсказочный формат с дефисом: `1024-65535`;
- диапазон через внутренний nft-friendly формат: `1024:65535`;
- список портов и диапазонов через запятую: `22,80,443` или `22,80,8000-9000`;
- одну ссылку на port collection: `@admin_ports`.

Что делает backend:

- `1024-65535` нормализуется как `1024:65535`, а в nft render выходит как `1024-65535`;
- `22,80,443` рендерится как nft set: `{ 22, 80, 443 }`;
- `@admin_ports` рендерится как ссылка на named set: `@admin_ports`;
- если порт указан, а `Protocol` не `tcp`, `udp`, `6` или `17`, правило отклоняется validation.

Примеры:

```text
Protocol: tcp
Destination port: 443
```

Результат по смыслу: TCP на порт назначения 443.

```text
Protocol: tcp
Source port: 1024-65535
Destination port: 22,80,443
```

Результат по смыслу: TCP с клиентского ephemeral range на один из портов `22`, `80`, `443`.

```text
Protocol: udp
Destination port: @admin_ports
```

Результат по смыслу: UDP на набор портов из `collections -> port set admin_ports`.

Что не принимать:

- порт `0` или больше `65535`;
- обратный диапазон: `9000-8000`;
- несколько collection references в одном поле: `@a,@b`;
- inline nft expression: `{ 22, 80 }`;
- порты вместе с `Protocol: icmp`, `icmpv6`, `1`, `58`, `47`, `50`.

UX заметки:

- кнопка `+` у портового поля может автоматически поставить `Protocol: tcp`, если Protocol пустой;
- если пользователь уже выбрал `udp`, портовое поле должно сохранить UDP-смысл;
- подсказки `1024-65535 or @admin_ports` и `22,80,443 or @admin_ports` теперь соответствуют backend validation/render;
- следующий UX-слой: для `@admin_ports` хорошо показывать, существует ли такая port collection в текущем `family/table` context.

### ICMP IPv4 / ICMP IPv6

Поля: `ICMP IPv4`, `ICMP IPv6`

Где находятся: `Add Firewall Rule -> Advanced match -> Network & L4 extras`

Что делают:

- `ICMP IPv4` группирует пару `icmp_type` + `icmp_code`;
- `ICMP IPv6` группирует пару `icmpv6_type` + `icmpv6_code`;
- `Type` выбирает вид ICMP-сообщения;
- `Code` уточняет причину внутри выбранного `Type` и обычно остается пустым.

Когда заполнять:

- когда правило должно матчить не просто весь ICMP, а конкретный тип ICMP-сообщения;
- для ping-сценариев: `echo-request` или `echo-reply`;
- для диагностики ошибок сети: `destination-unreachable`, `time-exceeded`, `packet-too-big`;
- `Code` заполнять только если нужно отличить конкретную причину внутри типа.

Что должно принимать:

- `Type`: одно имя ICMP/ICMPv6 типа из подсказок или совместимый nftables literal;
- `Code`: одно число `0..255`, если нужен узкий матч причины;
- пустой `Code` означает: матчить весь выбранный `Type` без уточнения причины.

Как выбирать `Code`:

- сначала выбрать `Type`;
- посмотреть блок `Code options for <type>`;
- если подходит любой code внутри выбранного типа, оставить `empty`;
- если нужна конкретная причина, выбрать один из видимых code presets.

Частые коды ICMP IPv4:

| Type | Code | Смысл |
|---|---:|---|
| `echo-request` | `0` | ping-запрос |
| `echo-reply` | `0` | ping-ответ |
| `destination-unreachable` | `0` | network unreachable |
| `destination-unreachable` | `1` | host unreachable |
| `destination-unreachable` | `2` | protocol unreachable |
| `destination-unreachable` | `3` | port unreachable |
| `destination-unreachable` | `4` | fragmentation needed |
| `destination-unreachable` | `13` | administratively prohibited |
| `time-exceeded` | `0` | TTL expired in transit |
| `time-exceeded` | `1` | fragment reassembly timeout |
| `parameter-problem` | `0` | bad header pointer |
| `parameter-problem` | `1` | required option missing |
| `parameter-problem` | `2` | bad length |
| `redirect` | `0` | redirect network |
| `redirect` | `1` | redirect host |

Частые коды ICMPv6:

| Type | Code | Смысл |
|---|---:|---|
| `echo-request` | `0` | ping-запрос |
| `echo-reply` | `0` | ping-ответ |
| `packet-too-big` | `0` | packet too big / PMTU |
| `destination-unreachable` | `0` | no route |
| `destination-unreachable` | `1` | admin prohibited |
| `destination-unreachable` | `2` | beyond scope |
| `destination-unreachable` | `3` | address unreachable |
| `destination-unreachable` | `4` | port unreachable |
| `time-exceeded` | `0` | hop limit exceeded |
| `time-exceeded` | `1` | fragment reassembly timeout |
| `parameter-problem` | `0` | erroneous header field |
| `parameter-problem` | `1` | unknown next header |
| `parameter-problem` | `2` | unknown IPv6 option |

Примеры:

```text
ICMP IPv4 Type: echo-request
ICMP IPv4 Code: пусто
```

Смысл правила: матчить ping-запросы IPv4. UI автоматически ставит `Protocol: icmp`.

```text
ICMP IPv4 Type: destination-unreachable
ICMP IPv4 Code: 3
```

Смысл правила: матчить IPv4 ICMP `destination-unreachable` с уточнением `port unreachable`.

```text
ICMP IPv6 Type: packet-too-big
ICMP IPv6 Code: пусто
```

Смысл правила: матчить IPv6 PMTU-сообщения. UI автоматически ставит `Protocol: icmpv6`.

Что делает backend:

- для IPv4 сохраняет старые API-поля `icmp_type` и `icmp_code`;
- для IPv6 сохраняет старые API-поля `icmpv6_type` и `icmpv6_code`;
- `icmp_type`/`icmp_code` требуют `proto=icmp`;
- `icmpv6_type`/`icmpv6_code` требуют `proto=icmpv6`;
- wire/API формат не меняется: UI только группирует уже существующие поля.

Что не принимать:

- несколько типов в одном поле: `echo-request,echo-reply`;
- inline nft set: `{ echo-request, echo-reply }`;
- `Code` вне диапазона `0..255`;
- ICMP IPv4 поля вместе с `Protocol: tcp`/`udp`;
- ICMP IPv6 поля вместе с `Protocol: tcp`/`udp`.

UX заметки:

- `Type` должен быть основным полем, `Code` должен выглядеть как optional уточнение внутри того же блока;
- кнопка `+` у блока включает пару `type/code`, а не отдельное независимое поле;
- популярные варианты `Type` должны быть видны прямо в блоке как быстрые варианты с коротким смыслом, например `echo-request — ping request`;
- при выборе `Type` UI должен показывать `Code options for <type>` с `empty` и частыми code presets;
- при включении `ICMP IPv4` UI ставит `Type: echo-request` и `Protocol: icmp`;
- при включении `ICMP IPv6` UI ставит `Type: echo-request` и `Protocol: icmpv6`;
- следующий UX-слой: дополнить список менее частыми RFC-кодами, если они реально понадобятся в сценариях.

### Input interface / Output interface

Поля: `Input interface`, `Output interface`

Где находятся: `Add Firewall Rule -> Base match -> Interface match`

Что делают:

- `Input interface` ограничивает правило по интерфейсу, через который пакет вошел (`iifname`);
- `Output interface` ограничивает правило по интерфейсу, через который пакет выходит (`oifname`).

Когда заполнять:

- `Input interface` удобно использовать в `input`, `forward`, `prerouting`;
- `Output interface` удобно использовать в `output`, `forward`, `postrouting`;
- оба поля вместе имеют основной смысл в `forward`, когда сервер маршрутизирует транзитный трафик, например `eth0 -> eth1`.

Что должно принимать:

- одно имя интерфейса: `eth0`, `lo`, `awg1`;
- одну ссылку на iface collection: `@lan_ifaces`, `@wan_ifaces`.

Пример transit rule:

```text
Chain: forward
Input interface: eth0
Output interface: eth1
Action: accept
```

Результат по смыслу: разрешить транзитный трафик, который вошел через `eth0` и должен выйти через `eth1`.

Пример с collections:

```text
Chain: forward
Input interface: @lan_ifaces
Output interface: @wan_ifaces
Action: accept
```

Результат по смыслу: разрешить транзит из набора LAN-интерфейсов в набор WAN-интерфейсов.

Что делает backend:

- literal interface рендерится в кавычках: `iifname "eth0"` / `oifname "eth1"`;
- iface collection reference рендерится без кавычек: `iifname @lan_ifaces` / `oifname @wan_ifaces`;
- для `netdev` `Output interface` скрыт/запрещен, потому что netdev hook работает как ingress на конкретном устройстве;
- для `bridge` обычные `Input/Output interface` заменяются отдельными полями `Bridge input` / `Bridge output`.

Что не принимать:

- несколько интерфейсов в одном поле: `eth0,eth1`;
- inline nft set: `{ eth0, eth1 }`;
- collection reference с `/` или пробелами: `@bad/name`;
- `Output interface` для `netdev`.

UX заметки:

- если пользователь выбирает оба поля, UI должен подсказывать, что самый понятный chain для такого правила — `forward`;
- следующий UX-слой: проверять существование literal interface на машине и существование `@lan_ifaces`/`@wan_ifaces` в `collections -> iface`.

### Connection state

Поле: `Connection state`

Где находится: `Add Firewall Rule -> Base match -> Connection tracking match`

Что делает: ограничивает правило по состоянию conntrack (`ct state`).

Когда заполнять:

- для типового stateful firewall;
- чтобы разрешить уже установленные соединения: `established,related`;
- чтобы отдельно обработать новые соединения: `new`;
- чтобы дропать плохие/битые состояния: `invalid`;
- чтобы матчить пакеты, которые не отслеживаются conntrack: `untracked`.

Что должно принимать через UI:

- `established`;
- `related`;
- `established + related` вместе, что сохраняется как `established,related`;
- `new`;
- `invalid`;
- `untracked`.

Правила сочетаний:

- `established` и `related` можно выбирать вместе;
- `new`, `invalid`, `untracked` являются одиночными режимами;
- если выбран `new`, UI должен снять `established`, `related`, `invalid`, `untracked`;
- если выбран `invalid` или `untracked`, UI также должен оставить только этот режим.

Примеры:

```text
Chain: input
Connection state: established + related
Action: accept
```

Результат по смыслу: разрешить ответы и связанные соединения.

```text
Chain: input
Connection state: invalid
Action: drop
```

Результат по смыслу: отбросить пакеты с некорректным conntrack-состоянием.

Что делает backend:

- пробелы убираются, поэтому `established, related` нормализуется в `established,related`;
- разрешены только значения из schema: `established,related`, `new`, `invalid`, `related`, `established`, `untracked`;
- значение рендерится как nft expression: `ct state established,related`.

Что не принимать:

- произвольные комбинации: `established,new`;
- неизвестные состояния: `closed`, `syn`;
- inline nft expression.

UX заметки:

- для простого stateful набора обычно первым правилом делают `established,related accept`, затем правила для новых соединений;
- в `raw` таблице `Connection state` скрыт, потому что raw/notrack используется до обычного conntrack-сценария;
- в `nat` таблице поле сейчас скрыто в UI, чтобы не смешивать NAT actions и policy filtering в одной форме.

### Packet mark / Connection mark

Поля: `packet mark`, `connection mark`

API-поля: `mark_match`, `ct_mark_match`

Где находятся:

- `Add Firewall Rule -> Base match -> Connection tracking match`;
- `Add Firewall Rule -> Advanced match -> Meta match`.

Что делают:

- `packet mark` матчится по `meta mark`: это mark конкретного пакета;
- `connection mark` матчится по `ct mark`: это mark conntrack-записи, то есть состояние/метка всего соединения.

Зачем это нужно:

- связать firewall с policy routing (`ip rule fwmark ...`);
- разделять трафик по классам QoS/traffic shaping;
- строить многошаговую схему: в одном правиле поставить mark, в другом правило матчится по этому mark;
- переносить решение между пакетами одного соединения через `ct mark`.

Когда заполнять:

- только если в схеме уже есть правила, которые выставляют packet mark или connection mark;
- если внешний компонент/маршрутизация уже использует `fwmark`;
- если в `Action`/advanced части есть правила `meta mark set` или `ct mark set`.

Что должно принимать:

- decimal integer: `10`;
- hex integer: `0x1`, `0x10`, `0x20`.

Что делает backend/runtime:

- `packet mark: 0x10` рендерится как `meta mark 0x10`;
- `connection mark: 0x20` рендерится как `ct mark 0x20`;
- nft может показывать hex в каноническом 32-bit виде: `0x10` будет видно как `0x00000010`.

Примеры:

```text
packet mark: 0x10
Action: accept
```

Результат по смыслу: правило сработает только на пакеты, у которых уже установлен packet mark `0x10`.

```text
connection mark: 0x20
Action: accept
```

Результат по смыслу: правило сработает на пакеты соединения, у которого conntrack mark равен `0x20`.

Что не принимать:

- произвольные строки: `abc`;
- невалидный hex: `0xZZ`;
- выражения nft: `meta mark set 1`;
- несколько значений в одном поле.

UX заметки:

- без схемы marking пользователь обычно должен оставить поле пустым;
- `connection mark` / `packet mark` здесь только проверяют mark, но не устанавливают его;
- чтобы установить mark, используются action/runtime поля `meta mark set` и `ct mark set`.
- inactive hint в UI: `match existing mark`;
- helper для `packet mark`: `Matches existing packet mark. To set it, use Action -> meta mark set.`;
- helper для `connection mark`: `Matches existing connection mark. To set it, use Action -> ct mark set.`;
- placeholder остается `0x1 / 10`, потому значения пользовательские и могут быть hex или decimal.

### Conntrack direction

Поле: `ct direction`

API-поле: `ct_direction`

Где находится: `Add Firewall Rule -> Advanced match -> Conntrack match`

Что делает: добавляет match по направлению conntrack-потока через nft `ct direction ...`.

Допустимые значения:

- `original` — направление стороны, которая начала соединение;
- `reply` — обратное направление, то есть ответная сторона соединения.

Пример:

```text
client 10.0.0.10:50000 -> server 203.0.113.10:443
```

Для этого conntrack-соединения:

- `ct direction original` матчится на пакеты от клиента к серверу;
- `ct direction reply` матчится на пакеты от сервера к клиенту.

Когда использовать:

- когда нужно различать две стороны одного conntrack-соединения;
- в NAT/forward/debug сценариях;
- когда `Connection state` уже недостаточно и важно понять, инициатор это или ответная сторона.

Что делает backend/runtime:

- принимает только `original` или `reply`;
- нормализует регистр, например `REPLY` -> `reply`;
- рендерит nft expression как `ct direction original` или `ct direction reply`.

UX решение:

- поле должно быть single-select, как `meta pkttype`;
- варианты строго `original` и `reply`;
- default при включении: `original`;
- inactive hint: `original / reply`;
- helper: `original = direction that started the connection; reply = return traffic.`;
- свободный input не нужен, потому других валидных значений нет.

### Conntrack status

Поле: `ct status`

API-поле: `ct_status`

Где находится: `Add Firewall Rule -> Advanced match -> Conntrack match`

Что делает: добавляет match по status-флагам conntrack-записи через nft `ct status ...`.

Допустимые значения:

- `expected` — соединение ожидается conntrack helper-ом;
- `seen-reply` — conntrack уже видел ответную сторону;
- `assured` — соединение считается устойчивым/подтвержденным;
- `confirmed` — conntrack-запись подтверждена ядром;
- `snat` — к соединению применялся source NAT;
- `dnat` — к соединению применялся destination NAT;
- `dying` — conntrack-запись находится в процессе удаления.

Можно выбирать несколько значений:

```text
assured,snat
confirmed,dnat
seen-reply,assured
```

Когда использовать:

- для диагностики NAT/conntrack;
- когда нужно различать соединения, к которым уже применялся `snat` или `dnat`;
- когда обычного `Connection state` (`new`, `established`, `related`) недостаточно.

Что делает backend/runtime:

- принимает только фиксированный набор status-флагов;
- нормализует пробелы и регистр, например `assured, snat` -> `assured,snat`;
- рендерит nft expression как `ct status assured,snat`.

UX решение:

- в UI поле должно быть single-select, как `ct direction`;
- пользователь выбирает один status-флаг за раз;
- backend/API сохраняет совместимость и может принимать comma-separated status-флаги;
- default при включении: `dnat`;
- inactive hint: `expected / seen-reply / assured / snat`;
- helper: `Choose one conntrack status flag. Backend/API can still accept comma-separated flags.`;
- свободный input не нужен, потому значения фиксированы.

### Conntrack original/reply addresses

Поля:

- `original source address`
- `original destination address`
- `reply source address`
- `reply destination address`

API-поля:

- `ct_original_saddr`
- `ct_original_daddr`
- `ct_reply_saddr`
- `ct_reply_daddr`

Где находится: `Add Firewall Rule -> Advanced match -> Conntrack match`

Что делает: матчится по адресам, сохраненным в conntrack-записи, а не просто по текущим `ip saddr` / `ip daddr` пакета.

Пример соединения:

```text
client 192.168.1.10:50000 -> server 203.0.113.10:443
```

Для такого conntrack tuple:

- `original source address` — `192.168.1.10`, инициатор соединения;
- `original destination address` — `203.0.113.10`, куда соединение было начато;
- `reply source address` — `203.0.113.10`, источник обратного трафика;
- `reply destination address` — `192.168.1.10`, получатель обратного трафика.

Когда использовать:

- когда нужно матчить именно conntrack tuple, а не текущие адреса пакета;
- в NAT/debug сценариях, где текущие адреса пакета могут отличаться от original/reply tuple;
- когда нужно явно различать сторону инициатора и сторону ответа.

Что принимает:

- один IPv4-адрес: `192.168.1.10`;
- один IPv6-адрес: `2001:db8::10`.

Что не принимает:

- CIDR-префиксы: `192.168.1.0/24`;
- collections: `@trusted_hosts`;
- несколько адресов в одном поле;
- произвольные строки.

Что делает backend/runtime:

- проверяет, что значение — валидный IPv4/IPv6 address;
- сам выбирает nft family token `ip` или `ip6`;
- рендерит выражения вида `ct original ip saddr 192.168.1.10` или `ct reply ip6 daddr 2001:db8::10`.

UX решение:

- labels должны быть человекочитаемыми, не `ct original saddr`;
- inactive hints:
  - `initiator address`
  - `target address`
  - `return source`
  - `return destination`
- helper должен объяснять direction:
  - `Conntrack original direction: source that started the flow.`
  - `Conntrack original direction: destination the flow was started to.`
  - `Conntrack reply direction: source of return traffic.`
  - `Conntrack reply direction: destination of return traffic.`

### Set packet priority (QoS)

Поле: `Set packet priority (QoS)`

API-поле: `meta_priority`

Где находится: `Add Firewall Rule -> Advanced match -> Meta match`

Что делает: выставляет Linux packet priority (`meta priority set ...`) для пакета. Это QoS/traffic-control действие, а не match-условие.

Важно:

- это не порядок правила в firewall;
- это не “приоритет allow/drop”;
- это expert-поле для связки с Linux `tc`, QoS и traffic shaping;
- обычному пользователю почти всегда нужно оставить поле пустым.

Когда заполнять:

- если на хосте уже настроен `tc`/QoS и он использует skb priority/classid;
- если правило должно пометить пакет для дальнейшей обработки traffic-control;
- если администратор точно знает, какое priority/classid ожидает внешняя QoS-схема.

Что должно принимать:

- `1:10` — tc classid format `major:minor`;
- `0x10` — skb priority в hex;
- `10` — skb priority в decimal.

Примеры:

```text
Set packet priority (QoS): 1:10
```

Результат по смыслу: правило выставит packet priority/classid `1:10`, который дальше может использовать `tc`.

```text
Set packet priority (QoS): 0x10
```

Результат по смыслу: правило выставит skb priority в hex-формате.

Что делает backend/runtime:

- сохраняет значение в старом API-поле `meta_priority`;
- проверяет формат `1:10`, decimal или `0x...`;
- рендерит nft statement как `meta priority set <value>`.

Что не принимать:

- произвольные строки: `high`, `critical`;
- несколько значений;
- `bad:value:1`;
- попытку использовать это как порядок правила.

UX заметки:

- label должен говорить `set packet priority (QoS)`, а не просто `meta priority`;
- поле должно оставаться простым текстовым input, без карточек/presets;
- placeholder должен показывать поддерживаемые форматы: `1:10 / 0x10 / 10`;
- helper в UI: `Sets Linux packet priority for tc/QoS. This is not firewall rule order.`;
- в будущем это поле лучше вынести из “match”-мысленной группы в отдельную expert/QoS группу, если будем глубже чистить Advanced UI.

### Packet length

Поле: `packet length`

API-поле: `meta_length`

Где находится: `Add Firewall Rule -> Advanced match -> Meta match`

Что делает: добавляет match по размеру пакета в байтах через nft `meta length ...`.

Важно:

- это match-условие, а не изменение пакета;
- поле не ограничивает MTU и не меняет размер пакета;
- правило сработает только для пакетов, размер которых попадает в указанное значение/диапазон.

Что должно принимать:

- одно число байт: `64`;
- диапазон байт: `64-1500`.

Примеры:

```text
packet length: 64-1500
Action: accept
```

Результат по смыслу: правило сработает только на пакеты размером от `64` до `1500` байт.

Что делает backend/runtime:

- сохраняет значение в старом API-поле `meta_length`;
- рендерит nft expression как `meta length <value>`;
- для диапазона рендерит `meta length 64-1500`.

UX заметки:

- label должен быть `packet length`, а не `meta length`;
- inactive hint: `match packet size`;
- placeholder: `64-1500`;
- helper в UI: `Matches packet size in bytes. This does not change the packet.`;
- если пользователю нужно матчить “большие пакеты”, это поле можно раскрыть как expert match.

### Meta packet type

Поле: `Meta pkttype`

API-поле: `meta_pkttype`

Где находится: `Add Firewall Rule -> Advanced match -> Meta match`

Что делает: фильтрует пакет по L2 packet type, который ядро Linux видит для входящего/обрабатываемого пакета.

Допустимые значения:

- `host` — пакет адресован этому хосту;
- `broadcast` — широковещательный пакет;
- `multicast` — multicast-пакет;
- `other` — прочий packet type, если он есть в runtime-контексте.

UX решение:

- в UI это простой single-select;
- свободный ввод не нужен, потому что backend принимает только фиксированный набор значений;
- по умолчанию при включении выбирается `host`.

### Meta CPU

Поле: `Meta cpu`

API-поле: `meta_cpu`

Где находится: `Add Firewall Rule -> Advanced match -> Meta match`

Что делает: фильтрует пакет по номеру CPU, на котором пакет обрабатывается ядром Linux.

Важно:

- это не лимит CPU;
- это не выбор CPU для firewall-правила;
- это не нагрузка процессора;
- это expert/debug match для диагностики или специальных performance-сценариев.

Когда может понадобиться:

- отладка RSS/RPS/XPS, multi-queue NIC, IRQ affinity;
- проверка, на каких CPU реально обрабатывается трафик;
- очень специфичная traffic engineering/performance-настройка.

Что принимает:

- один номер CPU: `0`, `1`, `2`, ...

UX решение:

- поле остается простым input;
- hint должен быть `CPU id, expert/debug`;
- placeholder должен показывать примеры `0 / 1 / 2`;
- обычному пользователю почти всегда нужно оставить поле пустым.

### Meta interface type

Поля: `Meta iiftype`, `Meta oiftype`

API-поля: `meta_iiftype`, `meta_oiftype`

Где находится: `Add Firewall Rule -> Advanced match -> Meta match`

Что делает:

- `meta_iiftype` фильтрует по типу входного интерфейса;
- `meta_oiftype` фильтрует по типу выходного интерфейса;
- значение — Linux ARPHRD numeric ID.

Обычные варианты:

- `Ethernet` -> `1`
- `Loopback` -> `772`
- `PPP` -> `512`
- `Tunnel` -> `768`
- `IPv6 tunnel` -> `769`
- `None` -> `65534`

Важно:

- это не имя интерфейса (`eth0`, `lo`, `wg0`);
- для обычной настройки чаще нужно поле `Input interface` / `Output interface`;
- это expert-поле для случаев, когда правило должно матчить именно аппаратный/канальный тип интерфейса.

UX решение:

- поле должно работать как `Protocol`: input + dropdown популярных значений;
- в списке слева показывается имя типа, справа numeric ID;
- можно вручную ввести редкий ARPHRD ID, если его нет в списке.

### Meta interface group

Поля: `Input interface group`, `Output interface group`

API-поля: `meta_iifgroup`, `meta_oifgroup`

Где находится: `Add Firewall Rule -> Advanced match -> Meta match`

Что делает:

- `meta_iifgroup` фильтрует по Linux group входного интерфейса;
- `meta_oifgroup` фильтрует по Linux group выходного интерфейса;
- в nft это рендерится как `meta iifgroup <id>` / `meta oifgroup <id>`.

Важно:

- это Linux `devgroup`, а не firewall collection;
- это не `@lan_ifaces` и не список интерфейсов из нашего UI;
- группа задается в системе командой вида `ip link set dev eth0 group 10`;
- для обычных правил чаще нужно использовать `Input interface` / `Output interface` или collection интерфейсов;
- это expert-поле для машин, где интерфейсы реально разложены по Linux device groups.

Что принимает:

- один numeric id группы: `10`, `20`, `100`.

Пример системной настройки:

```bash
ip link set dev eth0 group 10
ip link show group 10
```

Пример nft-матча:

```text
meta iifgroup 10
meta oifgroup 20
```

UX решение:

- в UI показываем понятные подписи `input interface group` / `output interface group`;
- hint: `Linux dev group id`;
- внутри включенного поля показываем expert-пояснение: `Linux dev group id from ip link group. Usually leave empty.`;
- dropdown не нужен, потому что значения зависят от конкретной Linux-машины.

### Hour

Поле: `Hour`

Где находится: `Add Firewall Rule -> Base match -> Meta match`

Что делает: добавляет match по времени суток через nft `meta hour`.

Когда заполнять:

- если правило должно работать только в конкретное время суток;
- например “разрешить доступ к сервису только с 08:00 до 18:00”;
- для простых daily-window сценариев без календаря и без даты.

Что должно принимать:

- одну точку времени: `08:00`;
- диапазон времени: `08:00-18:00`;
- только 24-часовой формат `HH:MM`.

Что делает backend/runtime:

- проверяет формат `HH:MM` или `HH:MM-HH:MM`;
- рендерит диапазон как nft expression: `meta hour "08:00"-"18:00"`;
- не принимает даты, дни недели и duration-style значения.

Пример:

```text
Chain: input
Protocol: tcp
Destination port: 443
Hour: 08:00-18:00
Action: accept
```

Результат по смыслу: правило сработает для TCP/443 только в указанное время суток.

Что не принимать:

- `10m`, `1d 15:00:00` — это duration/timeout формат, не time-of-day;
- `8:00` — нужен ведущий ноль: `08:00`;
- `25:00`;
- `08:00-99:00`;
- произвольные строки.

UX заметки:

- это не таймер “включить правило на 10 минут”;
- это ежедневное окно времени;
- timezone/локальное время зависят от nft/kernel/runtime окружения хоста.

### DSCP

Поле: `DSCP`

Где находится: `Add Firewall Rule -> Base match -> Meta match`

Что делает: добавляет match по DSCP-классу IP-пакета.

Когда заполнять:

- если в сети уже используется QoS/DSCP marking;
- чтобы отдельно обрабатывать voice/video/priority traffic;
- чтобы матчить пакеты, которые уже имеют DSCP class или numeric DSCP value.

Что должно принимать:

- class selector: `cs0`..`cs7`;
- assured forwarding: `af11`..`af43`;
- expedited forwarding: `ef`;
- число `0..63`, например `46`.

Что делает backend/runtime:

- нормализует имена к lowercase, например `CS5` -> `cs5`;
- для `inet`/`ip`/bridge/netdev текущий renderer использует nft expression `ip dscp <value>`;
- для `ip6` table renderer использует `ip6 dscp <value>`.

Примеры:

```text
DSCP: cs5
```

```text
DSCP: 46
```

Что не принимать:

- числа больше `63`;
- неизвестные классы вроде `cs9`;
- произвольные строки;
- несколько значений в одном поле.

UX заметки:

- это match, а не установка DSCP;
- если пакет не промаркирован DSCP заранее, поле ничего не “добавит” к пакету;
- для `inet` table текущая простая форма создает IPv4 DSCP match (`ip dscp`). IPv6 DSCP match требует `ip6` table или отдельного будущего UX-решения для выбора L3 family внутри `inet`.

### User ID

Поле: `User ID`

Текущий UX-статус: скрыто из `Add Firewall Rule`.

Почему скрыто:

- это матч по локальному socket user id (`meta skuid`);
- поле полезно в узких host-firewall сценариях, но не нужно для нашего основного firewall UX;
- чтобы не перегружать форму, поле убрано из UI.

Совместимость:

- backend/API поле `user_id` остается поддержанным для wire/API compatibility;
- существующие API сценарии с `user_id` не ломаем;
- если когда-нибудь понадобится вернуть поле, это должно быть отдельное согласованное UX-решение.

### Rate limit

Поле: `Rate limit`

Где находится: `Add Firewall Rule -> Base match -> Meta match`

Что делает: добавляет anonymous nft limit expression к правилу.

Важно: это не время жизни и не timeout.

- В collections время означает “как долго живет элемент”: `10m`, `1d 15:00:00`.
- В `Rate limit` время означает “за какой период считать скорость”: `10/second`, `200/minute`.

Когда заполнять:

- чтобы ограничить частоту срабатывания правила;
- для простого throttling, например “не больше 10 пакетов в секунду”;
- для быстрых одноразовых правил без отдельного named limit object.

Что должно принимать:

- `10/second`;
- `200/minute`;
- `1000/hour`;
- `10000/day`.

Что делает backend/runtime:

- значение нормализуется к lowercase;
- рендерится как nft expression: `limit rate 10/second`;
- anonymous `Rate limit` и named `limit object` взаимоисключающие.

Пример:

```text
Chain: input
Protocol: tcp
Destination port: 22
Rate limit: 10/second
Action: accept
```

Результат по смыслу: правило будет принимать трафик на TCP/22 только в пределах `10/second`.

Что не принимать:

- timeout-style значения из collections: `10m`, `2h30m`, `1d 15:00:00`;
- значения без периода: `10`;
- произвольные строки;
- bytes-rate в этом поле. Для byte-rate нужен named limit object (`objects -> limit`) с rate вроде `1024 bytes/second`.

UX заметки:

- placeholder должен показывать rate syntax, а не duration syntax: `10/second or 200/minute`;
- для более сложных сценариев лучше создать named limit object и выбрать его в `Action`;
- если пользователь хочет “на 10 минут”, это не `Rate limit`; это ближе к timeout/dynamic set/collection scenario.



Давай немного скоректируем задание

# conf
Есть некий конфиг в нем
in = eth0
out1 = eth1
out2 = eth2
out1_src_mac = 02:00:00:00:00:01
out1_dst_mac = aa:bb:cc:dd:ee:ff
out2_src_mac = 03:00:00:00:00:01
out2_dst_mac = ff.ee.dd.cc.bb.aa

# Схема
  [ Branch Clients ]
                              │
                        (Internet/WAN)
                              │
                  ┌───────────▼───────────┐
                  │ L3 Load Balancer      │
                  │ VIP: 10.30.0.14       │
                  └─────┬───────────┬─────┘
       eth1 (Link HQ1)  │           │  eth2 (Link HQ2)
    02:00:00:00:00:01   │           │  03:00:00:00:00:01
                        │           │
   ┌────────────────────▼──┐     ┌──▼────────────────────┐
   │ HQ1 Headend           │     │ HQ2 Headend           │
   │ aa:bb:cc:dd:ee:ff     │     │ ff.ee.dd.cc.bb.aa     │
   │ eth1: 10.30.0.14      │     │ eth1: 10.30.0.14      │
   └───────────────────────┘     └───────────────────────┘

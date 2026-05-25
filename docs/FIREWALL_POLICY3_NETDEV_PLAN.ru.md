# Firewall Policy3 Netdev

## Статус
- `Policy` остаётся classic inet/ip/ip6 flow.
- `Policy2` остаётся bridge-only.
- `Policy3` добавлен как отдельный netdev ingress editor.

## Реализовано
- Backend принимает `family=netdev` в `/firewall/rules`.
- Netdev правила привязаны только к custom `netdev` таблицам с `chain_type=filter`, `hook=ingress`, `device`.
- Поддержаны действия `accept`, `drop`, `jump`, `goto`, `return`, `queue`, `fwd`.
- `action=fwd` требует `fwd_to` и `fwd_dev`; `fwd_family` должен совпадать с IP family адреса.
- Bridge-only поля (`ibrname`, `obrname`, named objects, `dup_*`) и nat/raw/route-only поля отклоняются для netdev.
- UI получил вкладку `policy3`, отдельный netdev rule editor и таблицу netdev rules.

## Runtime Profile
- В Policy3 показываются только поля, которые проходят строгую backend-валидацию для netdev ingress.
- Named objects из bridge Policy2 не копируются в Policy3: для netdev используется anonymous `counter`, `limit`, `log`, `queue`, `fwd`.
- Расширение runtime matrix допускается только после проверки nft на стенде.

## Проверки
- API/e2e: `webui/tests/firewall-policy-v3-netdev.spec.ts`.
- Минимальный gate: Python compile, webui build, Policy3 spec, `/firewall/apply`, reboot smoke на стенде.

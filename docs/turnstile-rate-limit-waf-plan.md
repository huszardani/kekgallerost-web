# Turnstile és Vercel WAF rate-limit terv

## Ellenőrzött jelenlegi állapot

- A Vercel Firewallban nincs egyedi szabály és nincs publikálatlan draft változás.
- A CLI támogatja az IP-kulcsú, `fixed_window` rate limitet 10–3600 másodperces ablakkal, ezért a kért 600 másodperces ablak pontosan megvalósítható.

## Később, külön jóváhagyással aktiválandó szabályok

Mindkét szabály `rate_limit` műveletet, `fixed_window` algoritmust, `ip` kulcsot, 5 kérést és 600 másodperces ablakot használ. A `rate_limit` túllépési művelet HTTP 429 választ ad.

1. **Nyilvános állásjelentkezés – IP rate limit**
   - feltételek: `method == POST` ÉS `path == /api/applications`
   - túllépés: `rate_limit`, 5 kérés / 600 másodperc / IP
2. **Céges érdeklődés – IP rate limit**
   - feltételek: `method == POST` ÉS `path == /api/company-leads`
   - túllépés: `rate_limit`, 5 kérés / 600 másodperc / IP

Példa a Vercel CLI-hez (csak a későbbi jóváhagyott aktiváláskor):

```text
vercel firewall rules add "Nyilvános állásjelentkezés – IP rate limit" --condition '{"type":"method","op":"eq","value":"POST"}' --condition '{"type":"path","op":"eq","value":"/api/applications"}' --action rate_limit --rate-limit-keys ip --rate-limit-algo fixed_window --rate-limit-requests 5 --rate-limit-window 600 --rate-limit-action rate_limit --yes
```

A második szabály ugyanilyen, a `path` értéke `/api/company-leads`. A szabályok draftként létrehozhatók; `vercel firewall publish` kizárólag külön Production jóváhagyással futtatható.

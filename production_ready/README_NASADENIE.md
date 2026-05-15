# Speleofotografia 2026 - Produkčné Nasadenie

Tento priečinok obsahuje stabilnú verziu aplikácie pripravenú na nahranie na FTP server.

## 📁 Štruktúra priečinkov
- `api/` - Backend (PHP 8.3+), obsahuje `index.php`, `ImageProcessor.php`, `config.php` a `font.ttf`.
- `data/` - Databáza (JSON/CSV súbory). **DÔLEŽITÉ:** Tento priečinok musí mať práva na zápis (chmod 777).
- `uploads/` - Nahrané fotografie. Musí mať práva na zápis (chmod 777).
- `index.html`, `assets/` - Frontend (React).

## 🚀 Postup nasadenia (FTP)

1. **Záloha:** Ak už máte na serveri staršiu verziu, odporúčame ju zálohovať.
2. **Nahranie:** Nahrajte celý obsah priečinka `production_ready/` do koreňového priečinka vášho webu (napr. `public_html`).
3. **Práva (Permissions):** Nastavte práva na zápis pre tieto priečinky (vrátane všetkých súborov v nich):
   - `data/` (pre `settings.json`, `registrations.csv`, `admins.json`, `ratings.csv`)
   - `uploads/`
   - `uploads/originals/`
4. **Font:** Uistite sa, že súbor `api/font.ttf` bol nahraný. Je nevyhnutný pre správne vykresľovanie vodoznaku.

## 🛠️ Riešenie problémov (Diagnostics)

Ak narazíte na problémy, navštívte:
`https://vasa-domena.sk/api/debug`

Tento endpoint vám ukáže:
- Či sú priečinky zapisovateľné.
- Či je GD knižnica a FreeType dostupný.
- Verziu PHP a stav dôležitých súborov.

## 🔐 Bezpečnosť
- Súbor `data/admins.json` obsahuje hashe hesiel. Nikdy ho nezdieľajte.
- Prístup k `/api/debug` by mal byť po overení vypnutý v `api/index.php` (zmenou premennej `$DEBUG_ENABLED = false;`).

---
Vytvorené pre Speleofotografia 2026.

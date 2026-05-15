# Speleofotografia 2026 - Produkčná Inštalácia

Tento adresár obsahuje čistú, produkčnú verziu systému Speleofotografia 2026. Systém pozostáva z React frontendu a PHP backendu.

## 📁 Štruktúra súborov
- `api/` - Backendová logika (PHP)
- `assets/` - Statické súbory frontendu (JS, CSS, Obrázky)
- `data/` - Úložisko pre dáta (CSV, JSON)
- `uploads/` - Nahraté fotografie
- `index.html` - Hlavný vstupný bod aplikácie
- `.htaccess` - Konfigurácia servera (Apache)

## 🚀 Inštalácia na WebSupport (alebo iný PHP hosting)

### 1. Nahranie súborov
Skopírujte **celý obsah** tohto adresára (`production_ready/*`) do koreňového priečinka vašej domény cez FTP (napr. do `public_html/` alebo `sub/speleof26/`).

### 2. Nastavenie prístupových práv (CHMOD)
Pre správne fungovanie zápisu fotografií a dát musíte nastaviť práva **777** (zápis pre všetkých) na tieto adresáre:
- `/data/`
- `/uploads/`
- `/uploads/originals/`

### 3. Prvotné nastavenie administrátora
V priečinku `data/` sa nachádza súbor `admins.json`. Ak chcete začať, odporúčame ho inicializovať s jedným superadminom. 
**Dôležité:** Kvôli bezpečnosti v tomto balíku nie sú prednastavené heslá.

Príklad obsahu `data/admins.json` (email: admin@sss.sk, heslo: adminblesk11):
```json
[
  {
    "email": "admin@sss.sk",
    "password_hash": "$2y$10$JfeOkrNPt9uWs.FntbPiHuDwIdk3zxHkSP2an4NIsgxlN7ktqH1mS",
    "role": "superadmin"
  }
]
```

### 4. Overenie inštalácie
Po nahratí a nastavení práv otvorte v prehliadači:
`https://vasadomena.sk/api/debug`

Tento nástroj vám vypíše diagnostiku servera a potvrdí, či má systém práva na zápis do všetkých potrebných priečinkov.

## 🛠️ Riešenie problémov
- **Chyba 404 pri navigácii**: Uistite sa, že súbor `.htaccess` bol nahratý správne. Zabezpečuje smerovanie (routing) pre React.
- **Fotky sa neukladajú**: Skontrolujte práva 777 na priečinok `uploads/` a `uploads/originals/`.
- **Nefunguje prihlásenie**: Skontrolujte, či súbor `data/admins.json` existuje a má správny formát.

---
© 2026 Speleofotografia

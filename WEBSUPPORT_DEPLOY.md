# Nasadenie Speleofotografia na WebSupport (Zdieľaný Hosting)

Tento dokument popisuje špecifickú konfiguráciu potrebnú pre beh Node.js aplikácie na hostingu WebSupport bez použitia natívneho Node.js selektora (pomocou PHP mostíka a UNIX socketov).

## 1. Architektúra riešenia

Keďže zdieľané hostingy často blokujú interné sieťové porty (ako 3000) pre PHP, aplikácia je nakonfigurovaná nasledovne:

1.  **Node.js Server**: Beží na pozadí pod správou **PM2**. Namiesto portu počúva na súbore `server.sock` (UNIX Socket).
2.  **Apache (Webserver)**: Smeruje požiadavky do priečinka `dist`.
3.  **PHP Bridge (`api.php`)**: Malý skript v `dist`, ktorý zachytáva požiadavky na `/api` a preposiela ich cez `server.sock` do Node.js.
4.  **.htaccess**: Zabezpečuje správne smerovanie požiadaviek medzi statickým frontendom a API mostíkom.

---

## 2. Príprava lokálne (Váš počítač)

Pred nahrávaním na server je potrebné vygenerovať produkčný balíček:

```bash
node scripts/prepare-ftp.js
```

Tento skript vytvorí priečinok `deploy/`, ktorý obsahuje:
- `server.mjs`: Zabalený backend.
- `dist/`: Frontend galérie.
- `dist/api.php`: Prepojovací mostík.
- `dist/.htaccess`: Pravidlá pre webserver.
- `package.json`: Definícia závislostí (najmä pre `sharp`).

---

## 3. Nastavenie v Admin Paneli (WebSupport)

Pre správne fungovanie musia byť v sekcii **Web -> Služby** nastavené tieto cesty:

- **Koreňový adresár (DocumentRoot)**: `/vasa-domena.sk/sub/speleof/dist`
- **Zdrojový adresár**: `/vasa-domena.sk/sub/speleof`

*Poznámka: Nastavením koreňového adresára do `dist` zabezpečíte, že návštevník neuvidí zdrojové kódy backendu, ale priamo galériu.*

---

## 4. Inštalácia na serveri (SSH)

Po nahraní súborov cez FTP je potrebné vykonať tieto príkazy v SSH (v priečinku aplikácie):

### A. Inštalácia modulov
```bash
npm install --production
```

### B. Prvé spustenie cez PM2
```bash
NODE_ENV=production npx pm2 start server.mjs --name "speleofoto"
npx pm2 save
```

### C. Užitočné príkazy pre monitoring
- `npx pm2 status`: Zobrazí, či aplikácia beží.
- `npx pm2 logs speleofoto`: Zobrazí reálne výpisy zo servera (aj chyby).
- `npx pm2 restart speleofoto`: Reštartuje aplikáciu (potrebné po každom nahraní nového kódu).

---

## 5. Riešenie problémov (Troubleshooting)

### "Bridge error: Connection refused"
- **Príčina**: Node.js server nebeží alebo sa nevytvoril súbor `server.sock`.
- **Riešenie**: Skontrolujte `npx pm2 status`. Ak beží, pozrite `ls -la`, či vidíte súbor `server.sock`.

### Fotky sa nenahrávajú (Chyba 500)
- **Príčina**: Problém s binárnou knižnicou `sharp` alebo prístupovými právami.
- **Riešenie**: Uistite sa, že ste na serveri spustili `npm install --production` priamo na danom stroji (Linux).

---

**Vytvorené dňa:** 13. 5. 2026
**Konfigurácia:** Speleofotografia Platform v1.2.0

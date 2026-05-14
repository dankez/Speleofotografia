# Speleofotografia / Speleophotography

Webová aplikácia pre správu medzinárodnej súťaže jaskyniarskej fotografie. 
A web application for managing an international caving photography competition.

---

## 🇸🇰 Slovenská verzia

### Hlavné funkcie
- **Registračný formulár**: Dvojjazyčné rozhranie (SK/EN) pre autorov na nahranie fotografií do dvoch kategórií (A a B).
- **Overovanie dát**: Automatická kontrola formátu e-mailu, Instagramu a povinných polí.
- **Limit fotografií**: Dynamicky nastaviteľný limit počtu fotiek na jednu kategóriu (predvolene 5).
- **Potvrdenie e-mailom**: Automatické odoslanie e-mailu autorovi po úspešnom prihlásení s použitím SMTP servera.
- **Hromadné nahranie**: Možnosť vybrať a nahrať viacero súborov naraz s náhľadmi a popismi.
- **Súhlasy (GDPR & Pravidlá)**: Povinné zaškrtávacie polia pre súhlas so spracovaním údajov a pravidlami súťaže s odkazom na detailné podmienky.

### Administrácia (Admin Dashboard)
- **Štatistiky**: Prehľad o počte prihlášok, unikátnych autorov a obsadenosti kategórií.
- **Galéria**: Prehliadanie nahraných fotografií s detailmi o autorovi.
- **Porota**: Generovanie unikátnych odkazov pre jednotlivých porotcov na hodnotenie.
- **Prepojenie (Embed)**: Generovanie IFrame kódov pre jednoduché a bezpečné vloženie galérie alebo prihlášky na externé webové stránky (napr. WordPress).
- **Nastavenia**: Správa textov (názov súťaže, ročník), limitov, konfigurácia SMTP servera a prispôsobenie vodoznakov (farba, veľkosť).
- **Podmienky súťaže**: Integrovaný editor s podporou Markdownu pre detailné pravidlá súťaže.
- **Dynamické pravidlá kategórií**: Možnosť nastaviť minimálnu/maximálnu dĺžku popisu príbehu a jeho povinnosť pre každú kategóriu zvlášť.

### Bezpečnosť, súkromie a anonymita
- **Plná anonymita poroty**: Porotcovia vidia fotografie bez mien autorov a pôvodných názvov súborov pre zabezpečenie objektívneho hodnotenia.
- **Jednoznačné hodnotenie**: Jeden unikátny odkaz porotcu umožňuje udeliť fotke práve jeden hlas; opätovné hlasovanie pôvodnú hodnotu prepíše (nepriemeruje sa).
- **Izolácia nastavení**: Citlivé údaje (ako SMTP heslo alebo administrátorské prihlasovacie údaje) sú na strane servera chránené. 
- **Anonymizované Photo Proxy**: Fotografie sú servované cez zabezpečené API, ktoré skrýva reálne cesty k súborom a zabraňuje priamemu hotlinkingu z cudzích webov.
- **Optimalizácia výkonu**: Implementované HTTP cachovanie (24h) pre fotografie a `loading="lazy"` pre galérie, čo zabezpečuje rýchlejšie načítavanie a šetrí dáta užívateľov.
- **Validácia**: Všetky vstupy od užívateľov sú sanitované pred uložením do systému.
- **IFrame Security**: Použitie moderných atribútov (`referrerpolicy`, `loading="lazy"`) pre bezpečnú integráciu.
- **Prístup**: Administrátorská časť je chránená e-mailom a heslom definovaným v systéme.

---

## 🇺🇸 English Version

### Core Features
- **Registration Form**: Bilingual interface (SK/EN) for authors to upload photos into two categories (A and B).
- **Data Validation**: Automatic validation of email format, Instagram handles, and required fields.
- **Photo Limits**: Dynamically configurable limit for the number of photos per category (defaults to 5).
- **Email Confirmation**: Automatic email sent to the author upon successful submission using an SMTP server.
- **Bulk Upload**: Support for selecting and uploading multiple files simultaneously with previews and descriptions.
- **Consents (GDPR & Rules)**: Mandatory checkboxes for data processing consent and competition rules with links to detailed conditions.

### Administration (Admin Dashboard)
- **Statistics**: Real-time overview of the number of submissions, unique authors, and category distributions.
- **Gallery**: Browse all uploaded photos with detailed information about the author and work.
- **Jury Management**: Generate unique evaluation links for individual judges.
- **Embed System**: Generate IFrame snippets for safe and easy integration of the gallery or registration form into external websites.
- **Settings**: Manage competition metadata (name, edition), limits, and SMTP server configuration.
- **Competition Rules**: Integrated Markdown editor for detailed rules displayed in a modal window.

### Security, Performance and Anonymity
- **Jury Anonymity**: Judges see photos without author names or original filenames to ensure objective evaluation.
- **Idempotent Voting**: Each unique judge link allows exactly one vote per photo; re-rating overwrites the previous value instead of averaging.
- **Secure Photo Proxy**: Photos are served via an API that hides real file paths and prevents hotlinking.
- **Performance Optimization**: 24-hour HTTP caching for images and native `loading="lazy"` for all galleries ensure fast load times and reduced bandwidth usage.
- **Settings Isolation**: Sensitive data (such as SMTP passwords or admin credentials) are protected server-side.
- **Validation**: All user inputs are sanitized before being saved to the system.
- **IFrame Security**: Modern security attributes used for embedded content.
- **Access Control**: Secure administration panel with email/password authentication.

---

## ⚖️ Férové verejné hlasovanie / Fair Public Voting
Aby bolo hlasovanie verejnosti čo najobjektívnejšie a najspravodlivejšie, odporúčame zvážiť nasledovné vylepšenia:
1. **Dvojstupňová verifikácia**: Vyžadovať overenie e-mailom alebo telefónnym číslom pred započítaním hlasu.
2. **Obmedzenie IP adries**: Blokovať hromadné hlasovanie z rovnakej siete (napr. firemné siete alebo botnety).
3. **Sociálne prihlásenie**: Povoliť hlasovanie len prihláseným užívateľom (Google, Facebook), čím sa eliminuje duplicita anonymných hlasov.
4. **Captcha**: Implementovať Google reCAPTCHA v3 na pozadí pre detekciu automatizovaných skriptov.
5. **Časové okno**: Povoliť hlasovanie len v určitom časovom období, ktoré je vopred oznámené.

### English
To ensure the public vote is as objective and fair as possible, consider these enhancements:
1. **Two-Step Verification**: Require email or SMS verification before accepting a vote.
2. **IP Rate Limiting**: Prevent bulk voting from a single network (e.g., VPNs or company networks).
3. **Social Login**: Allow voting only for authenticated users (Google/Facebook) to eliminate duplicate anonymous votes.
4. **Captcha**: Integrate Google reCAPTCHA v3 to detect bot activity invisibly.
5. **Limited Window**: Open voting for a specific, pre-announced time period to minimize manipulation windows.

---

## 🛠 Technické informácie / Technical Info
- **Backend**: Node.js + Express
- **Frontend**: React + Vite + Tailwind CSS
- **Storage**: CSV (Data) & Filesystem (Images)
- **Animation**: Motion (Framer Motion)
- **Icons**: Lucide React

---

## 🚀 Nasadenie na hosting (FTP) / Deployment

Tento projekt je pripravený na jednoduché nasadenie cez FTP, aj keď váš hosting nepodporuje spúšťanie príkazov (npm install).

### 1. Príprava balíčka (na vašom PC)
V koreňovom priečinku projektu spustite príkaz:
```bash
npm run build:ftp
```
Tento príkaz vytvorí priečinok **`deploy/`**, ktorý obsahuje všetko potrebné pre beh aplikácie.

### 2. Nahrávanie cez FTP
Pripojte sa na váš server a nahrajte **celý obsah** priečinka `deploy/` do koreňového adresára vášho webu.

Štruktúra na serveri by mala vyzerať takto:
```text
/ (root)
├── dist/             # Frontend
├── data/             # Databáza (admins.json)
├── uploads/          # Priečinok pre fotky
├── server.mjs        # Zbalený server (Node.js)
└── package.json      # Konfigurácia pre hosting
```

### 3. Dôležité: Natívne moduly (Sharp)
Keďže knižnica `sharp` (na spracovanie obrázkov) je natívny modul, nie je možné ju zbaliť do jedného súboru.
- Zo svojho PC skopírujte priečinok **`node_modules/sharp`** priamo na server do priečinka `node_modules/sharp`.
- Ak váš hosting používa Linux (čo je 99% prípadov) a vy tiež, bude to fungovať.

### 4. Nastavenie hostingu
- **Startup File**: Nastavte na `server.mjs`.
- **Node.js verzia**: Odporúčaná v20 alebo novšia.
- **Prístupové práva**: Zabezpečte, aby mal server právo **zapisovať** do priečinkov `data/` a `uploads/` (zvyčajne práva 755).

---

## 🛠 Technické informácie / Technical Info
(pokračovanie pôvodných info...)

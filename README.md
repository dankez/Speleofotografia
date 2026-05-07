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

### Administrácia (Admin Dashboard)
- **Štatistiky**: Prehľad o počte prihlášok, unikátnych autorov a obsadenosti kategórií.
- **Galéria**: Prehliadanie nahraných fotografií s detailmi o autorovi.
- **Porota**: Generovanie unikátnych odkazov pre jednotlivých porotcov na hodnotenie.
- **Nastavenia**: Správa textov (názov súťaže, pravidlá, ročník), limitov a konfigurácia SMTP servera pre e-maily.

### Bezpečnosť a súkromie
- **Izolácia nastavení**: Citlivé údaje (ako SMTP heslo alebo administrátorské prihlasovacie údaje) sú na strane servera chránené. Verejné rozhranie má prístup len k základným informáciám o súťaži.
- **Validácia**: Všetky vstupy od užívateľov sú sanitované pred uložením do systému.
- **Prístup**: Administrátorská časť je chránená e-mailom a heslom definovaným v systéme.

---

## 🇺🇸 English Version

### Core Features
- **Registration Form**: Bilingual interface (SK/EN) for authors to upload photos into two categories (A and B).
- **Data Validation**: Automatic validation of email format, Instagram handles, and required fields.
- **Photo Limits**: Dynamically configurable limit for the number of photos per category (defaults to 5).
- **Email Confirmation**: Automatic email sent to the author upon successful submission using an SMTP server.
- **Bulk Upload**: Support for selecting and uploading multiple files simultaneously with previews and descriptions.

### Administration (Admin Dashboard)
- **Statistics**: Real-time overview of the number of submissions, unique authors, and category distributions.
- **Gallery**: Browse all uploaded photos with detailed information about the author and work.
- **Jury Management**: Generate unique evaluation links for individual judges.
- **Settings**: Manage competition metadata (name, rules, edition), limits, and SMTP server configuration.

### Security and Privacy
- **Settings Isolation**: Sensitive data (such as SMTP passwords or admin credentials) are protected server-side. The public interface only accesses non-sensitive competition information.
- **Validation**: All user inputs are sanitized before being saved to the system.
- **Access Control**: The administration panel is secured with email and password authentication.

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

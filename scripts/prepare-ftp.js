import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(__dirname, '..');
const deployDir = path.join(root, 'deploy');

console.log('🚀 Preparing FTP deployment package...');

// 1. Clean and create deploy directory
if (fs.existsSync(deployDir)) {
    fs.rmSync(deployDir, { recursive: true, force: true });
}
fs.mkdirSync(deployDir);

// 2. Build Frontend
console.log('📦 Building frontend...');
execSync('npm run build', { cwd: root, stdio: 'inherit' });

// 3. No server bundling needed for PHP version


// 4. Copy Frontend Assets
console.log('📂 Copying frontend assets...');
const distDir = path.join(root, 'dist');
const deployDistDir = path.join(deployDir, 'dist');
fs.cpSync(distDir, deployDistDir, { recursive: true });

// 5. Copy PHP API
console.log('🐘 Copying PHP API...');
const apiDir = path.join(root, 'api');
fs.cpSync(apiDir, path.join(deployDistDir, 'api'), { recursive: true });

// 6. Copy data/ directory (admins.json, settings.json, ...)
console.log('📋 Copying data files...');
const dataDir = path.join(root, 'data');
const deployDataDir = path.join(deployDistDir, 'data');
if (fs.existsSync(dataDir)) {
    fs.cpSync(dataDir, deployDataDir, { recursive: true });
} else {
    fs.mkdirSync(deployDataDir, { recursive: true });
}

// 7. Create uploads directories (musia existovať a mať práva 777 na serveri)
const uploadsDir = path.join(deployDistDir, 'uploads');
const originalsDir = path.join(uploadsDir, 'originals');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(originalsDir)) fs.mkdirSync(originalsDir);

// Prázdny .gitkeep aby sa adresáre nahrali cez FTP
fs.writeFileSync(path.join(uploadsDir, '.gitkeep'), '');
fs.writeFileSync(path.join(originalsDir, '.gitkeep'), '');

// 7. Create .htaccess for PHP Routing
const htaccessContent = `RewriteEngine On
RewriteBase /

# 1. Forward all API requests to the PHP backend
RewriteRule ^api/(.*)$ api/index.php [L,QSA]

# 2. React Router: Serve index.html for all non-file/non-dir routes
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . index.html [L]
`;
fs.writeFileSync(path.join(deployDistDir, '.htaccess'), htaccessContent);

// 8. Create localized instructions
const instructionsContent = `NAVOD NA INSTALACIU SPELEOFOTOGRAFIA (PHP VERZIA)
================================================

KROK 1: FTP NAHRANIE
--------------------
1. Nahrajte OBSAH priecinka "deploy/dist" do vasej subdomeny /sss.sk/sub/speleof26.
   (teda VSETKY subory a priecinky: api/, assets/, data/, uploads/, .htaccess, index.html)

KROK 2: PRAVA NA PRIECINKY (cez FTP klienta alebo WebSupport panel)
--------------------------------------------------------------------
- uploads/           -> 777
- uploads/originals/ -> 777
- data/              -> 777

KROK 3: OVERENIE
----------------
1. Otvorte: https://speleof26.sss.sk/api/debug
   - Musi byt: VERZIA API: 3.1
   - Musi byt: GD KNIZNICA: DOSTUPNA
   - Musi byt: UPLOADS ZAPISATELNY: ANO

PRIHLASENIE DO ADMINA:
- Email: admin@sss.sk
- Heslo: adminblesk11

HOTOVO! Web nepotrebuje PM2 ani SSH.
`;
fs.writeFileSync(path.join(deployDir, 'INSTRUKCIE.txt'), instructionsContent);

console.log('\n✅ PHP Deployment package ready in "deploy" folder!');
console.log('-------------------------------------------');
console.log('Nahrajte OBSAH deploy/dist/ na FTP do speleof26/');
console.log('Nastavte prava 777 na: uploads/ uploads/originals/ data/');
console.log('Overte: https://speleof26.sss.sk/api/debug');
console.log('Admin login: admin@sss.sk / adminblesk11');
console.log('-------------------------------------------');

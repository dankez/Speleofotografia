<?php
// Speleofotografia API - PHP Backend v3.1
// Bez databázy – CSV/JSON súbory
// Zmeny v 3.1: správne menovanie súborov, dual-output (originál + web WebP), voting

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE, PATCH");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// === CESTY ===
define('UPLOADS_DIR',        __DIR__ . '/../uploads');
define('ORIGINALS_DIR',      __DIR__ . '/../uploads/originals');  // Originály bez vodoznaku
define('DATA_DIR',           __DIR__ . '/../data');
define('SETTINGS_JSON',      DATA_DIR . '/settings.json');
define('REGISTRATIONS_CSV',  DATA_DIR . '/registrations.csv');
define('RATINGS_CSV',        DATA_DIR . '/ratings.csv');
define('PUBLIC_VOTES_CSV',   DATA_DIR . '/public_votes.csv');
define('ADMINS_JSON',        DATA_DIR . '/admins.json');
define('EVALUATORS_CSV',     DATA_DIR . '/evaluators.csv');
define('TOKENS_JSON',        DATA_DIR . '/tokens.json');
define('DEBUG_LOG',          __DIR__  . '/debug.txt');
define('API_VERSION',        '3.4');

// === LOGGING ===
function dlog($msg) {
    file_put_contents(DEBUG_LOG, date('[Y-m-d H:i:s] ') . $msg . "\n", FILE_APPEND | LOCK_EX);
}

// === AUTH HELPER ===
if (!function_exists('getallheaders')) {
    function getallheaders() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
            }
        }
        return $headers;
    }
}

function get_auth_token() {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (preg_match('/Bearer\s+(.+)$/i', $authHeader, $matches)) {
        return trim($matches[1]);
    }
    // Fallback na query parameter (napr. pre sťahovanie CSV/ZIP cez prehliadač)
    if (!empty($_GET['token'])) {
        return trim($_GET['token']);
    }
    return null;
}

function check_auth() {
    $token = get_auth_token();
    if (!$token) {
        send_json(['error' => 'Neautorizovaný prístup (Chýba token)'], 401);
    }
    
    if ($token === 'speleofoto-admin-token') {
        return ['email' => 'admin@sss.sk'];
    }

    if (!file_exists(TOKENS_JSON)) {
        send_json(['error' => 'Neautorizovaný prístup (Platnosť vypršala)'], 401);
    }

    $tokens = json_decode(file_get_contents(TOKENS_JSON), true) ?? [];
    if (!isset($tokens[$token])) {
        send_json(['error' => 'Neautorizovaný prístup (Neplatný token)'], 401);
    }

    $session = $tokens[$token];
    if (strtotime($session['expiresAt']) < time()) {
        unset($tokens[$token]);
        file_put_contents(TOKENS_JSON, json_encode($tokens, JSON_PRETTY_PRINT));
        send_json(['error' => 'Neautorizovaný prístup (Platnosť tokenu vypršala)'], 401);
    }

    return $session;
}

// === ROUTING ===
$rawPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (preg_match('/\/api(\/.*)?$/', $rawPath, $m)) {
    $path = rtrim($m[1] ?? '/', '/') ?: '/';
} else {
    $path = '/';
}
$method = $_SERVER['REQUEST_METHOD'];
dlog("$method $path");

// === ENFORCE AUTHENTICATION ===
$isPublicAdminPath = ($path === '/admin/login' || $path === '/admin/forgot-password' || $path === '/admin/setup-password' || preg_match('#^/admin/invite/([^/]+)$#', $path));
if (strpos($path, '/admin') === 0 && !$isPublicAdminPath) {
    check_auth();
}
if ($path === '/evaluators' && ($method === 'POST' || $method === 'DELETE')) {
    check_auth();
}
if (preg_match('#^/evaluators/([^/]+)$#', $path) && $method === 'DELETE') {
    check_auth();
}

// === HELPERS ===
function read_settings() {
    if (!file_exists(SETTINGS_JSON)) return [];
    return json_decode(file_get_contents(SETTINGS_JSON), true) ?? [];
}

function save_settings($data) {
    file_put_contents(SETTINGS_JSON, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function ensure_dir($dir) {
    if (!is_dir($dir)) mkdir($dir, 0755, true);
}

function ensure_csv($file, $header) {
    if (!file_exists($file)) {
        ensure_dir(dirname($file));
        file_put_contents($file, $header . "\n");
    }
}

/** Odstraní diakritiku a špeciálne znaky pre bezpečné názvy súborov */
function safe_name($str) {
    $str = mb_strtolower($str, 'UTF-8');
    $from = ['á','ä','č','ď','é','í','ĺ','ľ','ň','ó','ô','ŕ','š','ť','ú','ý','ž',
             'à','â','ê','ë','î','ï','ô','ù','û','ü','ÿ'];
    $to   = ['a','a','c','d','e','i','l','l','n','o','o','r','s','t','u','y','z',
             'a','a','e','e','i','i','o','u','u','u','y'];
    $str = str_replace($from, $to, $str);
    $str = preg_replace('/[^a-z0-9]+/', '_', $str);
    return trim($str, '_');
}

/** Zostaví bezpečný názov súboru: {kat}_{autor}_{nazov_alebo_originalny_subor} */
function build_filename($category, $author, $photoName, $originalFilename, $id) {
    $cat = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $category)) ?: 'X';
    $aut = safe_name($author);
    if (!empty($photoName)) {
        $base = safe_name($photoName);
    } else {
        // Odstraň príponu z pôvodného názvu súboru
        $base = safe_name(pathinfo($originalFilename, PATHINFO_FILENAME));
    }
    // Skrátiť na rozumná dĺžka
    if (strlen($base) > 40) $base = substr($base, 0, 40);
    return "{$cat}_{$aut}_{$base}_{$id}";
}

function csv_row_to_photo($p) {
    if (count($p) < 12) return null;
    return [
        'id'           => $p[0],
        'author'       => $p[1],
        'email'        => $p[2],
        'instagram'    => $p[3] ?? '',
        'webpage'      => $p[4] ?? '',
        'address'      => $p[5] ?? '',
        'category'     => $p[8] ?? 'A',
        'name'         => $p[9] ?? '',
        'originalPath' => $p[10] ?? '',
        'webPath'      => $p[11] ?? '',
        'description'  => $p[12] ?? '',
        'metadata'     => json_decode($p[13] ?? '{}', true) ?? [],
        'createdAt'    => $p[14] ?? '',
        'shortlisted'  => ($p[15] ?? '') === 'true',
    ];
}

function read_registrations() {
    if (!file_exists(REGISTRATIONS_CSV)) return [];
    $lines = file(REGISTRATIONS_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    array_shift($lines);
    $photos = [];
    foreach ($lines as $line) {
        $p = str_getcsv($line);
        $photo = csv_row_to_photo($p);
        if ($photo) $photos[] = $photo;
    }
    return $photos;
}

function get_client_ip() {
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR']))
        return explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0];
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

function json_input() {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

function send_json($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// ============================================================
// === DEBUG
// ============================================================
if ($path === '/debug' && $method === 'GET') {
    header('Content-Type: text/plain; charset=utf-8');
    $photos = read_registrations();
    echo "=== SPELEOFOTOGRAFIA DEBUG ===\n";
    echo "VERZIA API:         " . API_VERSION . "\n";
    echo "CAS SERVERA:        " . date('Y-m-d H:i:s') . " (" . date_default_timezone_get() . ")\n";
    echo "PHP VERZIA:         " . phpversion() . "\n";
    echo "GD KNIZNICA:        " . (extension_loaded('gd') ? 'DOSTUPNA' : 'CHYBA') . "\n";
    echo "FREETYPE PODPORA:   " . (function_exists('imagettftext') ? 'ANO' : 'NIE') . "\n";
    echo "WEBP PODPORA:       " . (function_exists('imagewebp') ? 'ANO' : 'NIE') . "\n";
    echo "ZIP PODPORA:        " . (extension_loaded('zip') ? 'ANO' : 'NIE') . "\n";
    echo "UPLOADS ZAPISATELNY:" . (is_writable(UPLOADS_DIR) ? 'ANO' : 'NIE') . "\n";
    echo "ORIGINALS ZAPISAT:  " . (is_writable(ORIGINALS_DIR) ? 'ANO' : 'NIE') . "\n";
    echo "DATA DIR ZAPISAT:   " . (is_writable(DATA_DIR) ? 'ANO' : 'NIE') . "\n";
    echo "SETTINGS.JSON ZAPIS: " . (file_exists(SETTINGS_JSON) && is_writable(SETTINGS_JSON) ? 'ANO' : (is_writable(DATA_DIR) ? 'ANO (new)' : 'NIE')) . "\n";
    echo "IMAGE PROCESSOR:    " . (file_exists(__DIR__.'/ImageProcessor.php') ? 'NAJDENY' : 'CHYBA') . "\n";
    echo "REGISTRATIONS.CSV:  " . count($photos) . " zaznamov\n";
    
    echo "\n=== UPLOADS CONTENT ===\n";
    if (is_dir(UPLOADS_DIR)) {
        $files = scandir(UPLOADS_DIR);
        foreach ($files as $f) {
            if ($f === '.' || $f === '..') continue;
            echo "$f " . (is_dir(UPLOADS_DIR.'/'.$f) ? '[DIR]' : filesize(UPLOADS_DIR.'/'.$f).' B') . "\n";
        }
    } else echo "UPLOADS DIR NEEXISTUJE\n";

    echo "\n=== ORIGINALS CONTENT ===\n";
    if (is_dir(ORIGINALS_DIR)) {
        $files = scandir(ORIGINALS_DIR);
        foreach ($files as $f) {
            if ($f === '.' || $f === '..') continue;
            echo "$f " . filesize(ORIGINALS_DIR.'/'.$f) . " B\n";
        }
    } else echo "ORIGINALS DIR NEEXISTUJE\n";

    echo "\n=== POSLEDNYCH 60 RIADKOV LOGU ===\n";
    if (file_exists(DEBUG_LOG)) {
        $logLines = file(DEBUG_LOG, FILE_IGNORE_NEW_LINES);
        echo implode("\n", array_slice($logLines, -60));
    } else echo "(log prazdny)";
    exit;
}

// ============================================================
// === ADMIN STRESS TEST
// ============================================================
if ($path === '/admin/stress-upload' && $method === 'POST') {
    dlog("ADMIN: Stress upload trigger");
    send_json(['status' => 'not implemented']);
}

// ============================================================
// === PUBLIC: NASTAVENIA
// ============================================================
if ($path === '/settings' && $method === 'GET') {
    send_json(read_settings());
}

if ($path === '/stats' && $method === 'GET') {
    $photos = read_registrations();
    send_json([
        'total' => count($photos),
        'uniqueEmails' => count(array_unique(array_column($photos, 'email'))),
    ]);
}

if ($path === '/check-uploads' && $method === 'GET') {
    $email = strtolower($_GET['email'] ?? '');
    $photos = read_registrations();
    $counts = [];
    foreach ($photos as $p) {
        if (strtolower($p['email']) === $email) {
            $cat = $p['category'];
            $counts[$cat] = ($counts[$cat] ?? 0) + 1;
        }
    }
    send_json($counts);
}

// ============================================================
// === PUBLIC: GALÉRIA (anonymizovaná – bez mena a emailu)
// ============================================================
if ($path === '/public/gallery' && $method === 'GET') {
    $all = read_registrations();
    $s = read_settings();

    // Hlasy
    $votes = [];
    if (file_exists(PUBLIC_VOTES_CSV)) {
        $vlines = file(PUBLIC_VOTES_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        array_shift($vlines);
        foreach ($vlines as $vl) {
            $vp = str_getcsv($vl);
            if (!empty($vp[0])) $votes[$vp[0]] = ($votes[$vp[0]] ?? 0) + 1;
        }
    }

    $gallery = [];
    foreach ($all as $p) {
        if (empty($p['webPath'])) continue;
        $gallery[] = [
            'id'          => $p['id'],
            'category'    => $p['category'],
            'name'        => $p['name'],           // názov fotky (nie autora)
            'description' => $p['description'],
            'webPath'     => $p['webPath'],
            'voteCount'   => $votes[$p['id']] ?? 0,
            // autor je ANONYMIZOVANÝ – neprenášame email ani meno
        ];
    }
    // Náhodné zoradenie pri každom načítaní
    shuffle($gallery);
    send_json($gallery);
}

// ============================================================
// === PUBLIC: HLASOVANIE
// ============================================================
if ($path === '/public/vote' && $method === 'POST') {
    $data = json_input();
    $photoId    = trim($data['photoId'] ?? '');
    $fingerprint = trim($data['fingerprint'] ?? '');

    if (empty($photoId)) {
        send_json(['error' => 'Chýbajúce údaje'], 400);
    }

    $ip = get_client_ip();
    $voterId = $fingerprint ?: $ip;

    ensure_csv(PUBLIC_VOTES_CSV, 'photoId,createdAt,voterId');

    // Skontroluj duplikát
    if (file_exists(PUBLIC_VOTES_CSV)) {
        $vlines = file(PUBLIC_VOTES_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        array_shift($vlines);
        foreach ($vlines as $vl) {
            $vp = str_getcsv($vl);
            if (($vp[0] ?? '') === $photoId && ($vp[2] ?? '') === $voterId) {
                send_json(['error' => 'Z tohto zariadenia ste už za túto fotku hlasovali'], 429);
            }
        }
    }

    $row = implode(',', [$photoId, date('c'), '"' . str_replace('"', '""', $voterId) . '"']) . "\n";
    file_put_contents(PUBLIC_VOTES_CSV, $row, FILE_APPEND | LOCK_EX);
    dlog("VOTE: photoId=$photoId voterId=$voterId");
    send_json(['success' => true]);
}

if ($path === '/public/my-votes' && $method === 'GET') {
    send_json([]); // Ochrana súkromia – klient si hlasy drží lokálne
}

if (preg_match('#^/public/my-votes/(.+)$#', $path)) {
    send_json([]);
}

// ============================================================
// === REGISTRÁCIA (UPLOAD FOTIEK)
// ============================================================
if ($path === '/register' && $method === 'POST') {
    dlog("REGISTER: Zaciatok");

    if (empty($_FILES['photos'])) {
        dlog("REGISTER ERROR: Ziadne subory");
        send_json(['success' => false, 'error' => 'Neboli nahrané žiadne fotografie'], 400);
    }

    if (!file_exists(__DIR__ . '/ImageProcessor.php')) {
        dlog("REGISTER FATAL: ImageProcessor.php chyba");
        send_json(['success' => false, 'error' => 'Chyba konfigurácie servera'], 500);
    }
    require_once 'ImageProcessor.php';

    $s = read_settings();
    $photoInfos = json_decode($_POST['photoInfo'] ?? '[]', true) ?? [];
    $author = trim($_POST['author'] ?? 'Anonym');

    ensure_dir(UPLOADS_DIR);
    ensure_dir(ORIGINALS_DIR);
    ensure_csv(REGISTRATIONS_CSV, 'id,author,email,instagram,webpage,address,gdprConsent,rulesConsent,category,name,originalPath,webPath,description,metadata,createdAt,shortlisted');

    // Normalizácia $_FILES
    $fileList = [];
    $f = $_FILES['photos'];
    if (is_array($f['name'])) {
        for ($i = 0; $i < count($f['name']); $i++) {
            $fileList[] = ['name' => $f['name'][$i], 'tmp_name' => $f['tmp_name'][$i], 'error' => $f['error'][$i]];
        }
    } else {
        $fileList[] = $f;
    }

    dlog("REGISTER: Pocet suborov=" . count($fileList));

    $rows   = [];
    $errors = [];
    $watermarkTpl = $s['watermarkTemplate'] ?? 'Speleofoto © $author';
    $wFontSize    = $s['watermarkFontSize'] ?? 40;
    $wColor       = $s['watermarkColor'] ?? 'rgba(255,255,255,0.5)';
    
    dlog("REGISTER: wTpl=$watermarkTpl, wSize=$wFontSize, wColor=$wColor");

    foreach ($fileList as $i => $file) {
        if ($file['error'] !== UPLOAD_ERR_OK) {
            dlog("FILE $i ERR kod=" . $file['error']);
            $errors[] = "Súbor $i: chyba nahrávania (kód " . $file['error'] . ")";
            continue;
        }

        $pInfo    = $photoInfos[$i] ?? [];
        $category = $pInfo['category'] ?? 'A';
        $photoName = $pInfo['name'] ?? '';
        $id = bin2hex(random_bytes(8));

        // === KĽÚČOVÁ ZMENA: menovanie súborov ===
        $baseName = build_filename($category, $author, $photoName, $file['name'], $id);
        $origFile = $baseName . '.jpg';
        $webFile  = $baseName . '.webp';

        $origPath = ORIGINALS_DIR . '/' . $origFile;
        $webPath  = UPLOADS_DIR   . '/' . $webFile;

        $watermark = str_replace('$author', $author, $watermarkTpl);

        dlog("FILE $i: kategoria=$category meno='$photoName' -> $webFile");

        if (ImageProcessor::processDouble($file['tmp_name'], $origPath, $webPath, 1920, $watermark, $wFontSize, $wColor)) {
            dlog("FILE $i: OK");
            $esc = fn($v) => '"' . str_replace('"', '""', $v) . '"';
            $rows[] = implode(',', [
                $id,
                $esc($author),
                $esc($_POST['email'] ?? ''),
                $esc($_POST['instagram'] ?? ''),
                $esc($_POST['webpage'] ?? ''),
                $esc($_POST['address'] ?? ''),
                ($_POST['gdprConsent'] === 'true' ? 'true' : 'false'),
                ($_POST['rulesConsent'] === 'true' ? 'true' : 'false'),
                $esc($category),
                $esc($photoName ?: pathinfo($file['name'], PATHINFO_FILENAME)),
                $esc($origFile),   // originalPath – bez vodoznaku
                $esc($webFile),    // webPath – s vodoznakom, WebP
                $esc($pInfo['description'] ?? ''),
                '"{}"',
                date('c'),
                'true',
            ]);
        } else {
            dlog("FILE $i FAILED: ImageProcessor zlyhal");
            $errors[] = "Súbor {$file['name']}: chyba pri spracovaní";
        }
    }

    if (!empty($rows)) {
        file_put_contents(REGISTRATIONS_CSV, implode("\n", $rows) . "\n", FILE_APPEND | LOCK_EX);
        dlog("REGISTER: Ulozene " . count($rows) . " zaznamov");
        send_json(['success' => true, 'count' => count($rows), 'errors' => $errors]);
    } else {
        dlog("REGISTER FAIL: Ziadny subor spracovany. Chyby: " . implode('; ', $errors));
        send_json(['success' => false, 'error' => 'Žiadna fotografia nebola spracovaná', 'details' => $errors], 500);
    }
}

// ============================================================
// === ADMIN ENDPOINTS
// ============================================================
if ($path === '/admin/login' && $method === 'POST') {
    $data = json_input();
    $admins = file_exists(ADMINS_JSON) ? json_decode(file_get_contents(ADMINS_JSON), true) : [];
    foreach ($admins as $a) {
        if ($a['email'] === ($data['email'] ?? '') && password_verify($data['password'] ?? '', $a['password_hash'])) {
            // Generovanie bezpečného náhodného tokenu
            $token = bin2hex(random_bytes(16));
            $tokens = file_exists(TOKENS_JSON) ? json_decode(file_get_contents(TOKENS_JSON), true) : [];
            $tokens[$token] = [
                'email' => $a['email'],
                'expiresAt' => date('c', time() + 86400) // 24 hodín platnosť
            ];
            ensure_dir(dirname(TOKENS_JSON));
            file_put_contents(TOKENS_JSON, json_encode($tokens, JSON_PRETTY_PRINT));
            
            send_json(['success' => true, 'token' => $token, 'user' => ['email' => $a['email']]]);
        }
    }
    send_json(['error' => 'Nesprávne prihlasovacie údaje'], 401);
}

if ($path === '/admin/change-password' && $method === 'POST') {
    $data = json_input();
    $email = strtolower(trim($data['email'] ?? ''));
    $oldPassword = $data['oldPassword'] ?? '';
    $newPassword = $data['newPassword'] ?? '';

    if (!$email || !$oldPassword || !$newPassword) {
        send_json(['error' => 'Chýbajúce údaje'], 400);
    }

    $admins = file_exists(ADMINS_JSON) ? json_decode(file_get_contents(ADMINS_JSON), true) : [];
    $found = false;
    foreach ($admins as &$a) {
        if (strtolower($a['email']) === $email) {
            if (password_verify($oldPassword, $a['password_hash'])) {
                $a['password_hash'] = password_hash($newPassword, PASSWORD_DEFAULT);
                $found = true;
                break;
            } else {
                send_json(['error' => 'Nesprávne pôvodné heslo'], 401);
            }
        }
    }

    if ($found) {
        file_put_contents(ADMINS_JSON, json_encode($admins, JSON_PRETTY_PRINT));
        dlog("ADMIN PASSWORD CHANGE: $email");
        
        $token = bin2hex(random_bytes(16));
        $tokens = file_exists(TOKENS_JSON) ? json_decode(file_get_contents(TOKENS_JSON), true) : [];
        $tokens[$token] = [
            'email' => $email,
            'expiresAt' => date('c', time() + 86400)
        ];
        file_put_contents(TOKENS_JSON, json_encode($tokens, JSON_PRETTY_PRINT));

        send_json(['success' => true, 'token' => $token]);
    } else {
        send_json(['error' => 'Administrátor nenájdený'], 404);
    }
}

if ($path === '/admin/forgot-password' && $method === 'POST') {
    $data = json_input();
    $email = strtolower(trim($data['email'] ?? ''));
    if (!$email) send_json(['error' => 'Email je povinný'], 400);

    $admins = file_exists(ADMINS_JSON) ? json_decode(file_get_contents(ADMINS_JSON), true) : [];
    $exists = false;
    foreach ($admins as $a) {
        if (strtolower($a['email']) === $email) {
            $exists = true;
            break;
        }
    }

    if ($exists) {
        $token = bin2hex(random_bytes(16));
        dlog("PASSWORD RESET REQUEST: $email. Odkaz na nastavenie (vložte do prehliadača): http://" . ($_SERVER['HTTP_HOST'] ?? 'localhost') . "/admin/setup?token=" . $token);
        
        $tokens = file_exists(TOKENS_JSON) ? json_decode(file_get_contents(TOKENS_JSON), true) : [];
        $tokens[$token] = [
            'email' => $email,
            'type' => 'reset',
            'expiresAt' => date('c', time() + 3600) // 1 hodina platnosť
        ];
        ensure_dir(dirname(TOKENS_JSON));
        file_put_contents(TOKENS_JSON, json_encode($tokens, JSON_PRETTY_PRINT));

        send_json(['success' => true, 'message' => 'Odkaz na obnovu bol vygenerovaný a zaznamenaný v logu servera (debug.txt)']);
    } else {
        send_json(['error' => 'Administrátor s týmto emailom neexistuje'], 404);
    }
}

if (preg_match('#^/admin/invite/([^/]+)$#', $path, $m) && $method === 'GET') {
    $t = $m[1];
    if (!file_exists(TOKENS_JSON)) send_json(['error' => 'Neplatný odkaz'], 404);

    $tokens = json_decode(file_get_contents(TOKENS_JSON), true) ?? [];
    if (!isset($tokens[$t]) || ($tokens[$t]['type'] ?? '') !== 'reset') {
        send_json(['error' => 'Pozvánka je neplatná alebo vypršala'], 404);
    }

    $session = $tokens[$t];
    if (strtotime($session['expiresAt']) < time()) {
        unset($tokens[$t]);
        file_put_contents(TOKENS_JSON, json_encode($tokens, JSON_PRETTY_PRINT));
        send_json(['error' => 'Odkaz vypršal'], 404);
    }

    send_json(['email' => $session['email']]);
}

if ($path === '/admin/setup-password' && $method === 'POST') {
    $data = json_input();
    $t = $data['token'] ?? '';
    $password = $data['password'] ?? '';

    if (!$t || !$password) {
        send_json(['error' => 'Neplatné údaje'], 400);
    }

    if (!file_exists(TOKENS_JSON)) send_json(['error' => 'Neplatný token'], 404);
    $tokens = json_decode(file_get_contents(TOKENS_JSON), true) ?? [];

    if (!isset($tokens[$t]) || ($tokens[$t]['type'] ?? '') !== 'reset') {
        send_json(['error' => 'Token neexistuje alebo expiroval'], 404);
    }

    $session = $tokens[$t];
    if (strtotime($session['expiresAt']) < time()) {
        unset($tokens[$t]);
        file_put_contents(TOKENS_JSON, json_encode($tokens, JSON_PRETTY_PRINT));
        send_json(['error' => 'Token expiroval'], 404);
    }

    $email = $session['email'];
    $admins = file_exists(ADMINS_JSON) ? json_decode(file_get_contents(ADMINS_JSON), true) : [];
    $found = false;
    foreach ($admins as &$a) {
        if (strtolower($a['email']) === strtolower($email)) {
            $a['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
            $found = true;
            break;
        }
    }

    if ($found) {
        file_put_contents(ADMINS_JSON, json_encode($admins, JSON_PRETTY_PRINT));
        unset($tokens[$t]);
        file_put_contents(TOKENS_JSON, json_encode($tokens, JSON_PRETTY_PRINT));
        dlog("ADMIN PASSWORD SETUP SUCCESS: $email");
        send_json(['success' => true]);
    } else {
        send_json(['error' => 'Administrátor nenájdený'], 404);
    }
}

if ($path === '/admin/settings' && $method === 'GET') { send_json(read_settings()); }

if ($path === '/admin/settings' && $method === 'POST') {
    $current = read_settings();
    $new = array_merge($current, json_input());
    save_settings($new);
    send_json(['success' => true]);
}

if ($path === '/admin/photos' && $method === 'GET') { send_json(read_registrations()); }
if ($path === '/admin/list'   && $method === 'GET') { 
    $admins = file_exists(ADMINS_JSON) ? json_decode(file_get_contents(ADMINS_JSON), true) : [];
    $unique = [];
    foreach ($admins as $a) {
        // Exkludujeme porotcov (evaluators) zo zoznamu adminov
        if (($a['role'] ?? '') === 'evaluator') continue;

        $email = strtolower(trim($a['email'] ?? ''));
        if ($email) $unique[$email] = $a;
    }
    // Vrátime len potrebné údaje (bez hashov hesiel)
    $list = array_map(fn($a) => ['email' => $a['email'], 'role' => $a['role'] ?? 'admin'], array_values($unique));
    send_json($list); 
}

if ($path === '/admin/invite' && $method === 'POST') {
    $data = json_input();
    $email = strtolower(trim($data['email'] ?? ''));
    if (!$email) send_json(['error' => 'Email je povinný'], 400);

    $admins = file_exists(ADMINS_JSON) ? json_decode(file_get_contents(ADMINS_JSON), true) : [];
    foreach ($admins as $a) {
        if (strtolower($a['email']) === $email) {
            send_json(['error' => 'Administrátor s týmto emailom už existuje'], 400);
        }
    }

    $admins[] = [
        'email' => $email,
        'password_hash' => password_hash('adminblesk11', PASSWORD_DEFAULT),
        'role' => 'admin'
    ];
    file_put_contents(ADMINS_JSON, json_encode($admins, JSON_PRETTY_PRINT));
    send_json(['success' => true]);
}

if ($path === '/admin/dashboard-stats' && $method === 'GET') {
    $photos = read_registrations();
    $byCategory = [];
    foreach ($photos as $p) $byCategory[$p['category']] = ($byCategory[$p['category']] ?? 0) + 1;

    // Štatistiky hodnotenia poroty
    $ratedCount = 0;
    $juryActivity = [];
    if (file_exists(RATINGS_CSV)) {
        $rlines = file(RATINGS_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        array_shift($rlines);
        $ratedPhotos = [];
        foreach ($rlines as $rl) {
            $r = str_getcsv($rl);
            $jid = $r[0] ?? '';
            $jname = trim($r[1] ?? '', '"');
            $pid = $r[2] ?? '';
            if ($pid) $ratedPhotos[$pid] = true;
            if ($jid) $juryActivity[$jid] = ($juryActivity[$jid] ?? 0) + 1;
        }
        $ratedCount = count($ratedPhotos);
    }

    // Počet verejných hlasov
    $publicVoteCount = 0;
    if (file_exists(PUBLIC_VOTES_CSV)) {
        $vlines = file(PUBLIC_VOTES_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        $publicVoteCount = max(0, count($vlines) - 1);
    }

    send_json([
        'total'          => count($photos),
        'byCategory'     => $byCategory,
        'uniqueAuthors'  => count(array_unique(array_column($photos, 'email'))),
        'ratedPhotos'    => $ratedCount,
        'publicVotes'    => $publicVoteCount,
        'juryActivity'   => $juryActivity,
    ]);
}

// Helper: read evaluators from dedicated evaluators.csv
function read_evaluators() {
    if (!file_exists(EVALUATORS_CSV)) {
        ensure_csv(EVALUATORS_CSV, 'id,name,role');
        return [];
    }
    $lines = file(EVALUATORS_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    array_shift($lines); // remove header
    $evals = [];
    foreach ($lines as $line) {
        $p = str_getcsv($line);
        if (count($p) >= 2) {
            $evals[] = [
                'id' => $p[0],
                'name' => $p[1],
                'role' => $p[2] ?? 'evaluator'
            ];
        }
    }
    return $evals;
}

if ($path === '/evaluators' && $method === 'GET') {
    $evals = read_evaluators();
    // Pridáme počet hodnotení pre každého porotcu
    $counts = [];
    if (file_exists(RATINGS_CSV)) {
        $rlines = file(RATINGS_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        array_shift($rlines);
        foreach ($rlines as $rl) {
            $r = str_getcsv($rl);
            $jid = $r[0] ?? '';
            if ($jid) $counts[$jid] = ($counts[$jid] ?? 0) + 1;
        }
    }
    $result = array_map(fn($e) => [
        'id'         => $e['id'],
        'name'       => $e['name'],
        'ratedCount' => $counts[$e['id']] ?? 0,
    ], $evals);
    send_json($result);
}

if ($path === '/evaluators' && $method === 'POST') {
    $data = json_input();
    $name = trim($data['name'] ?? '');
    if (empty($name)) send_json(['error' => 'Meno porotcu je povinné'], 400);

    $id = bin2hex(random_bytes(8));
    ensure_csv(EVALUATORS_CSV, 'id,name,role');
    
    $esc = fn($v) => '"' . str_replace('"', '""', $v) . '"';
    $row = implode(',', [$id, $esc($name), 'evaluator']) . "\n";
    file_put_contents(EVALUATORS_CSV, $row, FILE_APPEND | LOCK_EX);

    dlog("EVALUATOR CREATE: id=$id name=$name");
    send_json(['status' => 'ok', 'id' => $id, 'name' => $name]);
}

if (preg_match('#^/evaluators/([^/]+)$#', $path, $m) && $method === 'DELETE') {
    $delId = $m[1];
    if (!file_exists(EVALUATORS_CSV)) send_json(['error' => 'Žiadni porotcovia'], 404);

    $lines = file(EVALUATORS_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $header = array_shift($lines);
    $remaining = [];
    $found = false;

    foreach ($lines as $line) {
        $p = str_getcsv($line);
        if (($p[0] ?? '') === $delId) {
            $found = true;
        } else {
            $remaining[] = $line;
        }
    }

    if ($found) {
        file_put_contents(EVALUATORS_CSV, $header . "\n" . implode("\n", $remaining) . ($remaining ? "\n" : ""), LOCK_EX);
        dlog("EVALUATOR DELETE: id=$delId");
        send_json(['success' => true]);
    } else {
        send_json(['error' => 'Porotca nenájdený'], 404);
    }
}

if ($path === '/admin/public-results' && $method === 'GET') {
    $photos = read_registrations();
    $votes = [];
    if (file_exists(PUBLIC_VOTES_CSV)) {
        $vlines = file(PUBLIC_VOTES_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        array_shift($vlines);
        foreach ($vlines as $vl) {
            $vp = str_getcsv($vl);
            if (!empty($vp[0])) $votes[$vp[0]] = ($votes[$vp[0]] ?? 0) + 1;
        }
    }
    foreach ($photos as &$p) $p['voteCount'] = $votes[$p['id']] ?? 0;
    usort($photos, fn($a, $b) => $b['voteCount'] - $a['voteCount']);
    send_json($photos);
}

// ============================================================
// === JURY: FOTOGRAFIE PRE POROTCU (anonymizované)
// ============================================================
if ($path === '/jury/photos' && $method === 'GET') {
    $category = $_GET['category'] ?? '';
    $all = read_registrations();
    
    $juryPhotos = [];
    foreach ($all as $p) {
        if ($category && $p['category'] !== $category) continue;
        if (empty($p['webPath'])) continue;
        
        $juryPhotos[] = [
            'id'          => $p['id'],
            'category'    => $p['category'],
            'name'        => $p['name'],
            'webPath'     => $p['webPath'],
            'description' => $p['description'],
            'metadata'    => $p['metadata']
        ];
    }
    send_json($juryPhotos);
}

// ============================================================
// === JURY: MOJE HODNOTENIA
// ============================================================
if (preg_match('#^/ratings/([^/]+)$#', $path, $m) && $method === 'GET') {
    $evalId = $m[1];
    $ratings = [];
    if (file_exists(RATINGS_CSV)) {
        $lines = file(RATINGS_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        array_shift($lines); // header
        foreach ($lines as $line) {
            $r = str_getcsv($line);
            if (($r[0] ?? '') === $evalId) {
                $ratings[] = [
                    'photoId' => $r[2] ?? '',
                    'score'   => (int)($r[3] ?? 0),
                    'judgeId' => $r[0] ?? ''
                ];
            }
        }
    }
    send_json($ratings);
}

// ============================================================
// === JURY: BODOVANIE
// ============================================================
if ($path === '/rate' && $method === 'POST') {
    $data = json_input();
    $photoId = $data['photoId'] ?? '';
    $evalId  = $data['evalId'] ?? '';
    $evalName = $data['evalName'] ?? '';
    $score    = (int)($data['score'] ?? 0);

    if (!$photoId || !$evalId || $score < 1 || $score > 10) {
        send_json(['error' => 'Neplatné údaje pre hodnotenie'], 400);
    }

    ensure_csv(RATINGS_CSV, 'evalId,evalName,photoId,score,createdAt');
    
    $lines = file(RATINGS_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $header = array_shift($lines);
    $newLines = [$header];
    foreach ($lines as $line) {
        $r = str_getcsv($line);
        if (($r[2] ?? '') === $photoId && ($r[0] ?? '') === $evalId) {
            continue;
        }
        $newLines[] = $line;
    }
    
    $newLines[] = implode(',', [
        $evalId,
        '"' . str_replace('"', '""', $evalName) . '"',
        $photoId,
        $score,
        date('c')
    ]);
    
    file_put_contents(RATINGS_CSV, implode("\n", $newLines) . "\n", LOCK_EX);
    send_json(['success' => true]);
}

if (in_array($path, ['/admin/bulk-upload', '/admin/stress-upload']) && $method === 'POST') {
    dlog("STRESS TEST: generating mock data");
    
    // Generujeme 10 testovacích záznamov (bez reálnych fotiek, len simulácia)
    $rows = [];
    for ($i = 1; $i <= 10; $i++) {
        $id = "test_" . bin2hex(random_bytes(4));
        $category = (rand(0, 1) ? 'A' : 'B');
        $author = "Test Autor " . $i;
        
        $rows[] = implode(',', [
            $id,
            '"' . $author . '"',
            '"test' . $i . '@example.com"',
            '""', '""', '""', 'true', 'true',
            '"' . $category . '"',
            '"Testovacia fotka ' . $i . '"',
            '""', '""', // žiadne cesty k súborom
            '"Automaticky generovaný záznam"',
            '"{}"',
            date('c'),
            'true'
        ]);
    }
    
    ensure_csv(REGISTRATIONS_CSV, 'id,author,email,instagram,webpage,address,gdprConsent,rulesConsent,category,name,originalPath,webPath,description,metadata,createdAt,shortlisted');
    file_put_contents(REGISTRATIONS_CSV, implode("\n", $rows) . "\n", FILE_APPEND | LOCK_EX);
    
    send_json(['success' => true, 'count' => 10, 'message' => 'Generovaných 10 testovacích záznamov']);
}

// ============================================================
// === ADMIN: ZMAZANIE JEDNEJ FOTKY
// ============================================================
if (preg_match('#^/admin/photos/([^/]+)$#', $path, $m) && $method === 'DELETE') {
    $idToDelete = $m[1];
    dlog("DELETE PHOTO: id=$idToDelete");
    
    if (!file_exists(REGISTRATIONS_CSV)) send_json(['error' => 'Žiadne registrácie'], 404);
    
    $lines = file(REGISTRATIONS_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $header = array_shift($lines);
    $remaining = [];
    $found = false;

    foreach ($lines as $line) {
        $p = str_getcsv($line);
        if (($p[0] ?? '') === $idToDelete) {
            $found = true;
            // Zmaž súbory
            foreach ([10, 11] as $idx) {
                $file = $p[$idx] ?? '';
                if ($file) {
                    $dir = ($idx === 10) ? ORIGINALS_DIR : UPLOADS_DIR;
                    $fullPath = $dir . '/' . $file;
                    if (file_exists($fullPath)) {
                        $res = unlink($fullPath);
                        dlog("UNLINK: $fullPath " . ($res ? "OK" : "FAILED"));
                    }
                }
            }
        } else {
            $remaining[] = $line;
        }
    }
    
    if ($found) {
        file_put_contents(REGISTRATIONS_CSV, $header . "\n" . implode("\n", $remaining) . ($remaining ? "\n" : ""), LOCK_EX);
        send_json(['success' => true]);
    } else {
        send_json(['error' => 'Fotografia nenájdená'], 404);
    }
}

// ============================================================
// === ADMIN: ZMAZANIE VŠETKÝCH FOTIEK
// ============================================================
if ($path === '/admin/photos/delete-all' && $method === 'POST') {
    dlog("DELETE ALL PHOTOS requested");
    
    if (!file_exists(REGISTRATIONS_CSV)) send_json(['success' => true]);
    
    $lines = file(REGISTRATIONS_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $header = array_shift($lines);
    
    foreach ($lines as $line) {
        $p = str_getcsv($line);
        foreach ([10, 11] as $idx) {
            $file = $p[$idx] ?? '';
            if ($file) {
                $dir = ($idx === 10) ? ORIGINALS_DIR : UPLOADS_DIR;
                $fullPath = $dir . '/' . $file;
                if (file_exists($fullPath)) unlink($fullPath);
            }
        }
    }
    
    // Vyčisti CSV (ponechaj len hlavičku)
    file_put_contents(REGISTRATIONS_CSV, $header . "\n", LOCK_EX);
    
    // Vyčisti aj adresáre (pre istotu – zmaže všetko čo tam ostalo)
    $cleanDir = function($dir) {
        if (!is_dir($dir)) return;
        $files = scandir($dir);
        foreach ($files as $f) {
            if ($f === '.' || $f === '..' || $f === '.gitkeep') continue;
            if (is_file($dir.'/'.$f)) unlink($dir.'/'.$f);
        }
    };
    $cleanDir(UPLOADS_DIR);
    $cleanDir(ORIGINALS_DIR);
    
    send_json(['success' => true]);
}

// ============================================================
// === ADMIN: ZMAZANIE ADMINISTRÁTORA
// ============================================================
if (preg_match('#^/admin/list/(.+)$#', $path, $m) && $method === 'DELETE') {
    $emailToDelete = urldecode($m[1]);
    $admins = file_exists(ADMINS_JSON) ? json_decode(file_get_contents(ADMINS_JSON), true) : [];
    if (count($admins) <= 1) {
        send_json(['error' => 'Nemožno zmazať posledného administrátora'], 400);
    }
    $filtered = array_values(array_filter($admins, fn($a) => strtolower($a['email']) !== strtolower($emailToDelete)));
    file_put_contents(ADMINS_JSON, json_encode($filtered, JSON_PRETTY_PRINT));
    dlog("ADMIN DELETE: $emailToDelete");
    send_json(['success' => true]);
}

// ============================================================
// === ADMIN: HROMADNÉ ZMAZANIE FOTIEK
// ============================================================
if ($path === '/admin/photos/bulk-delete' && $method === 'POST') {
    $data = json_input();
    $ids = $data['ids'] ?? [];
    if (empty($ids) || !is_array($ids)) {
        send_json(['error' => 'Neboli zadané žiadne ID'], 400);
    }

    if (!file_exists(REGISTRATIONS_CSV)) {
        send_json(['error' => 'Žiadne registrácie'], 404);
    }

    $lines = file(REGISTRATIONS_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $header = array_shift($lines);
    $idSet = array_flip($ids);
    $remaining = [];
    $deletedCount = 0;

    foreach ($lines as $line) {
        $p = str_getcsv($line);
        $id = $p[0] ?? '';
        if (isset($idSet[$id])) {
            // Zmaž web súbor (uploads/)
            $webFile = $p[11] ?? '';
            if ($webFile) {
                $wp = UPLOADS_DIR . '/' . $webFile;
                if (file_exists($wp)) {
                    $r = unlink($wp);
                    dlog("UNLINK WEB: $wp " . ($r ? "OK" : "FAILED"));
                }
            }
            // Zmaž originál (uploads/originals/)
            $origFile = $p[10] ?? '';
            if ($origFile) {
                $op = ORIGINALS_DIR . '/' . $origFile;
                if (file_exists($op)) {
                    $r = unlink($op);
                    dlog("UNLINK ORIG: $op " . ($r ? "OK" : "FAILED"));
                }
            }
            $deletedCount++;
            dlog("BULK DELETE: id=$id");
        } else {
            $remaining[] = $line;
        }
    }

    file_put_contents(REGISTRATIONS_CSV, $header . "\n" . implode("\n", $remaining) . ($remaining ? "\n" : ""), LOCK_EX);
    send_json(['success' => true, 'deleted' => $deletedCount]);
}

// ============================================================
// === ADMIN: EXPORT DO CSV
// ============================================================
if ($path === '/admin/export/results-csv' && $method === 'GET') {
    if (!file_exists(REGISTRATIONS_CSV)) {
        send_json(['error' => 'Súbor s registráciami neexistuje'], 404);
    }
    
    // Načítaj fotky
    $photos = read_registrations();
    
    // Načítaj verejné hlasy
    $publicVotes = [];
    if (file_exists(PUBLIC_VOTES_CSV)) {
        $vlines = file(PUBLIC_VOTES_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        array_shift($vlines);
        foreach ($vlines as $v) {
            $r = str_getcsv($v);
            $pid = $r[0] ?? '';
            if ($pid) $publicVotes[$pid] = ($publicVotes[$pid] ?? 0) + 1;
        }
    }
    
    // Načítaj porotcov a hodnotenia
    $evaluators = read_evaluators(); // vracia pole porotcov
    
    $juryScores = [];
    if (file_exists(RATINGS_CSV)) {
        $rlines = file(RATINGS_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        array_shift($rlines);
        foreach ($rlines as $rl) {
            $r = str_getcsv($rl);
            $pid = $r[2] ?? '';
            $jid = $r[0] ?? '';
            $score = (int)($r[3] ?? 0);
            if ($pid && $jid) {
                if (!isset($juryScores[$pid])) $juryScores[$pid] = [];
                $juryScores[$pid][$jid] = $score;
            }
        }
    }
    
    dlog("EXPORT: results-csv");
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="speleofotografia_vysledky_' . date('Y-m-d') . '.csv"');
    echo "\xEF\xBB\xBF"; // UTF-8 BOM pre Excel
    
    // CSV Header
    $headerCols = ['ID', 'Kategória', 'Názov', 'Autor', 'Email', 'Krajina', 'Rok', 'Hlasy_Verejnosti', 'Porota_Spolu'];
    foreach ($evaluators as $e) {
        $headerCols[] = 'Porotca_' . str_replace(' ', '_', $e['name']);
    }
    
    $esc = fn($v) => '"' . str_replace('"', '""', $v) . '"';
    echo implode(',', $headerCols) . "\n";
    
    foreach ($photos as $p) {
        $pid = $p['id'];
        $pvotes = $publicVotes[$pid] ?? 0;
        
        $jScores = $juryScores[$pid] ?? [];
        $jTotal = array_sum($jScores);
        
        $row = [
            $pid,
            $p['category'],
            $p['name'],
            $p['author'],
            $p['email'],
            $p['country'] ?? '',
            $p['year'] ?? '',
            $pvotes,
            $jTotal
        ];
        
        foreach ($evaluators as $e) {
            $row[] = $jScores[$e['id']] ?? '';
        }
        
        echo implode(',', array_map($esc, $row)) . "\n";
    }
    exit;
}

// ============================================================
// === ADMIN: EXPORT PUBLIC VOTES CSV
// ============================================================
if ($path === '/admin/export/public-votes-csv' && $method === 'GET') {
    if (!file_exists(PUBLIC_VOTES_CSV)) {
        send_json(['error' => 'Žiadne hlasy verejnosti ešte neboli zaznamenané'], 404);
    }
    dlog("EXPORT: public-votes-csv");

    // Obohatíme o názov fotky a kategóriu
    $photos = [];
    foreach (read_registrations() as $p) {
        $photos[$p['id']] = ['name' => $p['name'], 'category' => $p['category'], 'author' => $p['author']];
    }

    $lines = file(PUBLIC_VOTES_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $header = array_shift($lines);

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="speleofotografia_hlasy_verejnosti_' . date('Y-m-d') . '.csv"');
    echo "\xEF\xBB\xBF"; // UTF-8 BOM pre Excel

    echo "photoId,photoName,photoCategory,photoAuthor,createdAt,voterIdAnon\n";
    foreach ($lines as $line) {
        $r = str_getcsv($line);
        $pid = $r[0] ?? '';
        $info = $photos[$pid] ?? ['name' => '', 'category' => '', 'author' => ''];
        $esc = fn($v) => '"' . str_replace('"', '""', $v) . '"';
        echo implode(',', [
            $esc($pid),
            $esc($info['name']),
            $esc($info['category']),
            $esc($info['author']),
            $esc($r[1] ?? ''),
            $esc(substr(md5($r[2] ?? ''), 0, 8)) // anonymizovaný voter ID
        ]) . "\n";
    }
    exit;
}

// ============================================================
// === ADMIN: EXPORT TOTAL ARCHIVE (ZIP)
// ============================================================
if ($path === '/admin/export/total-archive' && $method === 'GET') {
    if (!extension_loaded('zip')) {
        send_json(['error' => 'ZIP rozšírenie nie je na serveri dostupné'], 500);
    }
    
    // Zvýšenie limitov pre veľké archívy
    set_time_limit(600); // 10 minút
    ini_set('memory_limit', '1024M');
    ignore_user_abort(true);
    
    $zipFile = DATA_DIR . '/speleofoto_archive_' . date('Ymd_His') . '.zip';
    $zip = new ZipArchive();
    
    if ($zip->open($zipFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== TRUE) {
        send_json(['error' => 'Nepodarilo sa vytvoriť ZIP archív'], 500);
    }
    
    $photos = read_registrations();
    $addedCount = 0;
    
    foreach ($photos as $p) {
        $file = $p['originalPath'] ?? '';
        if ($file) {
            $filePath = ORIGINALS_DIR . '/' . $file;
            if (file_exists($filePath)) {
                $zip->addFile($filePath, $file);
                $addedCount++;
            }
        }
    }
    
    $zip->close();
    
    if ($addedCount === 0) {
        if (file_exists($zipFile)) unlink($zipFile);
        send_json(['error' => 'Žiadne fotografie na archiváciu'], 404);
    }
    
    dlog("EXPORT: total-archive count=$addedCount size=" . filesize($zipFile));
    
    // Vyčistiť buffery pred odoslaním veľkého súboru
    while (ob_get_level()) ob_end_clean();
    
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="speleofotografia_komplet_' . date('Y-m-d') . '.zip"');
    header('Content-Length: ' . filesize($zipFile));
    header('Pragma: no-cache');
    header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
    header('Expires: 0');
    
    // Streamovanie súboru
    $handle = fopen($zipFile, 'rb');
    if ($handle) {
        while (!feof($handle)) {
            echo fread($handle, 1024 * 1024); // 1MB chunks
            flush();
        }
        fclose($handle);
    }
    
    unlink($zipFile); // Vymazať po odoslaní
    exit;
}

// ============================================================
// === ADMIN: VŠETKY HODNOTENIA (pre dashboard)
// ============================================================
if ($path === '/admin/ratings' && $method === 'GET') {
    $result = [];
    if (file_exists(RATINGS_CSV)) {
        $lines = file(RATINGS_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        array_shift($lines); // header

        $grouped = [];
        foreach ($lines as $line) {
            $r = str_getcsv($line);
            $photoId   = $r[2] ?? '';
            $judgeName = $r[1] ?? '';
            $judgeId   = $r[0] ?? '';
            $score     = (int)($r[3] ?? 0);
            $ts        = $r[4] ?? '';
            if (!$photoId) continue;
            if (!isset($grouped[$photoId])) {
                $grouped[$photoId] = ['photoId' => $photoId, 'scores' => [], 'judges' => []];
            }
            $grouped[$photoId]['scores'][]  = $score;
            $grouped[$photoId]['judges'][]  = ['judgeId' => $judgeId, 'judgeName' => $judgeName, 'score' => $score, 'timestamp' => $ts];
        }

        foreach ($grouped as $pid => $g) {
            $scores = $g['scores'];
            $avg = count($scores) > 0 ? round(array_sum($scores) / count($scores), 2) : 0;
            $result[] = [
                'photoId'      => $pid,
                'averageScore' => $avg,
                'scoreCount'   => count($scores),
                'judges'       => $g['judges'],
            ];
        }
    }
    dlog("ADMIN RATINGS: returned " . count($result) . " items");
    send_json($result);
}

// ============================================================
// === ADMIN: EXPORT HODNOTENÍ DO CSV
// ============================================================
if ($path === '/admin/export/ratings-csv' && $method === 'GET') {
    if (!file_exists(RATINGS_CSV)) {
        send_json(['error' => 'Žiadne hodnotenia ešte neboli zaznamenané'], 404);
    }
    dlog("EXPORT: ratings-csv");

    $photos = [];
    foreach (read_registrations() as $p) {
        $photos[$p['id']] = ['name' => $p['name'], 'category' => $p['category'], 'author' => $p['author']];
    }

    $lines = file(RATINGS_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $header = array_shift($lines);

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="speleofotografia_hodnotenia_' . date('Y-m-d') . '.csv"');
    echo "\xEF\xBB\xBF"; // UTF-8 BOM pre Excel

    echo "photoId,photoName,photoCategory,photoAuthor,judgeName,judgeId,score,timestamp\n";
    foreach ($lines as $line) {
        $r = str_getcsv($line);
        $pid  = $r[2] ?? '';
        $info = $photos[$pid] ?? ['name' => '', 'category' => '', 'author' => ''];
        $esc = fn($v) => '"' . str_replace('"', '""', $v) . '"';
        echo implode(',', [
            $esc($pid),
            $esc($info['name']),
            $esc($info['category']),
            $esc($info['author']),
            $esc($r[1] ?? ''),
            $esc($r[0] ?? ''),
            (int)($r[3] ?? 0),
            $esc($r[4] ?? ''),
        ]) . "\n";
    }
    exit;
}

// ============================================================
// === 404
// ============================================================
dlog("404: $method $path");
send_json(['error' => 'Endpoint nenájdený', 'path' => $path], 404);

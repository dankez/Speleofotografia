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
define('EVALUATORS_JSON',    DATA_DIR . '/evaluators.json');
define('DEBUG_LOG',          __DIR__  . '/debug.txt');
define('API_VERSION',        '3.4');

// === LOGGING ===
function dlog($msg) {
    file_put_contents(DEBUG_LOG, date('[Y-m-d H:i:s] ') . $msg . "\n", FILE_APPEND | LOCK_EX);
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
    if (!file_exists($file) || filesize($file) === 0) {
        ensure_dir(dirname($file));
        file_put_contents($file, $header . "\n");
    }
}

/** Robustné čítanie CSV so zámkom */
function read_csv_locked($file) {
    if (!file_exists($file)) return [];
    $fp = fopen($file, 'r');
    if (!$fp) return [];
    flock($fp, LOCK_SH);
    $rows = [];
    while (($row = fgetcsv($fp)) !== false) {
        $rows[] = $row;
    }
    flock($fp, LOCK_UN);
    fclose($fp);
    return $rows;
}

/** Robustný zápis CSV so zámkom */
function write_csv_locked($file, $rows) {
    ensure_dir(dirname($file));
    $fp = fopen($file, 'w');
    if (!$fp) return false;
    flock($fp, LOCK_EX);
    foreach ($rows as $row) {
        fputcsv($fp, $row);
    }
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return true;
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
    $rows = read_csv_locked(REGISTRATIONS_CSV);
    if (empty($rows)) return [];
    array_shift($rows); // header
    $photos = [];
    foreach ($rows as $r) {
        $photo = csv_row_to_photo($r);
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
    $votes = [];
    $vrows = read_csv_locked(PUBLIC_VOTES_CSV);
    if (!empty($vrows)) {
        array_shift($vrows);
        foreach ($vrows as $v) {
            if (!empty($v[0])) $votes[$v[0]] = ($votes[$v[0]] ?? 0) + 1;
        }
    }
    
    $ranked = [];
    foreach ($photos as $p) {
        $ranked[] = [
            'id' => $p['id'],
            'name' => $p['name'],
            'webPath' => $p['webPath'],
            'voteCount' => $votes[$p['id']] ?? 0
        ];
    }
    usort($ranked, fn($a, $b) => $b['voteCount'] - $a['voteCount']);
    
    send_json([
        'total' => count($photos),
        'uniqueEmails' => count(array_unique(array_column($photos, 'email'))),
        'top3' => array_slice($ranked, 0, 3)
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

    // Skontroluj duplikát v uzamknutom režime
    $rows = read_csv_locked(PUBLIC_VOTES_CSV);
    $header = array_shift($rows);
    foreach ($rows as $r) {
        if (($r[0] ?? '') === $photoId && ($r[2] ?? '') === $voterId) {
            send_json(['error' => 'Z tohto zariadenia ste už za túto fotku hlasovali'], 429);
        }
    }

    $rows[] = [$photoId, date('c'), $voterId];
    array_unshift($rows, $header);
    write_csv_locked(PUBLIC_VOTES_CSV, $rows);

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

        $baseName = build_filename($category, $author, $photoName, $file['name'], $id);
        $origFile = $baseName . '.jpg';
        $webFile  = $baseName . '.webp';

        $origPath = ORIGINALS_DIR . '/' . $origFile;
        $webPath  = UPLOADS_DIR   . '/' . $webFile;

        $watermark = str_replace('$author', $author, $watermarkTpl);

        if (ImageProcessor::processDouble($file['tmp_name'], $origPath, $webPath, 1920, $watermark, $wFontSize, $wColor)) {
            $rows[] = [
                $id,
                $author,
                $_POST['email'] ?? '',
                $_POST['instagram'] ?? '',
                $_POST['webpage'] ?? '',
                $_POST['address'] ?? '',
                ($_POST['gdprConsent'] === 'true' ? 'true' : 'false'),
                ($_POST['rulesConsent'] === 'true' ? 'true' : 'false'),
                $category,
                ($photoName ?: pathinfo($file['name'], PATHINFO_FILENAME)),
                $origFile,
                $webFile,
                ($pInfo['description'] ?? ''),
                '{}',
                date('c'),
                'true'
            ];
        } else {
            $errors[] = "Súbor {$file['name']}: chyba pri spracovaní";
        }
    }

    if (!empty($rows)) {
        $existing = read_csv_locked(REGISTRATIONS_CSV);
        $all = array_merge($existing, $rows);
        write_csv_locked(REGISTRATIONS_CSV, $all);
        send_json(['success' => true, 'count' => count($rows), 'errors' => $errors]);
    } else {
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
            send_json(['success' => true, 'token' => 'speleofoto-admin-token', 'user' => ['email' => $a['email']]]);
        }
    }
    send_json(['error' => 'Nesprávne prihlasovacie údaje'], 401);
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
    $rrows = read_csv_locked(RATINGS_CSV);
    if (!empty($rrows)) {
        array_shift($rrows);
        $ratedPhotos = [];
        foreach ($rrows as $r) {
            $pid = $r[0] ?? '';
            $jid = $r[2] ?? '';
            if ($pid) $ratedPhotos[$pid] = true;
            if ($jid) $juryActivity[$jid] = ($juryActivity[$jid] ?? 0) + 1;
        }
        $ratedCount = count($ratedPhotos);
    }

    // Počet verejných hlasov
    $publicVoteCount = 0;
    $vrows = read_csv_locked(PUBLIC_VOTES_CSV);
    if (!empty($vrows)) {
        $publicVoteCount = max(0, count($vrows) - 1);
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

// Helper: read evaluators from dedicated evaluators.json
function read_evaluators() {
    if (!file_exists(EVALUATORS_JSON)) return [];
    $data = json_decode(file_get_contents(EVALUATORS_JSON), true);
    return is_array($data) ? $data : [];
}

if ($path === '/evaluators' && $method === 'GET') {
    $evals = read_evaluators();
    // Pridáme počet hodnotení pre každého porotcu
    $counts = [];
    $rrows = read_csv_locked(RATINGS_CSV);
    if (!empty($rrows)) {
        array_shift($rrows);
        foreach ($rrows as $r) {
            $jid = $r[2] ?? '';
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

    $evals = read_evaluators();
    $id = bin2hex(random_bytes(8));
    $evals[] = ['id' => $id, 'name' => $name, 'createdAt' => date('c')];

    file_put_contents(EVALUATORS_JSON, json_encode($evals, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    dlog("EVALUATOR CREATE: id=$id name=$name");
    send_json(['status' => 'ok', 'id' => $id, 'name' => $name]);
}

if (preg_match('#^/evaluators/([^/]+)$#', $path, $m) && $method === 'DELETE') {
    $delId = $m[1];
    $evals = read_evaluators();
    $evals = array_values(array_filter($evals, fn($e) => $e['id'] !== $delId));
    file_put_contents(EVALUATORS_JSON, json_encode($evals, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    dlog("EVALUATOR DELETE: id=$delId");
    send_json(['success' => true]);
}

if ($path === '/admin/public-results' && $method === 'GET') {
    $photos = read_registrations();
    $votes = [];
    $vrows = read_csv_locked(PUBLIC_VOTES_CSV);
    if (!empty($vrows)) {
        array_shift($vrows);
        foreach ($vrows as $v) {
            if (!empty($v[0])) $votes[$v[0]] = ($votes[$v[0]] ?? 0) + 1;
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
    $rrows = read_csv_locked(RATINGS_CSV);
    if (!empty($rrows)) {
        array_shift($rrows); // header
        foreach ($rrows as $r) {
            if (($r[2] ?? '') === $evalId) {
                $ratings[] = [
                    'photoId' => $r[0] ?? '',
                    'score'   => (int)($r[3] ?? 0),
                    'judgeId' => $r[2] ?? ''
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

    ensure_csv(RATINGS_CSV, 'photoId,judgeName,judgeId,score,timestamp');
    
    $rows = read_csv_locked(RATINGS_CSV);
    $header = array_shift($rows);
    
    $found = false;
    foreach ($rows as &$r) {
        if (($r[0] ?? '') === $photoId && ($r[2] ?? '') === $evalId) {
            $r[1] = $evalName;
            $r[3] = $score;
            $r[4] = date('c');
            $found = true;
            break;
        }
    }
    
    if (!$found) {
        $rows[] = [$photoId, $evalName, $evalId, $score, date('c')];
    }
    
    array_unshift($rows, $header);
    write_csv_locked(RATINGS_CSV, $rows);
    
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
    
    // 1. Zmaž z registrácií a súbory
    $rows = read_csv_locked(REGISTRATIONS_CSV);
    if (empty($rows)) send_json(['error' => 'Žiadne registrácie'], 404);
    
    $header = array_shift($rows);
    $newRows = [$header];
    $found = false;

    foreach ($rows as $p) {
        if (($p[0] ?? '') === $idToDelete) {
            $found = true;
            $origFile = $p[10] ?? '';
            $webFile  = $p[11] ?? '';
            if ($origFile && file_exists(ORIGINALS_DIR . '/' . $origFile)) unlink(ORIGINALS_DIR . '/' . $origFile);
            if ($webFile  && file_exists(UPLOADS_DIR . '/' . $webFile))   unlink(UPLOADS_DIR . '/' . $webFile);
        } else {
            $newRows[] = $p;
        }
    }
    
    if ($found) {
        write_csv_locked(REGISTRATIONS_CSV, $newRows);

        // 2. Zmaž súvisiace hodnotenia poroty
        $rrows = read_csv_locked(RATINGS_CSV);
        if (!empty($rrows)) {
            $rheader = array_shift($rrows);
            $newRRows = [$rheader];
            foreach ($rrows as $r) {
                if (($r[0] ?? '') !== $idToDelete) $newRRows[] = $r;
            }
            write_csv_locked(RATINGS_CSV, $newRRows);
        }

        // 3. Zmaž súvisiace verejné hlasy
        $vrows = read_csv_locked(PUBLIC_VOTES_CSV);
        if (!empty($vrows)) {
            $vheader = array_shift($vrows);
            $newVRows = [$vheader];
            foreach ($vrows as $v) {
                if (($v[0] ?? '') !== $idToDelete) $newVRows[] = $v;
            }
            write_csv_locked(PUBLIC_VOTES_CSV, $newVRows);
        }

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
    
    // 1. Premaž registrácie a zmaž súbory
    $rows = read_csv_locked(REGISTRATIONS_CSV);
    if (!empty($rows)) {
        $header = array_shift($rows);
        foreach ($rows as $p) {
            $origFile = $p[10] ?? '';
            $webFile  = $p[11] ?? '';
            if ($origFile && file_exists(ORIGINALS_DIR . '/' . $origFile)) unlink(ORIGINALS_DIR . '/' . $origFile);
            if ($webFile  && file_exists(UPLOADS_DIR . '/' . $webFile))   unlink(UPLOADS_DIR . '/' . $webFile);
        }
        write_csv_locked(REGISTRATIONS_CSV, [$header]);
    }
    
    // 2. Premaž hodnotenia (ponechaj len hlavičku)
    $rrows = read_csv_locked(RATINGS_CSV);
    if (!empty($rrows)) {
        $rheader = array_shift($rrows);
        write_csv_locked(RATINGS_CSV, [$rheader]);
    }

    // 3. Premaž verejné hlasy (ponechaj len hlavičku)
    $vrows = read_csv_locked(PUBLIC_VOTES_CSV);
    if (!empty($vrows)) {
        $vheader = array_shift($vrows);
        write_csv_locked(PUBLIC_VOTES_CSV, [$vheader]);
    }

    // Vyčisti adresáre (poistka pre nezdokumentované súbory)
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
    if (empty($ids) || !is_array($ids)) send_json(['error' => 'Neboli zadané žiadne ID'], 400);

    $idSet = array_flip($ids);

    // 1. Zmaž z registrácií a súbory
    $rows = read_csv_locked(REGISTRATIONS_CSV);
    if (empty($rows)) send_json(['error' => 'Žiadne registrácie'], 404);

    $header = array_shift($rows);
    $newRows = [$header];
    $deletedCount = 0;

    foreach ($rows as $p) {
        $id = $p[0] ?? '';
        if (isset($idSet[$id])) {
            $origFile = $p[10] ?? '';
            $webFile  = $p[11] ?? '';
            if ($origFile && file_exists(ORIGINALS_DIR . '/' . $origFile)) unlink(ORIGINALS_DIR . '/' . $origFile);
            if ($webFile  && file_exists(UPLOADS_DIR . '/' . $webFile))   unlink(UPLOADS_DIR . '/' . $webFile);
            $deletedCount++;
        } else {
            $newRows[] = $p;
        }
    }
    write_csv_locked(REGISTRATIONS_CSV, $newRows);

    // 2. Zmaž z hodnotení
    $rrows = read_csv_locked(RATINGS_CSV);
    if (!empty($rrows)) {
        $rheader = array_shift($rrows);
        $newRRows = [$rheader];
        foreach ($rrows as $r) {
            if (!isset($idSet[$r[0] ?? ''])) $newRRows[] = $r;
        }
        write_csv_locked(RATINGS_CSV, $newRRows);
    }

    // 3. Zmaž z verejných hlasov
    $vrows = read_csv_locked(PUBLIC_VOTES_CSV);
    if (!empty($vrows)) {
        $vheader = array_shift($vrows);
        $newVRows = [$vheader];
        foreach ($vrows as $v) {
            if (!isset($idSet[$v[0] ?? ''])) $newVRows[] = $v;
        }
        write_csv_locked(PUBLIC_VOTES_CSV, $newVRows);
    }

    send_json(['success' => true, 'deleted' => $deletedCount]);
}

// ============================================================
// === ADMIN: EXPORT DO CSV
// ============================================================
if ($path === '/admin/export/results-csv' && $method === 'GET') {
    if (!file_exists(REGISTRATIONS_CSV)) {
        send_json(['error' => 'Súbor s registráciami neexistuje'], 404);
    }
    
    $s = read_settings();
    $photos = read_registrations();
    $contestYear = $s['contestYear'] ?? date('Y');
    
    // Načítaj verejné hlasy
    $publicVotes = [];
    $vrows = read_csv_locked(PUBLIC_VOTES_CSV);
    if (!empty($vrows)) {
        array_shift($vrows);
        foreach ($vrows as $v) {
            $pid = $v[0] ?? '';
            if ($pid) $publicVotes[$pid] = ($publicVotes[$pid] ?? 0) + 1;
        }
    }
    
    // Načítaj porotcov a hodnotenia
    $evaluators = read_evaluators(); 
    $juryScores = [];
    $rrows = read_csv_locked(RATINGS_CSV);
    if (!empty($rrows)) {
        array_shift($rrows);
        foreach ($rrows as $r) {
            $pid = $r[0] ?? '';
            $jid = $r[2] ?? '';
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
    
    $out = fopen('php://output', 'w');
    fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF)); // UTF-8 BOM
    
    // CSV Header
    $headerCols = ['ID', 'Kategória', 'Názov', 'Autor', 'Email', 'Adresa', 'Rok', 'Hlasy_Verejnosti', 'Porota_Spolu'];
    foreach ($evaluators as $e) {
        $headerCols[] = 'Porotca_' . $e['name'];
    }
    fputcsv($out, $headerCols);
    
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
            $p['address'],
            $contestYear,
            $pvotes,
            $jTotal
        ];
        
        foreach ($evaluators as $e) {
            $row[] = $jScores[$e['id']] ?? '';
        }
        fputcsv($out, $row);
    }
    fclose($out);
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

    $vrows = read_csv_locked(PUBLIC_VOTES_CSV);
    array_shift($vrows); // header

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="speleofotografia_hlasy_verejnosti_' . date('Y-m-d') . '.csv"');
    
    $out = fopen('php://output', 'w');
    fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF)); // UTF-8 BOM

    fputcsv($out, ['photoId','photoName','photoCategory','photoAuthor','createdAt','voterIdAnon']);
    foreach ($vrows as $v) {
        $pid = $v[0] ?? '';
        $info = $photos[$pid] ?? ['name' => '', 'category' => '', 'author' => ''];
        fputcsv($out, [
            $pid,
            $info['name'],
            $info['category'],
            $info['author'],
            $v[1] ?? '',
            substr(md5($v[2] ?? ''), 0, 8) // anonymizovaný voter ID
        ]);
    }
    fclose($out);
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
    
    $zipFile = DATA_DIR . '/speleofoto_komplet_export_' . date('Ymd_His') . '.zip';
    $zip = new ZipArchive();
    
    if ($zip->open($zipFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== TRUE) {
        send_json(['error' => 'Nepodarilo sa vytvoriť ZIP archív'], 500);
    }
    
    // 1. Pridaj všetky CSV z data/
    $csvFiles = [REGISTRATIONS_CSV, RATINGS_CSV, PUBLIC_VOTES_CSV];
    foreach ($csvFiles as $f) {
        if (file_exists($f)) {
            $zip->addFile($f, 'data/' . basename($f));
        }
    }

    // 2. Pridaj JSONy
    $jsonFiles = [ADMINS_JSON, EVALUATORS_JSON, SETTINGS_JSON];
    foreach ($jsonFiles as $f) {
        if (file_exists($f)) {
            $zip->addFile($f, 'data/' . basename($f));
        }
    }
    
    // 3. Pridaj originály fotiek
    $photos = read_registrations();
    foreach ($photos as $p) {
        $file = $p['originalPath'] ?? '';
        if ($file) {
            $filePath = ORIGINALS_DIR . '/' . $file;
            if (file_exists($filePath)) {
                $zip->addFile($filePath, 'images/' . $file);
            }
        }
    }
    
    $zip->close();
    
    dlog("EXPORT: total-archive size=" . filesize($zipFile));
    
    while (ob_get_level()) ob_end_clean();
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="speleofotografia_komplet_' . date('Y-m-d') . '.zip"');
    header('Content-Length: ' . filesize($zipFile));
    readfile($zipFile);
    unlink($zipFile);
    exit;
}

// ============================================================
// === ADMIN: VŠETKY HODNOTENIA (pre dashboard)
// ============================================================
if ($path === '/admin/ratings' && $method === 'GET') {
    $result = [];
    $rrows = read_csv_locked(RATINGS_CSV);
    if (!empty($rrows)) {
        array_shift($rrows); // header

        $grouped = [];
        foreach ($rrows as $r) {
            $photoId   = $r[0] ?? '';
            $judgeName = $r[1] ?? '';
            $judgeId   = $r[2] ?? '';
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

    $rrows = read_csv_locked(RATINGS_CSV);
    array_shift($rrows); // header

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="speleofotografia_hodnotenia_' . date('Y-m-d') . '.csv"');
    
    $out = fopen('php://output', 'w');
    fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF)); // UTF-8 BOM

    fputcsv($out, ['photoId', 'photoName', 'photoCategory', 'photoAuthor', 'judgeName', 'judgeId', 'score', 'timestamp']);
    foreach ($rrows as $r) {
        $pid  = $r[0] ?? '';
        $info = $photos[$pid] ?? ['name' => '', 'category' => '', 'author' => ''];
        fputcsv($out, [
            $pid,
            $info['name'],
            $info['category'],
            $info['author'],
            $r[1] ?? '',
            $r[2] ?? '',
            (int)($r[3] ?? 0),
            $r[4] ?? '',
        ]);
    }
    fclose($out);
    exit;
}

// ============================================================
// === 404
// ============================================================
dlog("404: $method $path");
send_json(['error' => 'Endpoint nenájdený', 'path' => $path], 404);

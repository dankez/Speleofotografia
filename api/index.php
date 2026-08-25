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
    
    // Záchrana pre Apache FastCGI / WebSupport, kde sa Authorization hlavička stráca
    if (empty($authHeader)) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    }
    
    // Ďalšia záchrana - apache_request_headers() ak existuje a getallheaders() zlyhal
    if (empty($authHeader) && function_exists('apache_request_headers')) {
        $aHeaders = apache_request_headers();
        $authHeader = $aHeaders['Authorization'] ?? $aHeaders['authorization'] ?? '';
    }

    if ($authHeader && preg_match('/Bearer\s+(.+)$/i', $authHeader, $matches)) {
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

function verify_turnstile($token, $secret, $ip) {
    if (empty($token)) return false;
    $url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    $data = [
        'secret'   => $secret,
        'response' => $token,
        'remoteip' => $ip
    ];
    $options = [
        'http' => [
            'header'  => "Content-type: application/x-www-form-urlencoded\r\n",
            'method'  => 'POST',
            'content' => http_build_query($data),
            'timeout' => 5
        ]
    ];
    $context  = stream_context_create($options);
    $result = @file_get_contents($url, false, $context);
    if ($result === FALSE) {
        return false;
    }
    $response = json_decode($result, true);
    return !empty($response['success']);
}

function json_input() {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

function send_json($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Odosielanie emailov s podporou SMTP a PHP mail() fallbackom */
function send_system_email($to, $subject, $htmlContent) {
    $s = read_settings();
    $smtpHost   = trim($s['smtpHost'] ?? '');
    $smtpPort   = intval($s['smtpPort'] ?? 587);
    $smtpUser   = trim($s['smtpUser'] ?? '');
    $smtpPass   = trim($s['smtpPass'] ?? '');
    $smtpSecure = strtolower(trim($s['smtpSecure'] ?? ''));
    $fromEmail  = trim($s['emailFrom'] ?? '') ?: ($smtpUser ?: 'noreply@speleof26.sss.sk');
    $fromName   = $s['contestName'] ?? 'Speleofotografia 2026';

    dlog("EMAIL ATTEMPT: to=$to, subject='$subject', host=$smtpHost, from=$fromEmail");

    if (!empty($smtpHost)) {
        try {
            $errno = 0;
            $errstr = '';
            $timeout = 8;
            
            $socketHost = ($smtpSecure === 'ssl' || $smtpPort === 465) ? "ssl://{$smtpHost}" : $smtpHost;
            $socket = @fsockopen($socketHost, $smtpPort, $errno, $errstr, $timeout);
            
            if ($socket) {
                stream_set_timeout($socket, 8);
                $read = function() use ($socket) {
                    $response = '';
                    while ($line = fgets($socket, 515)) {
                        $response .= $line;
                        if (substr($line, 3, 1) === ' ') break;
                    }
                    return $response;
                };
                $write = function($cmd) use ($socket) {
                    fputs($socket, $cmd . "\r\n");
                };

                $read();
                $write("EHLO " . ($_SERVER['SERVER_NAME'] ?? 'localhost'));
                $read();

                if ($smtpSecure === 'tls' || ($smtpSecure !== 'ssl' && $smtpPort !== 465)) {
                    $write("STARTTLS");
                    $res = $read();
                    if (strpos($res, '220') !== false) {
                        $cryptoMethod = STREAM_CRYPTO_METHOD_TLS_CLIENT;
                        if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) {
                            $cryptoMethod |= STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
                        }
                        if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) {
                            $cryptoMethod |= STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
                        }
                        @stream_socket_enable_crypto($socket, true, $cryptoMethod);
                        $write("EHLO " . ($_SERVER['SERVER_NAME'] ?? 'localhost'));
                        $read();
                    }
                }

                if (!empty($smtpUser) && !empty($smtpPass)) {
                    $write("AUTH LOGIN");
                    $read();
                    $write(base64_encode($smtpUser));
                    $read();
                    $write(base64_encode($smtpPass));
                    $authRes = $read();
                    if (strpos($authRes, '235') === false) {
                        dlog("EMAIL SMTP AUTH FAILED: $authRes");
                        throw new Exception("SMTP Auth Failed: $authRes");
                    }
                }

                $write("MAIL FROM: <$fromEmail>");
                $read();
                $write("RCPT TO: <$to>");
                $read();
                $write("DATA");
                $read();

                $headers  = "MIME-Version: 1.0\r\n";
                $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
                $headers .= "From: =?UTF-8?B?" . base64_encode($fromName) . "?= <$fromEmail>\r\n";
                $headers .= "To: <$to>\r\n";
                $headers .= "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n";
                $headers .= "Date: " . date('r') . "\r\n";

                $write($headers . "\r\n" . $htmlContent . "\r\n.");
                $sendRes = $read();
                $write("QUIT");
                fclose($socket);

                if (strpos($sendRes, '250') !== false) {
                    dlog("EMAIL SMTP SUCCESS: $to");
                    return true;
                } else {
                    dlog("EMAIL SMTP DATA FAILED: $sendRes");
                }
            } else {
                dlog("EMAIL SMTP CONNECT FAILED: $errstr ($errno)");
            }
        } catch (Exception $e) {
            dlog("EMAIL SMTP EXCEPTION: " . $e->getMessage());
        }
    }

    $headers  = "MIME-Version: 1.0\r\n";
    $headers .= "Content-type: text/html; charset=UTF-8\r\n";
    $headers .= "From: =?UTF-8?B?" . base64_encode($fromName) . "?= <$fromEmail>\r\n";
    $headers .= "Reply-To: $fromEmail\r\n";
    $headers .= "X-Mailer: Speleofoto/3.4\r\n";

    $encodedSubject = "=?UTF-8?B?" . base64_encode($subject) . "?=";
    $ok = @mail($to, $encodedSubject, $htmlContent, $headers);
    dlog("EMAIL PHP mail() " . ($ok ? "SUCCESS" : "FAILED") . " to $to");
    return $ok;
}

// ============================================================
// === DEBUG (Chránené pre administrátorov)
// ============================================================
if ($path === '/debug' && $method === 'GET') {
    check_auth();
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
    $byCategory = [];
    foreach ($photos as $p) {
        $cat = $p['category'] ?? 'A';
        $byCategory[$cat] = ($byCategory[$cat] ?? 0) + 1;
    }
    
    $publicVotesCount = 0;
    if (file_exists(PUBLIC_VOTES_CSV)) {
        $vlines = file(PUBLIC_VOTES_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        $publicVotesCount = max(0, count($vlines) - 1);
    }

    send_json([
        'totalPhotos'    => count($photos),
        'uniqueAuthors'  => count(array_unique(array_filter(array_column($photos, 'email')))),
        'byCategory'     => $byCategory,
        'totalVotes'     => $publicVotesCount,
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
// === PUBLIC: VÝSLEDKY SÚŤAŽE
// ============================================================
if ($path === '/public/results' && $method === 'GET') {
    $s = read_settings();
    $photos = read_registrations();
    
    // Načítaj porotcov a hodnotenia poroty
    $juryScores = [];
    if (file_exists(RATINGS_CSV)) {
        $rlines = file(RATINGS_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        array_shift($rlines);
        foreach ($rlines as $rl) {
            $r = str_getcsv($rl);
            $pid = $r[2] ?? '';
            $score = (int)($r[3] ?? 0);
            if ($pid) {
                $juryScores[$pid] = ($juryScores[$pid] ?? 0) + $score;
            }
        }
    }

    // Načítaj verejné hlasy
    $publicVotes = [];
    if (file_exists(PUBLIC_VOTES_CSV)) {
        $vlines = file(PUBLIC_VOTES_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        array_shift($vlines);
        foreach ($vlines as $v) {
            $r = str_getcsv($v);
            $pid = $r[0] ?? '';
            if ($pid) {
                $publicVotes[$pid] = ($publicVotes[$pid] ?? 0) + 1;
            }
        }
    }

    // Mapovanie fotiek na ich indexované pole pre rýchle vyhľadávanie
    $photosMap = [];
    foreach ($photos as $p) {
        // Anonymizujeme kontaktné údaje pre verejný výstup
        $anonymized = [
            'id'           => $p['id'],
            'author'       => $p['author'],
            'category'     => $p['category'],
            'name'         => $p['name'],
            'webPath'      => $p['webPath'],
            'description'  => $p['description'],
            'juryScore'    => $juryScores[$p['id']] ?? 0,
            'publicVotes'  => $publicVotes[$p['id']] ?? 0,
        ];
        $photosMap[$p['id']] = $anonymized;
    }

    // Načítaj priradené ocenenia zo settings
    $awards = $s['awards'] ?? [];
    $resolvedAwards = [];
    $awardedPhotoIds = [];

    foreach ($awards as $a) {
        $pid = $a['photoId'] ?? '';
        $photoDetail = null;
        if ($pid && isset($photosMap[$pid])) {
            $photoDetail = $photosMap[$pid];
            $awardedPhotoIds[] = $pid;
        }
        
        $resolvedAwards[] = [
            'id'            => $a['id'],
            'type'          => $a['type'],
            'titleSk'       => $a['titleSk'] ?? '',
            'titleEn'       => $a['titleEn'] ?? '',
            'descriptionSk' => $a['descriptionSk'] ?? '',
            'descriptionEn' => $a['descriptionEn'] ?? '',
            'photo'         => $photoDetail
        ];
    }

    // Zostav výstavnú galériu (Exhibition Gallery)
    // Zahrnieme fotky, ktoré sú shortlisted alebo majú hodnotenie a vynecháme víťazov ocenení
    $exhibition = [];
    foreach ($photos as $p) {
        if (in_array($p['id'], $awardedPhotoIds)) {
            continue; // Vynechaj víťazov hlavných ocenení
        }
        
        if ($p['shortlisted'] === true || ($juryScores[$p['id']] ?? 0) > 0 || ($publicVotes[$p['id']] ?? 0) > 0) {
            $exhibition[] = $photosMap[$p['id']];
        }
    }

    // Zoradiť výstavnú galériu podľa celkového skóre poroty
    usort($exhibition, function($a, $b) {
        return $b['juryScore'] - $a['juryScore'];
    });

    send_json([
        'edition'     => $s['edition'] ?? '',
        'contestName' => $s['contestName'] ?? 'Speleofotografia',
        'museumName'  => $s['museumName'] ?? '',
        'awards'      => $resolvedAwards,
        'exhibition'  => $exhibition
    ]);
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
    $turnstileToken = trim($data['turnstileToken'] ?? '');

    if (empty($photoId)) {
        send_json(['error' => 'Chýbajúce údaje'], 400);
    }

    $s = read_settings();
    $ip = get_client_ip();

    // 1. IP Rate Limiting
    $rateLimitVotes = isset($s['rateLimitVotes']) ? (int)$s['rateLimitVotes'] : 5;
    $rateLimitWindow = isset($s['rateLimitWindow']) ? (int)$s['rateLimitWindow'] : 3600;
    
    if ($rateLimitVotes > 0) {
        $limitsFile = DATA_DIR . '/rate_limits.json';
        $limits = [];
        if (file_exists($limitsFile)) {
            $limits = json_decode(file_get_contents($limitsFile), true) ?? [];
        }
        
        $now = time();
        $cleanedLimits = [];
        foreach ($limits as $kIp => $timestamps) {
            if (!is_array($timestamps)) continue;
            $validTs = array_values(array_filter($timestamps, fn($ts) => ($now - $ts) < $rateLimitWindow));
            if (!empty($validTs)) {
                $cleanedLimits[$kIp] = $validTs;
            }
        }

        $ipVotesFiltered = $cleanedLimits[$ip] ?? [];
        
        if (count($ipVotesFiltered) >= $rateLimitVotes) {
            send_json(['error' => 'Prekročili ste limit verejného hlasovania z vašej IP adresy. Skúste to neskôr.'], 429);
        }
        
        // Pridaj nový záznam a ulož prečistený súbor
        $ipVotesFiltered[] = $now;
        $cleanedLimits[$ip] = $ipVotesFiltered;
        file_put_contents($limitsFile, json_encode($cleanedLimits, JSON_PRETTY_PRINT), LOCK_EX);
    }

    // 2. Cloudflare Turnstile Validation
    $turnstileEnabled = !isset($s['turnstileEnabled']) || $s['turnstileEnabled'] === true || $s['turnstileEnabled'] === 'true' || $s['turnstileEnabled'] === 1;
    if ($turnstileEnabled) {
        $secret = !empty($s['turnstileSecretKey']) ? $s['turnstileSecretKey'] : '1x0000000000000000000000000000000E';
        if (!verify_turnstile($turnstileToken, $secret, $ip)) {
            send_json(['error' => 'Overenie proti robotom (Turnstile) zlyhalo. Skúste to znova.'], 400);
        }
    }

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
    $now = new DateTime();
    $status = $s['contestStatus'] ?? 'submissions';
    
    // 1. Kontrola stavu súťaže
    if ($status !== 'submissions') {
        dlog("REGISTER REJECTED: contestStatus=$status");
        send_json([
            'success' => false,
            'error' => ($status === 'results' ? 'Súťaž je už ukončená.' : 'Prihlasovanie fotografií do súťaže je momentálne uzavreté.')
        ], 403);
    }

    // 2. Kontrola termínu uzávierky
    if (!empty($s['submissionEnd'])) {
        $end = new DateTime($s['submissionEnd'] . ' 23:59:59');
        if ($now > $end) {
            dlog("REGISTER REJECTED: deadline passed (" . $end->format('Y-m-d H:i') . ")");
            send_json([
                'success' => false,
                'error' => 'Termín na prihlasovanie fotografií vypršal dňa ' . $end->format('d. m. Y') . '.'
            ], 403);
        }
    }

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

    $photoInfos = json_decode($_POST['photoInfo'] ?? '[]', true) ?? [];
    $author = trim($_POST['author'] ?? 'Anonym');
    $authorEmail = strtolower(trim($_POST['email'] ?? ''));

    // Server-side kontrola limitu fotiek na kategóriu
    $maxPhotos = intval($s['maxPhotosPerCategory'] ?? 5);
    if ($maxPhotos <= 0) $maxPhotos = 5;

    if (!empty($authorEmail)) {
        $existingPhotos = read_registrations();
        $existingCounts = [];
        foreach ($existingPhotos as $ep) {
            if (strtolower($ep['email'] ?? '') === $authorEmail) {
                $cat = $ep['category'] ?? 'A';
                $existingCounts[$cat] = ($existingCounts[$cat] ?? 0) + 1;
            }
        }

        $incomingCounts = [];
        foreach ($fileList as $i => $file) {
            $pInfo = $photoInfos[$i] ?? [];
            $cat = $pInfo['category'] ?? 'A';
            $incomingCounts[$cat] = ($incomingCounts[$cat] ?? 0) + 1;
        }

        foreach ($incomingCounts as $cat => $incCount) {
            $currentTotal = ($existingCounts[$cat] ?? 0) + $incCount;
            if ($currentTotal > $maxPhotos) {
                dlog("REGISTER LIMIT EXCEEDED: email=$authorEmail cat=$cat ($currentTotal > $maxPhotos)");
                send_json([
                    'success' => false,
                    'error' => "Prekročený maximálny povolený počet fotografií v kategórii $cat (max $maxPhotos)."
                ], 400);
            }
        }
    }

    ensure_dir(UPLOADS_DIR);
    ensure_dir(ORIGINALS_DIR);
    ensure_csv(REGISTRATIONS_CSV, 'id,author,email,instagram,webpage,address,gdprConsent,rulesConsent,category,name,originalPath,webPath,description,metadata,createdAt,shortlisted');

    $rows   = [];
    $errors = [];
    $watermarkTpl = $s['watermarkTemplate'] ?? 'Speleofoto © $author';
    $wFontSize    = $s['watermarkFontSize'] ?? 40;
    $wColor       = $s['watermarkColor'] ?? 'rgba(255,255,255,0.5)';
    
    dlog("REGISTER: wTpl=$watermarkTpl, wSize=$wFontSize, wColor=$wColor");

    $allowedExts = ['jpg', 'jpeg', 'png', 'webp'];

    foreach ($fileList as $i => $file) {
        if ($file['error'] !== UPLOAD_ERR_OK) {
            dlog("FILE $i ERR kod=" . $file['error']);
            $errors[] = "Súbor $i: chyba nahrávania (kód " . $file['error'] . ")";
            continue;
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, $allowedExts)) {
            dlog("FILE $i INVALID EXT: $ext");
            $errors[] = "Súbor {$file['name']}: nepodporovaný formát súboru (povolené: JPG, PNG, WEBP)";
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
                'false',           // predvolene NIE JE v shortliste
            ]);
        } else {
            dlog("FILE $i FAILED: ImageProcessor zlyhal");
            $errors[] = "Súbor {$file['name']}: chyba pri spracovaní (neplatný obrázok)";
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
// === POTVRDZOVACÍ EMAIL PO REGISTRÁCII
// ============================================================
if ($path === '/send-confirmation' && $method === 'POST') {
    $data = json_input();
    $email = trim($data['email'] ?? '');
    $author = trim($data['author'] ?? 'Účastník');
    $photosList = $data['photos'] ?? [];

    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        send_json(['success' => false, 'error' => 'Neplatná emailová adresa'], 400);
    }

    $s = read_settings();
    $contestName = $s['contestName'] ?? 'Speleofotografia 2026';
    $edition = $s['edition'] ?? '23. ročník';
    $museumName = $s['museumName'] ?? 'Slovenské múzeum ochrany prírody a jaskyniarstva';

    $subject = "Potvrdenie registrácie / Registration Confirmation - $contestName";

    $photosHtml = '';
    foreach ($photosList as $idx => $ph) {
        $num = $idx + 1;
        $name = htmlspecialchars($ph['name'] ?? "Fotografia $num", ENT_QUOTES, 'UTF-8');
        $cat = htmlspecialchars($ph['category'] ?? 'A', ENT_QUOTES, 'UTF-8');
        $desc = !empty($ph['description']) ? htmlspecialchars($ph['description'], ENT_QUOTES, 'UTF-8') : '';
        
        $catLabel = ($cat === 'A') ? 'Kategória A – Krása jaskýň / Beauty of Caves' : (($cat === 'B') ? 'Kategória B – Speleomoment' : "Kategória $cat");

        $photosHtml .= "<tr style='border-bottom: 1px solid #edf2f7;'>
            <td style='padding: 12px 10px; font-weight: bold; color: #2d3748;'>#$num</td>
            <td style='padding: 12px 10px; color: #1a202c;'><strong>$name</strong>" . ($desc ? "<div style='font-size: 12px; color: #718096; margin-top: 4px; font-style: italic;'>$desc</div>" : "") . "</td>
            <td style='padding: 12px 10px; color: #4a5568;'><span style='background: #edf2f7; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;'>$catLabel</span></td>
        </tr>";
    }

    if (empty($photosHtml)) {
        $photosHtml = "<tr><td colspan='3' style='padding: 12px; color: #718096; text-align: center;'>Fotografie boli úspešne prijaté / Photos received</td></tr>";
    }

    $safeAuthor = htmlspecialchars($author, ENT_QUOTES, 'UTF-8');
    $currentDate = date('d.m.Y H:i');

    $htmlBody = <<<HTML
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Potvrdenie registrácie / Registration Confirmation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f6f8; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 620px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          <!-- Header -->
          <tr>
            <td style="background-color: #1a202c; padding: 30px 25px; text-align: center; border-bottom: 4px solid #eab308;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">
                $contestName
              </h1>
              <p style="margin: 6px 0 0 0; color: #cbd5e1; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">
                $edition &bull; $museumName
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px 25px; color: #2d3748; font-size: 15px; line-height: 1.6;">
              <!-- SK text -->
              <p style="font-size: 16px; font-weight: bold; margin-top: 0; color: #1a202c;">
                Vážený/á $safeAuthor,
              </p>
              <p style="margin-bottom: 20px;">
                Ďakujeme za zaslanie prihlášky do medzinárodnej fotografickej súťaže <strong>$contestName</strong>. Vaša prihláška bola úspešne zaregistrovaná v systéme dňa <strong>$currentDate</strong>.
              </p>

              <!-- Photo list table -->
              <div style="background-color: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; padding: 15px; margin: 25px 0;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #4a5568; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                  Zoznam prihlásených fotografií / Submitted Works
                </h3>
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; text-align: left;">
                  <thead>
                    <tr style="border-bottom: 2px solid #cbd5e1; color: #718096; font-size: 12px; text-transform: uppercase;">
                      <th style="padding: 8px 10px;">#</th>
                      <th style="padding: 8px 10px;">Názov / Title</th>
                      <th style="padding: 8px 10px;">Kategória / Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    $photosHtml
                  </tbody>
                </table>
              </div>

              <!-- EN text -->
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
              <p style="font-size: 15px; font-weight: bold; color: #1a202c;">
                Dear $safeAuthor,
              </p>
              <p style="margin-bottom: 20px; color: #4a5568;">
                Thank you for your entry into the international photo competition <strong>$contestName</strong>. Your application and submitted works were successfully received on <strong>$currentDate</strong>.
              </p>

              <!-- Button / Link -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0 15px 0;">
                <tr>
                  <td align="center">
                    <a href="https://speleof26.sss.sk/" style="display: inline-block; background-color: #1a202c; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 4px; font-weight: bold; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; border-left: 3px solid #eab308;">
                      Navštíviť stránku súťaže / Visit Website
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 25px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #718096; line-height: 1.5;">
              <p style="margin: 0 0 5px 0;">
                <strong>Slovenská speleologická spoločnosť & Slovenské múzeum ochrany prírody a jaskyniarstva</strong>
              </p>
              <p style="margin: 0; color: #a0aec0;">
                Tento email bol vygenerovaný automaticky po odoslaní registračného formulára na <a href="https://speleof26.sss.sk/" style="color: #4a5568; text-decoration: underline;">speleof26.sss.sk</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
HTML;

    $sent = send_system_email($email, $subject, $htmlBody);
    send_json(['success' => true, 'emailSent' => $sent]);
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

// ============================================================
// === ADMIN: ODOSLANIE POZVÁNKY POROTCOVI EMAILOM
// ============================================================
if ($path === '/admin/evaluators/send-invite' && $method === 'POST') {
    $data = json_input();
    $id = trim($data['id'] ?? '');
    $email = trim($data['email'] ?? '');

    if (empty($id) || empty($email)) {
        send_json(['error' => 'Chýba ID porotcu alebo emailová adresa'], 400);
    }

    $evaluators = read_evaluators();
    $evaluator = null;
    foreach ($evaluators as $ev) {
        if ($ev['id'] === $id) {
            $evaluator = $ev;
            break;
        }
    }
    if (!$evaluator) {
        send_json(['error' => 'Porotca nenájdený'], 404);
    }

    $s = read_settings();
    $contestName = $s['contestName'] ?? 'Speleofotografia 2026';
    $evalName = $evaluator['name'];

    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
    $host = $_SERVER['HTTP_HOST'] ?? 'speleof26.sss.sk';
    $evalLink = $protocol . $host . '/?eval=' . $id;

    $subject = "Pozvánka do odbornej poroty – $contestName / Jury Invitation";
    $htmlBody = <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a202c; background: #f8fafc; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background: #0f172a; padding: 24px; text-align: center;">
      <h1 style="color: #f8fafc; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">$contestName</h1>
      <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Odborná porota / Expert Jury</p>
    </div>
    
    <div style="padding: 28px;">
      <p style="font-size: 16px; margin-top: 0;">Vážený/á <strong>$evalName</strong>,</p>
      <p style="font-size: 14px; color: #475569;">
        Boli ste vymenovaný/á za člena odbornej poroty medzinárodnej súťaže <strong>$contestName</strong>.
        Pripravili sme pre Vás zabezpečený prístup do hodnotiaceho rozhrania súťaže.
      </p>
      
      <div style="background: #f1f5f9; border-left: 4px solid #eab308; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #64748b;">Váš osobný hodnotiaci odkaz / Your private evaluation link:</p>
        <p style="margin: 0; font-family: monospace; font-size: 13px; word-break: break-all; color: #0f172a;">$evalLink</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="$evalLink" style="display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; padding: 14px 28px; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; border-radius: 6px;">
          Otvoriť hodnotiaci portál / Open Portal
        </a>
      </div>

      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;">
      <p style="font-size: 12px; color: #64748b; margin: 0; line-height: 1.5;">
        <em>English summary:</em> You have been invited to the jury for $contestName. Please use the button above or link to access your private evaluation interface and rate the competition photographs.
      </p>
    </div>
    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8;">
      Slovenská speleologická spoločnosť & Slovenské múzeum ochrany prírody a jaskyniarstva
    </div>
  </div>
</body>
</html>
HTML;

    $sent = send_system_email($email, $subject, $htmlBody);
    if ($sent) {
        dlog("JURY INVITE SENT: evalId=$id, name=$evalName, email=$email");
        send_json(['success' => true, 'message' => "Pozvánka bola úspešne odoslaná na $email"]);
    } else {
        dlog("JURY INVITE FAILED: evalId=$id, email=$email");
        send_json(['error' => 'Nepodarilo sa odoslať pozvánku (skontrolujte nastavenie SMTP)'], 500);
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
    $evalId = trim($m[1]);
    $evaluators = read_evaluators();
    $matched = false;
    foreach ($evaluators as $ev) {
        if ($ev['id'] === $evalId) {
            $matched = true;
            break;
        }
    }
    if (!$matched) {
        send_json([]);
    }

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
    $photoId = trim($data['photoId'] ?? '');
    $evalId  = trim($data['evalId'] ?? '');
    $score   = (int)($data['score'] ?? 0);

    if (!$photoId || !$evalId || $score < 1 || $score > 10) {
        send_json(['error' => 'Neplatné údaje pre hodnotenie (povolené skóre 1-10)'], 400);
    }

    // Overenie existencie a oprávnenia porotcu
    $evaluators = read_evaluators();
    $matchedEvaluator = null;
    foreach ($evaluators as $ev) {
        if ($ev['id'] === $evalId) {
            $matchedEvaluator = $ev;
            break;
        }
    }
    if (!$matchedEvaluator) {
        dlog("RATE REJECTED: neznámy porotca evalId=$evalId");
        send_json(['error' => 'Neplatný alebo neexistujúci identifikátor porotcu'], 403);
    }

    // Overenie existencie fotografie
    $photos = read_registrations();
    $photoExists = false;
    foreach ($photos as $ph) {
        if ($ph['id'] === $photoId) {
            $photoExists = true;
            break;
        }
    }
    if (!$photoExists) {
        send_json(['error' => 'Fotografia neexistuje'], 404);
    }

    $evalName = $matchedEvaluator['name'];

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
    dlog("RATE SUCCESS: evalId=$evalId ($evalName), photoId=$photoId, score=$score");
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
// === ADMIN: ÚPRAVA DETAILOV FOTOGRAFIE (PATCH)
// ============================================================
if (preg_match('#^/admin/photos/([^/]+)$#', $path, $m) && $method === 'PATCH') {
    $id = $m[1];
    $updates = json_input();
    
    if (!file_exists(REGISTRATIONS_CSV)) {
        send_json(['error' => 'Súbor s registráciami neexistuje'], 404);
    }
    
    $lines = file(REGISTRATIONS_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $header = array_shift($lines);
    $found = false;
    $newLines = [];
    
    foreach ($lines as $line) {
        $p = str_getcsv($line);
        if (($p[0] ?? '') === $id) {
            $found = true;
            // 0:id, 1:author, 2:email, 3:instagram, 4:webpage, 5:address, 6:gdpr, 7:rules, 8:category, 9:name, 10:orig, 11:web, 12:desc, 13:meta, 14:date, 15:shortlisted
            if (isset($updates['author']))      $p[1] = $updates['author'];
            if (isset($updates['email']))       $p[2] = $updates['email'];
            if (isset($updates['instagram']))   $p[3] = $updates['instagram'];
            if (isset($updates['webpage']))     $p[4] = $updates['webpage'];
            if (isset($updates['address']))     $p[5] = $updates['address'];
            if (isset($updates['category']))    $p[8] = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $updates['category']));
            if (isset($updates['name']))        $p[9] = $updates['name'];
            if (isset($updates['description'])) $p[12] = $updates['description'];
            if (isset($updates['shortlisted'])) $p[15] = ($updates['shortlisted'] === true || $updates['shortlisted'] === 'true' || $updates['shortlisted'] === 1) ? 'true' : 'false';
            
            $esc = fn($v) => '"' . str_replace('"', '""', $v) . '"';
            $newLines[] = implode(',', array_map($esc, $p));
            dlog("ADMIN PHOTO PATCH: id=$id updated");
        } else {
            $newLines[] = $line;
        }
    }
    
    if (!$found) {
        send_json(['error' => 'Fotografia nenájdená'], 404);
    }
    
    file_put_contents(REGISTRATIONS_CSV, $header . "\n" . implode("\n", $newLines) . ($newLines ? "\n" : ""), LOCK_EX);
    send_json(['success' => true, 'id' => $id]);
}

// ============================================================
// === ADMIN: ZMAZANIE VŠETKÝCH FOTIEK
// ============================================================
if ($path === '/admin/photos/delete-all' && $method === 'POST') {
    $data = json_input();
    if (($data['confirm'] ?? '') !== 'DELETE_ALL') {
        send_json(['error' => 'Potvrdenie akcie zlyhalo. Vyžaduje sa confirm: DELETE_ALL.'], 400);
    }

    dlog("DELETE ALL PHOTOS requested with valid confirmation");
    
    if (!file_exists(REGISTRATIONS_CSV)) send_json(['success' => true]);
    
    // Auto-backup pred zmazaním
    ensure_dir(DATA_DIR . '/backups');
    copy(REGISTRATIONS_CSV, DATA_DIR . '/backups/registrations_before_deleteall_' . date('Ymd_His') . '.csv.bak');

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
// === ADMIN: HROMADNÁ ZMENA KATEGÓRIE FOTIEK
// ============================================================
if ($path === '/admin/photos/bulk-category' && $method === 'POST') {
    $data = json_input();
    $ids = $data['ids'] ?? [];
    $rawCategory = trim($data['category'] ?? '');
    $newCategory = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $rawCategory));

    if (empty($ids) || !is_array($ids) || empty($newCategory)) {
        send_json(['error' => 'Chýbajúce ID fotografií alebo neplatná kategória'], 400);
    }

    if (!file_exists(REGISTRATIONS_CSV)) {
        send_json(['error' => 'Žiadne registrácie'], 404);
    }

    // Auto-backup pred zápisom
    ensure_dir(DATA_DIR . '/backups');
    copy(REGISTRATIONS_CSV, DATA_DIR . '/backups/registrations_' . date('Ymd_His') . '.csv.bak');

    $lines = file(REGISTRATIONS_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $header = array_shift($lines);
    $idSet = array_flip($ids);
    $updatedCount = 0;
    $newLines = [];

    foreach ($lines as $line) {
        $p = str_getcsv($line);
        $id = $p[0] ?? '';
        if (isset($idSet[$id])) {
            $p[8] = $newCategory; // category index
            $esc = fn($v) => '"' . str_replace('"', '""', $v) . '"';
            $newLines[] = implode(',', array_map($esc, $p));
            $updatedCount++;
            dlog("BULK CATEGORY: id=$id -> $newCategory");
        } else {
            $newLines[] = $line;
        }
    }

    file_put_contents(REGISTRATIONS_CSV, $header . "\n" . implode("\n", $newLines) . ($newLines ? "\n" : ""), LOCK_EX);
    send_json(['success' => true, 'updated' => $updatedCount]);
}

// ============================================================
// === ADMIN: HROMADNÉ STIAHNUTIE VYBRANÝCH FOTIEK (ZIP)
// ============================================================
if ($path === '/admin/photos/bulk-download' && $method === 'POST') {
    if (!extension_loaded('zip')) {
        send_json(['error' => 'ZIP rozšírenie nie je na serveri dostupné'], 500);
    }

    $data = json_input();
    $ids = $data['ids'] ?? [];
    if (empty($ids) || !is_array($ids)) {
        send_json(['error' => 'Neboli vybrané žiadne fotografie'], 400);
    }

    $photos = read_registrations();
    $idSet = array_flip($ids);

    ensure_dir(DATA_DIR . '/backups');
    $zipFile = DATA_DIR . '/backups/selected_photos_' . date('Ymd_His') . '.zip';
    $zip = new ZipArchive();

    if ($zip->open($zipFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== TRUE) {
        send_json(['error' => 'Nepodarilo sa vytvoriť ZIP archív'], 500);
    }

    $addedCount = 0;
    foreach ($photos as $p) {
        if (isset($idSet[$p['id']])) {
            $file = $p['originalPath'] ?? '';
            if ($file) {
                $filePath = ORIGINALS_DIR . '/' . $file;
                if (file_exists($filePath)) {
                    $zip->addFile($filePath, $file);
                    $addedCount++;
                }
            }
        }
    }

    $zip->close();

    if ($addedCount === 0) {
        if (file_exists($zipFile)) unlink($zipFile);
        send_json(['error' => 'Vybrané fotografie sa nenašli na disku'], 404);
    }

    dlog("EXPORT: bulk-download count=$addedCount size=" . filesize($zipFile));

    while (ob_get_level()) ob_end_clean();
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="speleofoto_vyber_' . count($ids) . 'ks_' . date('Y-m-d') . '.zip"');
    header('Content-Length: ' . filesize($zipFile));
    header('Pragma: no-cache');
    header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
    header('Expires: 0');

    $handle = fopen($zipFile, 'rb');
    if ($handle) {
        while (!feof($handle)) {
            echo fread($handle, 1024 * 1024);
            flush();
        }
        fclose($handle);
    }
    unlink($zipFile);
    exit;
}

// ============================================================
// === ADMIN: OTOČENIE FOTOGRAFIE O 90 / 180 / 270 STUPŇOV
// ============================================================
if ($path === '/admin/photos/rotate' && $method === 'POST') {
    require_once 'ImageProcessor.php';
    $data = json_input();
    $id = $data['id'] ?? '';
    $angle = (int)($data['angle'] ?? 90);
    if (!in_array($angle, [90, 180, 270, -90, -180, -270])) {
        $angle = 90;
    }

    if (empty($id)) {
        send_json(['error' => 'Chýbajúce ID fotografie'], 400);
    }

    $photos = read_registrations();
    $target = null;
    foreach ($photos as $p) {
        if ($p['id'] === $id) {
            $target = $p;
            break;
        }
    }

    if (!$target) {
        send_json(['error' => 'Fotografia nenájdená'], 404);
    }

    $rotatedAny = false;

    // 1. Otoč web verziu (WebP)
    if (!empty($target['webPath'])) {
        $webFile = UPLOADS_DIR . '/' . $target['webPath'];
        if (file_exists($webFile)) {
            ImageProcessor::rotateFile($webFile, $angle);
            $rotatedAny = true;
        }
    }

    // 2. Otoč originál (JPEG)
    if (!empty($target['originalPath'])) {
        $origFile = ORIGINALS_DIR . '/' . $target['originalPath'];
        if (file_exists($origFile)) {
            ImageProcessor::rotateFile($origFile, $angle);
            $rotatedAny = true;
        }
    }

    dlog("ROTATE PHOTO: id=$id, angle=$angle, ok=" . ($rotatedAny ? '1' : '0'));
    send_json(['success' => $rotatedAny, 'id' => $id, 'angle' => $angle]);
}

// ============================================================
// === ADMIN: HROMADNÁ OPRAVA ORIENTÁCIE (EXIF AUTO-FIX)
// ============================================================
if ($path === '/admin/photos/fix-orientations' && $method === 'POST') {
    require_once 'ImageProcessor.php';
    $photos = read_registrations();
    $fixedCount = 0;

    foreach ($photos as $p) {
        $origFile = !empty($p['originalPath']) ? ORIGINALS_DIR . '/' . $p['originalPath'] : '';
        $webFile = !empty($p['webPath']) ? UPLOADS_DIR . '/' . $p['webPath'] : '';

        if ($origFile && file_exists($origFile)) {
            $orientation = ImageProcessor::detectExifOrientation($origFile);
            if (in_array($orientation, [3, 6, 8])) {
                $angle = 0;
                if ($orientation === 3) $angle = 180;
                elseif ($orientation === 6) $angle = 90;
                elseif ($orientation === 8) $angle = 270;

                if ($angle > 0) {
                    ImageProcessor::rotateFile($origFile, $angle);
                    if ($webFile && file_exists($webFile)) {
                        ImageProcessor::rotateFile($webFile, $angle);
                    }
                    $fixedCount++;
                    dlog("EXIF AUTO-FIX: id={$p['id']}, orientation=$orientation -> rotated $angle deg");
                }
            }
        }
    }

    send_json(['success' => true, 'fixedCount' => $fixedCount]);
}

// ============================================================
// === ADMIN: KOMPLETNÁ ZÁLOHA DÁT A NASTAVENÍ (ZIP)
// ============================================================
if ($path === '/admin/export/backup-data' && $method === 'GET') {
    dlog("EXPORT: backup-data requested");
    
    // Auto-create backup dir
    ensure_dir(DATA_DIR . '/backups');
    
    if (extension_loaded('zip')) {
        $zipFile = DATA_DIR . '/backups/speleofoto_backup_' . date('Ymd_His') . '.zip';
        $zip = new ZipArchive();
        if ($zip->open($zipFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) === TRUE) {
            $dataFiles = ['settings.json', 'registrations.csv', 'ratings.csv', 'public_votes.csv', 'admins.json', 'evaluators.csv', 'tokens.json'];
            foreach ($dataFiles as $df) {
                $p = DATA_DIR . '/' . $df;
                if (file_exists($p)) {
                    $zip->addFile($p, $df);
                }
            }
            $zip->close();

            while (ob_get_level()) ob_end_clean();
            header('Content-Type: application/zip');
            header('Content-Disposition: attachment; filename="speleofotografia_zaloha_dat_' . date('Y-m-d_H-i') . '.zip"');
            header('Content-Length: ' . filesize($zipFile));
            header('Pragma: no-cache');
            header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
            header('Expires: 0');

            $handle = fopen($zipFile, 'rb');
            if ($handle) {
                while (!feof($handle)) {
                    echo fread($handle, 1024 * 1024);
                    flush();
                }
                fclose($handle);
            }
            unlink($zipFile);
            exit;
        }
    }
    
    // Fallback JSON bundle ak ZIP nie je dostupný
    $bundle = [
        'timestamp' => date('c'),
        'settings' => read_settings(),
        'registrations' => file_exists(REGISTRATIONS_CSV) ? file_get_contents(REGISTRATIONS_CSV) : '',
        'ratings' => file_exists(RATINGS_CSV) ? file_get_contents(RATINGS_CSV) : '',
        'public_votes' => file_exists(PUBLIC_VOTES_CSV) ? file_get_contents(PUBLIC_VOTES_CSV) : '',
    ];
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="speleofotografia_zaloha_' . date('Y-m-d') . '.json"');
    echo json_encode($bundle, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
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
// === ADMIN: ODOSLANIE EMAILU AUTOROVI (COMMUNICATE)
// ============================================================
if ($path === '/admin/communicate' && $method === 'POST') {
    $data = json_input();
    $email = trim($data['email'] ?? '');
    $subject = trim($data['subject'] ?? '');
    $message = trim($data['message'] ?? '');

    if (empty($email) || empty($subject) || empty($message)) {
        send_json(['error' => 'Chýbajúce povinné polia (email, subject, message)'], 400);
    }

    $s = read_settings();
    $contestName = $s['contestName'] ?? 'Speleofotografia 2026';
    $htmlMessage = nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8'));
    
    $htmlBody = <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #2d3748; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px;">
    <h2 style="color: #1a202c; border-bottom: 2px solid #eab308; padding-bottom: 8px; margin-top: 0;">$contestName</h2>
    <div style="font-size: 15px; margin: 20px 0;">$htmlMessage</div>
    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;">
    <p style="font-size: 12px; color: #718096; margin: 0;">Správa bola odoslaná administrátorom súťaže $contestName.</p>
  </div>
</body>
</html>
HTML;

    $sent = send_system_email($email, $subject, $htmlBody);
    if ($sent) {
        dlog("ADMIN COMMUNICATE SUCCESS: to=$email, subject=$subject");
        send_json(['success' => true]);
    } else {
        dlog("ADMIN COMMUNICATE FAILED: to=$email");
        send_json(['error' => 'Nepodarilo sa odoslať email (skontrolujte nastavenia SMTP)'], 500);
    }
}

// ============================================================
// === ADMIN: UPLOAD LOGA SÚŤAŽE
// ============================================================
if ($path === '/admin/upload-logo' && $method === 'POST') {
    if (empty($_FILES['logo']) || $_FILES['logo']['error'] !== UPLOAD_ERR_OK) {
        send_json(['error' => 'Nebol nahraný žiadny platný súbor'], 400);
    }

    $file = $_FILES['logo'];
    $info = @getimagesize($file['tmp_name']);
    if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP])) {
        send_json(['error' => 'Nepodporovaný formát loga (povolené: JPG, PNG, WEBP)'], 400);
    }

    $ext = ($info[2] === IMAGETYPE_PNG) ? 'png' : (($info[2] === IMAGETYPE_WEBP) ? 'webp' : 'jpg');
    $fileName = 'logo_' . time() . '.' . $ext;
    $targetPath = UPLOADS_DIR . '/' . $fileName;

    ensure_dir(UPLOADS_DIR);
    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        $logoUrl = '/uploads/' . $fileName;
        $s = read_settings();
        $s['logoUrl'] = $logoUrl;
        save_settings($s);
        dlog("ADMIN LOGO UPLOAD: saved $logoUrl");
        send_json(['success' => true, 'url' => $logoUrl]);
    } else {
        send_json(['error' => 'Nepodarilo sa uložiť logo na server'], 500);
    }
}

// ============================================================
// === ADMIN: SYSTEM RESET (FACTORY RESET)
// ============================================================
if ($path === '/admin/system-reset' && $method === 'POST') {
    $data = json_input();
    if (($data['confirm'] ?? '') !== 'SYSTEM_RESET') {
        send_json(['error' => 'Potvrdenie akcie zlyhalo. Vyžaduje sa confirm: SYSTEM_RESET.'], 400);
    }

    dlog("ADMIN: system-reset requested with valid confirmation");
    $currentToken = get_auth_token();

    // Auto-backup všetkých dát pred resetom
    ensure_dir(DATA_DIR . '/backups');
    $dataFiles = ['settings.json', 'registrations.csv', 'ratings.csv', 'public_votes.csv', 'admins.json', 'evaluators.csv', 'tokens.json'];
    foreach ($dataFiles as $df) {
        $p = DATA_DIR . '/' . $df;
        if (file_exists($p)) {
            copy($p, DATA_DIR . '/backups/' . $df . '_before_reset_' . date('Ymd_His') . '.bak');
        }
    }

    // 1. Vyčistíme uploads a uploads/originals
    $uploadsDir = UPLOADS_DIR;
    $originalsDir = ORIGINALS_DIR;
    
    if (is_dir($uploadsDir)) {
        $files = glob($uploadsDir . '/*');
        foreach ($files as $file) {
            if (is_file($file) && basename($file) !== '.gitkeep') {
                unlink($file);
            }
        }
    }
    if (is_dir($originalsDir)) {
        $files = glob($originalsDir . '/*');
        foreach ($files as $file) {
            if (is_file($file) && basename($file) !== '.gitkeep') {
                unlink($file);
            }
        }
    }

    // 2. Reset databáz (správne a konzistentné hlavičky!)
    $regHeader = "id,author,email,instagram,webpage,address,gdprConsent,rulesConsent,category,name,originalPath,webPath,description,metadata,createdAt,shortlisted";
    file_put_contents(REGISTRATIONS_CSV, $regHeader . "\n", LOCK_EX);

    $votesHeader = "photoId,createdAt,voterId";
    file_put_contents(PUBLIC_VOTES_CSV, $votesHeader . "\n", LOCK_EX);

    $ratingsHeader = "evalId,evalName,photoId,score,createdAt";
    file_put_contents(RATINGS_CSV, $ratingsHeader . "\n", LOCK_EX);

    $evalCsvHeader = "id,name,role";
    file_put_contents(EVALUATORS_CSV, $evalCsvHeader . "\n", LOCK_EX);

    $visitsHeader = "ip,userAgent,timestamp";
    if (file_exists(DATA_DIR . '/visits.csv')) {
        file_put_contents(DATA_DIR . '/visits.csv', $visitsHeader . "\n", LOCK_EX);
    }

    if (file_exists(DATA_DIR . '/invitations.json')) {
        file_put_contents(DATA_DIR . '/invitations.json', "[]", LOCK_EX);
    }

    // 3. Reset settings - vyčistíme priradené awards
    $s = read_settings();
    $s['awards'] = [];
    save_settings($s);

    // 4. Vyčistíme tokens.json, ale ponecháme AKTUÁLNY prihlasovací token
    if (file_exists(TOKENS_JSON)) {
        $tokens = json_decode(file_get_contents(TOKENS_JSON), true) ?? [];
        $newTokens = [];
        if ($currentToken && isset($tokens[$currentToken])) {
            $newTokens[$currentToken] = $tokens[$currentToken];
        }
        file_put_contents(TOKENS_JSON, json_encode($newTokens, JSON_PRETTY_PRINT), LOCK_EX);
    }

    dlog("ADMIN: system-reset completed successfully");
    $lang = $_GET['lang'] ?? 'sk';
    send_json(['success' => true, 'message' => ($lang === 'en' ? 'System reset completed successfully.' : 'Systém bol úspešne zresetovaný (Factory Reset).')]);
}

// ============================================================
// === 404
// ============================================================
dlog("404: $method $path");
send_json(['error' => 'Endpoint nenájdený', 'path' => $path], 404);

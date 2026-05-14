<?php
// PHP Bridge for Speleofotografia API
// Forward requests from Apache to Node.js server on port 3000

$ch = curl_init();
// Use UNIX socket instead of TCP port
$socketPath = dirname(__DIR__) . '/server.sock';
$url = 'http://localhost' . $_SERVER['REQUEST_URI'];

// Preposlanie vsetkych hlaviciek (headers)
$headers = [
    'X-Forwarded-Host: ' . $_SERVER['HTTP_HOST'],
    'X-Forwarded-Proto: ' . (isset($_SERVER['HTTPS']) ? 'https' : 'http'),
    'X-Real-IP: ' . $_SERVER['REMOTE_ADDR']
];

foreach (getallheaders() as $name => $value) {
    if (strtolower($name) == 'host') continue;
    $headers[] = "$name: $value";
}

curl_setopt($ch, CURLOPT_UNIX_SOCKET_PATH, $socketPath);
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD']);

if ($_SERVER['REQUEST_METHOD'] == 'POST' || $_SERVER['REQUEST_METHOD'] == 'PUT') {
    curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents('php://input'));
}

curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);

if (curl_errno($ch)) {
    http_response_code(502);
    echo json_encode(["error" => "Bridge error: " . curl_error($ch)]);
} else {
    header("Content-Type: $contentType");
    http_response_code($httpCode);
    echo $response;
}
curl_close($ch);

<?php
// Testovací skript pre Speleofotografia API
define('DATA_DIR', __DIR__ . '/production_ready/data');
define('REGISTRATIONS_CSV', DATA_DIR . '/registrations.csv');
define('RATINGS_CSV', DATA_DIR . '/ratings.csv');
define('EVALUATORS_JSON', DATA_DIR . '/evaluators.json');

function ensure_dir($dir) { if (!is_dir($dir)) mkdir($dir, 0755, true); }
function ensure_csv($file, $header) {
    if (!file_exists($file)) {
        ensure_dir(dirname($file));
        file_put_contents($file, $header . "\n");
    }
}

// 1. Simulácia registrácie
ensure_csv(REGISTRATIONS_CSV, 'id,author,email,instagram,webpage,address,gdprConsent,rulesConsent,category,name,originalPath,webPath,description,metadata,createdAt,shortlisted');
$photoId = 'test_photo_1';
$row = implode(',', [$photoId, '"Author"', '"auth@ex.com"', '""', '""', '""', 'true', 'true', '"A"', '"Test Photo"', '"orig.jpg"', '"web.webp"', '"Desc"', '"{}"', date('c'), 'true']) . "\n";
file_put_contents(REGISTRATIONS_CSV, $row, FILE_APPEND);

// 2. Simulácia vytvorenia porotcu
$evalId = 'judge_1';
$evalName = 'Judge One';
$evaluators = [['id' => $evalId, 'name' => $evalName, 'createdAt' => date('c')]];
file_put_contents(EVALUATORS_JSON, json_encode($evaluators));

// 3. Simulácia hlasovania (Jury)
ensure_csv(RATINGS_CSV, 'photoId,judgeName,judgeId,score,timestamp');
$score = 5;

$lines = file(RATINGS_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$header = array_shift($lines);
$newLines = [$header];
foreach ($lines as $line) {
    $r = str_getcsv($line);
    if (($r[0] ?? '') === $photoId && ($r[2] ?? '') === $evalId) continue;
    $newLines[] = $line;
}
$newLines[] = implode(',', [$photoId, '"' . str_replace('"', '""', $evalName) . '"', $evalId, $score, date('c')]);
file_put_contents(RATINGS_CSV, implode("\n", $newLines) . "\n");

echo "Rating written to " . RATINGS_CSV . "\n";
echo "Content:\n" . file_get_contents(RATINGS_CSV) . "\n";

// 4. Test admin/ratings logic
$grouped = [];
$lines = file(RATINGS_CSV, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
array_shift($lines);
foreach ($lines as $line) {
    $r = str_getcsv($line);
    $pid = $r[0] ?? '';
    $jname = $r[1] ?? '';
    $jid = $r[2] ?? '';
    $s = (int)($r[3] ?? 0);
    if (!$pid) continue;
    if (!isset($grouped[$pid])) $grouped[$pid] = ['photoId' => $pid, 'scores' => [], 'judges' => []];
    $grouped[$pid]['scores'][] = $s;
    $grouped[$pid]['judges'][] = ['judgeId' => $jid, 'judgeName' => $jname, 'score' => $s];
}
echo "Grouped data:\n";
print_r($grouped);

// 5. Test Export logic
$evaluators = json_decode(file_get_contents(EVALUATORS_JSON), true);
$juryScores = [];
foreach ($lines as $line) {
    $r = str_getcsv($line);
    $pid = $r[0] ?? '';
    $jid = $r[2] ?? '';
    $s = (int)($r[3] ?? 0);
    if ($pid && $jid) {
        if (!isset($juryScores[$pid])) $juryScores[$pid] = [];
        $juryScores[$pid][$jid] = $s;
    }
}

echo "Export header simulation:\n";
$headerCols = ['ID', 'Kategória', 'Názov', 'Autor', 'Email', 'Krajina', 'Rok', 'Hlasy_Verejnosti', 'Porota_Spolu'];
foreach ($evaluators as $e) {
    $headerCols[] = 'Porotca_' . str_replace(' ', '_', $e['name']);
}
echo implode(',', $headerCols) . "\n";

echo "Export row simulation:\n";
$jScores = $juryScores[$photoId] ?? [];
$jTotal = array_sum($jScores);
$row = [$photoId, 'A', 'Test Photo', 'Author', 'auth@ex.com', '', '', 0, $jTotal];
foreach ($evaluators as $e) {
    $row[] = $jScores[$e['id']] ?? '';
}
$esc = fn($v) => '"' . str_replace('"', '""', $v) . '"';
echo implode(',', array_map($esc, $row)) . "\n";

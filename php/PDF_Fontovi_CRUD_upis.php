<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}

/** Pretvara unos "latin, cyrillic" u JSON niz ["latin","cyrillic"]; prazno -> []. */
function pdf_fontovi_pisma_to_json($raw)
{
    $raw = trim((string) $raw);
    if ($raw === '') {
        return '[]';
    }
    $parts = preg_split('/[,;]+/', $raw);
    $clean = [];
    foreach ($parts as $p) {
        $p = mb_strtolower(trim($p), 'UTF-8');
        if ($p !== '' && !in_array($p, $clean, true)) {
            $clean[] = $p;
        }
    }
    return json_encode($clean, JSON_UNESCAPED_UNICODE);
}

$naziv = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
$pdfmake_kljuc = isset($_POST['pdfmake_kljuc']) ? trim($_POST['pdfmake_kljuc']) : '';
$tip = isset($_POST['tip']) ? trim($_POST['tip']) : '';
$pisma_json = pdf_fontovi_pisma_to_json($_POST['podrzana_pisma'] ?? '');
$ak_raw = isset($_POST['aktivan']) ? trim((string) $_POST['aktivan']) : '';
$aktivan = ($ak_raw === '1' || $ak_raw === 1 || $ak_raw === true) ? 1 : 0;
$napomena = isset($_POST['napomena']) ? trim($_POST['napomena']) : '';

if ($naziv === '' || $pdfmake_kljuc === '' || !in_array($tip, ['serif', 'sans', 'mono'], true)) {
    echo '105';
    exit;
}
if (mb_strlen($naziv, 'UTF-8') > 50 || mb_strlen($pdfmake_kljuc, 'UTF-8') > 50) {
    echo '105';
    exit;
}

try {
    // Provjera duplikata po nazivu i pdfmake_kljuc
    $stmt = $mysqli->prepare("SELECT id FROM pdf_fontovi WHERE LOWER(naziv) = LOWER(?) OR LOWER(pdfmake_kljuc) = LOWER(?) LIMIT 1");
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('ss', $naziv, $pdfmake_kljuc);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) {
        echo '002';
        exit;
    }
    $stmt->close();

    $stmt = $mysqli->prepare(
        'INSERT INTO pdf_fontovi (naziv, pdfmake_kljuc, tip, podrzana_pisma, aktivan, napomena)
         VALUES (?, ?, ?, ?, ?, NULLIF(TRIM(?), \'\'))'
    );
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('ssssis', $naziv, $pdfmake_kljuc, $tip, $pisma_json, $aktivan, $napomena);
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}
$mysqli->close();

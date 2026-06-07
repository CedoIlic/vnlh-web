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

$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
$naziv = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
$pdfmake_kljuc = isset($_POST['pdfmake_kljuc']) ? trim($_POST['pdfmake_kljuc']) : '';
$tip = isset($_POST['tip']) ? trim($_POST['tip']) : '';
$pisma_json = pdf_fontovi_pisma_to_json($_POST['podrzana_pisma'] ?? '');
$ak_raw = isset($_POST['aktivan']) ? trim((string) $_POST['aktivan']) : '';
$aktivan = ($ak_raw === '1' || $ak_raw === 1 || $ak_raw === true) ? 1 : 0;
$napomena = isset($_POST['napomena']) ? trim($_POST['napomena']) : '';

if ($id <= 0 || $naziv === '' || $pdfmake_kljuc === '' || !in_array($tip, ['serif', 'sans', 'mono'], true)) {
    echo '105';
    exit;
}
if (mb_strlen($naziv, 'UTF-8') > 50 || mb_strlen($pdfmake_kljuc, 'UTF-8') > 50) {
    echo '105';
    exit;
}

try {
    // Duplikat po nazivu ili pdfmake_kljuc (osim tekućeg sloga)
    $stmt = $mysqli->prepare(
        "SELECT id FROM pdf_fontovi WHERE (LOWER(naziv) = LOWER(?) OR LOWER(pdfmake_kljuc) = LOWER(?)) AND id <> ? LIMIT 1"
    );
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('ssi', $naziv, $pdfmake_kljuc, $id);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) {
        echo '002';
        exit;
    }
    $stmt->close();

    $stmt = $mysqli->prepare(
        'UPDATE pdf_fontovi
         SET naziv = ?, pdfmake_kljuc = ?, tip = ?, podrzana_pisma = ?,
             aktivan = ?, napomena = NULLIF(TRIM(?), \'\')
         WHERE id = ?'
    );
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('ssssisi', $naziv, $pdfmake_kljuc, $tip, $pisma_json, $aktivan, $napomena, $id);
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}
$mysqli->close();

<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}

/** Prima grupiranu strukturu jezika kao JSON ({"Latin":[...],...}); validira i normalizira. Prazno/nevaljano -> {}. */
function pdf_fontovi_pisma_to_json($raw)
{
    $raw = trim((string) $raw);
    if ($raw === '') {
        return '{}';
    }
    $dec = json_decode($raw, true);
    if (is_array($dec)) {
        return json_encode($dec, JSON_UNESCAPED_UNICODE);
    }
    return '{}';
}

$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
$naziv = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
$pdfmake_kljuc = isset($_POST['pdfmake_kljuc']) ? trim($_POST['pdfmake_kljuc']) : '';
$porodica = isset($_POST['porodica']) ? trim($_POST['porodica']) : '';
$tip = isset($_POST['tip']) ? trim($_POST['tip']) : '';
$pisma_json = pdf_fontovi_pisma_to_json($_POST['podrzana_pisma'] ?? '');
$ak_raw = isset($_POST['aktivan']) ? trim((string) $_POST['aktivan']) : '';
$aktivan = ($ak_raw === '1' || $ak_raw === 1 || $ak_raw === true) ? 1 : 0;
$napomena = isset($_POST['napomena']) ? trim($_POST['napomena']) : '';

if ($id <= 0 || $naziv === '' || $pdfmake_kljuc === '' || !in_array($tip, ['serif', 'sans', 'mono'], true)) {
    echo '105';
    exit;
}
if (mb_strlen($naziv, 'UTF-8') > 50 || mb_strlen($pdfmake_kljuc, 'UTF-8') > 50 || mb_strlen($porodica, 'UTF-8') > 100) {
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
         SET naziv = ?, pdfmake_kljuc = ?, porodica = ?, tip = ?, podrzana_pisma = ?,
             aktivan = ?, napomena = NULLIF(TRIM(?), \'\')
         WHERE id = ?'
    );
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('sssssisi', $naziv, $pdfmake_kljuc, $porodica, $tip, $pisma_json, $aktivan, $napomena, $id);
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}
$mysqli->close();

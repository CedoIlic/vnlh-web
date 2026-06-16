<?php
require_once __DIR__ . '/require_login_api.php';
// Servira BLOB sadržaj jednog retka (GET id): slika s pravim mime; tekst/PDF blok kao text/plain.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    http_response_code(500);
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($id <= 0) {
    header('Content-Type: text/plain');
    echo '108,' . $id;
    exit;
}
$stmt = $mysqli->prepare('SELECT podatak, tip_podatka, mime FROM sustav_slike_tekstovi WHERE id = ? LIMIT 1');
if (!$stmt) {
    http_response_code(500);
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id);
$stmt->execute();
$result = $stmt->get_result();
$row = $result ? $result->fetch_assoc() : null;
$stmt->close();
$mysqli->close();

if (!$row) {
    header('Content-Type: text/plain');
    echo '108,' . $id;
    exit;
}
if ($row['podatak'] === null || $row['podatak'] === '') {
    http_response_code(200);
    exit;
}
if (sst_je_slika_tip($row['tip_podatka'])) {
    $mime = !empty($row['mime']) ? trim($row['mime']) : 'application/octet-stream';
    header('Content-Type: ' . $mime);
} else {
    header('Content-Type: text/plain; charset=utf-8');
}
echo $row['podatak'];

/** Lokalna provjera (ne uključujemo _polja.php zbog jednostavnosti servera). */
function sst_je_slika_tip($tip)
{
    return in_array($tip, ['Slika JPG', 'Slika PNG', 'Slika WEBP'], true);
}

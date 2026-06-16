<?php
require_once __DIR__ . '/require_login_api.php';
// Servira BLOB iz sustav_slike_tekstovi po NAZIVU (samo prijavljeni korisnik).
// Slika -> mime iz baze; tekst/PDF blok -> text/plain. Cache: ETag (md5) + Cache-Control: no-cache
// (revalidacija -> 304 dok je nepromijenjeno, izmjena odmah vidljiva). Nema retka -> 404.

$naziv = isset($_GET['naziv']) ? trim((string) $_GET['naziv']) : '';
if ($naziv === '') {
    header('Cache-Control: no-store');
    http_response_code(404);
    exit;
}

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Cache-Control: no-store');
    http_response_code(500);
    exit;
}

$stmt = $mysqli->prepare('SELECT mime, tip_podatka, podatak, MD5(podatak) AS etag FROM sustav_slike_tekstovi WHERE naziv = ? AND podatak IS NOT NULL LIMIT 1');
if (!$stmt) {
    header('Cache-Control: no-store');
    http_response_code(500);
    exit;
}
$stmt->bind_param('s', $naziv);
$stmt->execute();
$res = $stmt->get_result();
$row = $res ? $res->fetch_assoc() : null;
$stmt->close();
$mysqli->close();

if (!$row || $row['podatak'] === null || $row['podatak'] === '') {
    header('Cache-Control: no-store');
    http_response_code(404);
    exit;
}

$etag = '"' . $row['etag'] . '"';
header('ETag: ' . $etag);
header('Cache-Control: no-cache');

$ifNoneMatch = isset($_SERVER['HTTP_IF_NONE_MATCH']) ? trim($_SERVER['HTTP_IF_NONE_MATCH']) : '';
if ($ifNoneMatch !== '' && $ifNoneMatch === $etag) {
    http_response_code(304);
    exit;
}

$jeSlika = in_array($row['tip_podatka'], array('Slika JPG', 'Slika PNG', 'Slika WEBP'), true);
if ($jeSlika) {
    $mime = !empty($row['mime']) ? trim($row['mime']) : 'application/octet-stream';
    header('Content-Type: ' . $mime);
} else {
    header('Content-Type: text/plain; charset=utf-8');
}
header('Content-Length: ' . strlen($row['podatak']));
echo $row['podatak'];

<?php
// Public serve endpoint za zastave država (sustav_slike_tekstovi preko sustav_drzave.slika_naziv).
// Zastave su javni simboli; bez logina (kao modal_ikona.php), uz strogu validaciju koda.
// Cache: ETag (md5 sadrzaja) + Cache-Control no-cache; If-None-Match -> 304. Nema slike -> 404 (placeholder).

$kod = isset($_GET['kod']) ? strtolower(trim((string) $_GET['kod'])) : '';
if (!preg_match('/^[a-z]{2}$/', $kod)) {
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

$stmt = $mysqli->prepare(
    'SELECT s.mime, s.podatak, MD5(s.podatak) AS etag
       FROM sustav_drzave d
       JOIN sustav_slike_tekstovi s ON s.naziv = d.slika_naziv
      WHERE d.kod = ? AND s.podatak IS NOT NULL
      LIMIT 1'
);
if (!$stmt) {
    header('Cache-Control: no-store');
    http_response_code(500);
    exit;
}
$stmt->bind_param('s', $kod);
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

$mime = !empty($row['mime']) ? trim($row['mime']) : 'image/png';
header('Content-Type: ' . $mime);
header('Content-Length: ' . strlen($row['podatak']));
echo $row['podatak'];

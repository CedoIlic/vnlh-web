<?php
// Public serve endpoint za ikone modala poruka (sustav_slike_tekstovi).
// BEZ logina: modali se prikazuju i prije prijave. Whitelist: samo 5 fiksnih stanja -> rezervirani naziv.
// Cache: ETag (md5 sadrzaja) + Cache-Control public, max-age; If-None-Match -> 304. Nema retka -> 404 (bez ikone).

$mapa = array(
    'ok'          => 'Modal ikona OK',
    'error'       => 'Modal ikona Greska',
    'forbidden'   => 'Modal ikona Zabranjeno',
    'information' => 'Modal ikona Informacija',
    'warning'     => 'Modal ikona Upozorenje',
);

$stanje = isset($_GET['stanje']) ? strtolower(trim((string) $_GET['stanje'])) : '';
if (!isset($mapa[$stanje])) {
    header('Cache-Control: no-store');
    http_response_code(404);
    exit;
}
$naziv = $mapa[$stanje];

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Cache-Control: no-store');
    http_response_code(500);
    exit;
}

$stmt = $mysqli->prepare('SELECT mime, podatak, MD5(podatak) AS etag FROM sustav_slike_tekstovi WHERE naziv = ? AND podatak IS NOT NULL LIMIT 1');
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
// no-cache: preglednik smije keširati, ali MORA revalidirati (If-None-Match) -> 304 dok je ikona nepromijenjena,
// a admin izmjena (novi ETag) je odmah vidljiva. Slika se ne preuzima ponovo (304 je bez tijela).
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

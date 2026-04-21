<?php
require_once __DIR__ . '/require_login_api.php';
// Clanovi_CRUD_slika.php – dohvat slike člana (GET id). Stub: vraća 108 ako nema slike.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    http_response_code(500);
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($id <= 0) {
    header('Content-Type: text/plain');
    echo '108,' . $id;
    exit;
}
$sql = "SELECT slika, slika_mime FROM clanovi WHERE id = ? LIMIT 1";
$stmt = $mysqli->prepare($sql);
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
if ($row['slika'] === null || $row['slika'] === '') {
    http_response_code(200);
    exit;
}
$mime = !empty($row['slika_mime']) ? trim($row['slika_mime']) : 'application/octet-stream';
header('Cache-Control: private, max-age=3600');
header('Content-Type: ' . $mime);
echo $row['slika'];

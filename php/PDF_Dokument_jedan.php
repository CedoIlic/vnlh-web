<?php
require_once __DIR__ . '/require_login_api.php';
// Jedan dokument: zaglavlje (pdf_dokument) + sve stavke (pdf_dokument_stavke) za uređivanje u formi.
$db_ret = require_once __DIR__ . '/00_db.php';
header('Content-Type: application/json; charset=utf-8');
if ($db_ret !== -1) {
    http_response_code(500);
    echo json_encode(['greska' => $db_ret]);
    exit;
}
$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($id <= 0) {
    echo json_encode(['greska' => '105']);
    exit;
}

$stmt = $mysqli->prepare('SELECT * FROM pdf_dokument WHERE id = ? LIMIT 1');
$stmt->bind_param('i', $id);
$stmt->execute();
$res = $stmt->get_result();
$dokument = $res ? $res->fetch_assoc() : null;
$stmt->close();
if (!$dokument) {
    echo json_encode(['greska' => '108']);
    exit;
}

$stmt = $mysqli->prepare('SELECT * FROM pdf_dokument_stavke WHERE dokument_id = ? ORDER BY redoslijed ASC, id ASC');
$stmt->bind_param('i', $id);
$stmt->execute();
$res = $stmt->get_result();
$stavke = [];
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $stavke[] = $row;
    }
}
$stmt->close();
$mysqli->close();

echo json_encode(['dokument' => $dokument, 'stavke' => $stavke], JSON_UNESCAPED_UNICODE);

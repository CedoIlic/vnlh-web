<?php
// PDF_Dozvoljeni_izvori_dokumenata_CRUD_kolone_sve.php — dozvoljene kolone za izvor (?izvor_id=X).
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
header('Content-Type: application/json; charset=utf-8');
$izvorId = isset($_GET['izvor_id']) ? (int) $_GET['izvor_id'] : 0;
if ($izvorId <= 0) { echo '[]'; exit; }

$stmt = $mysqli->prepare('SELECT id, kolona FROM pdf_dozvoljeni_izvori_dokumenata_kolone WHERE id_izvor = ? ORDER BY kolona');
if (!$stmt) { echo '[]'; exit; }
$stmt->bind_param('i', $izvorId);
$stmt->execute();
$res = $stmt->get_result();
$out = [];
while ($r = $res->fetch_assoc()) {
    $out[] = ['id' => (int) $r['id'], 'kolona' => $r['kolona']];
}
$stmt->close();
echo json_encode($out, JSON_UNESCAPED_UNICODE);
$mysqli->close();

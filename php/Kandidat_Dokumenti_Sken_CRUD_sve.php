<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_Sken_CRUD_sve.php – lista skenova kandidata (GET id_clan). BEZ BLOB-a (samo meta).
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

$id_clan = isset($_GET['id_clan']) ? (int) $_GET['id_clan'] : 0;
if ($id_clan <= 0) { header('Content-Type: application/json'); echo '[]'; exit; }

$sql = "SELECT s.id, s.id_sken_tip, t.naziv AS tip_naziv, s.biljeska, s.podatak_mime, s.datum_upisa
        FROM kandidat_dokumenti_sken s
        LEFT JOIN kandidat_dokumenti_sken_tip t ON t.id = s.id_sken_tip
        WHERE s.id_clan = ?
        ORDER BY t.redosljed ASC, t.naziv ASC, s.id ASC";
$stmt = $mysqli->prepare($sql);
if (!$stmt) { header('Content-Type: text/plain'); echo '200,' . $mysqli->errno; exit; }
$stmt->bind_param('i', $id_clan);
$stmt->execute();
$res = $stmt->get_result();
$rows = [];
while ($row = $res->fetch_assoc()) { $rows[] = $row; }
$stmt->close();
$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
?>

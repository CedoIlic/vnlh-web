<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_Zapisnik_CRUD_sve.php – lista vezanih zapisnika kandidata (GET id_clan).
// Vraća polja za prikaz retka: {Datum, stupanj}, {tip}, {biljeska} (string se gradi na klijentu).
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

$id_clan = isset($_GET['id_clan']) ? (int) $_GET['id_clan'] : 0;
if ($id_clan <= 0) { header('Content-Type: application/json'); echo '[]'; exit; }

$sql = "SELECT z.id, z.id_zapisnik, z.id_zapisnik_tip, z.biljeska,
               t.naziv AS tip_naziv,
               zsr.datum_radova,
               s.stupanj AS stupanj_broj,
               s.naziv   AS stupanj_naziv
        FROM kandidat_dokumenti_zapisnik z
        LEFT JOIN kandidat_dokumenti_zapisnik_tip t ON t.id = z.id_zapisnik_tip
        LEFT JOIN zapisnik_sa_radova zsr ON zsr.id = z.id_zapisnik
        LEFT JOIN stupnjevi s ON s.id = zsr.id_stupanj
        WHERE z.id_clan = ?
        ORDER BY zsr.datum_radova DESC, z.id DESC";
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

<?php
require_once __DIR__ . '/require_login_api.php';
// Clanovi_MOK_CRUD_clanovi.php — popis članova za tablicu forme MOK (GET id_loza).
// SAMO puni članovi odabrane lože: aktivnost = 1 AND kandidat = 0 (kandidati nemaju MOK).
// Vraća minimum za prikaz retka + broj vidljivih bilješki (badge/oznaka nije obavezna, ali je jeftina).
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

$id_loza = isset($_GET['id_loza']) ? (int) $_GET['id_loza'] : 0;
if ($id_loza <= 0) { header('Content-Type: application/json'); echo '[]'; exit; }

$sql = "SELECT c.id, c.prezime, c.ime, c.loza, c.stupanj,
               s.stupanj AS stupanj_broj, s.naziv AS stupanj_naziv,
               l.id_obred AS id_obred, l.naziv AS loza_naziv, l.grad AS loza_grad
        FROM clanovi c
        LEFT JOIN stupnjevi s ON s.id = c.stupanj
        LEFT JOIN loze l ON l.id = c.loza
        WHERE c.loza = ? AND c.aktivnost = 1 AND c.kandidat = 0
        ORDER BY c.prezime ASC, c.ime ASC";
$stmt = $mysqli->prepare($sql);
if (!$stmt) { header('Content-Type: text/plain'); echo '200,' . $mysqli->errno; exit; }
$stmt->bind_param('i', $id_loza);
$stmt->execute();
$res = $stmt->get_result();
$rows = [];
while ($row = $res->fetch_assoc()) { $rows[] = $row; }
$stmt->close();
$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);

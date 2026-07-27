<?php
require_once __DIR__ . '/require_login_api.php';
// Clanovi_MOK_CRUD_clanovi.php — popis članova za tablicu forme MOK (GET id_loza).
// SAMO puni članovi odabrane lože: aktivnost = 1 AND kandidat = 0 (kandidati nemaju MOK).
// Uz svakog člana ide `broj_biljeski` — brojka po ISTOM pravilu vidljivosti kao popis bilješki:
//   • radna razina    → samo VLASTITE bilješke zapisane u loži u kojoj je autor i sada;
//   • kontrolna razina (sustav_varijable 127) → SVE bilješke o tom članu, bez obzira na autora.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }
require_once __DIR__ . '/Clanovi_MOK_CRUD_prava.php';

$id_loza = isset($_GET['id_loza']) ? (int) $_GET['id_loza'] : 0;
if ($id_loza <= 0) { header('Content-Type: application/json'); echo '[]'; exit; }

$ja = (int) ($_SESSION['id_korisnik'] ?? 0);
$kontrolna = mok_kontrolna_razina($mysqli);
$mojaLoza = mok_moja_loza($mysqli);

$brojSql = $kontrolna
    ? "(SELECT COUNT(*) FROM clanovi_mok m WHERE m.id_clan = c.id)"
    : "(SELECT COUNT(*) FROM clanovi_mok m WHERE m.id_clan = c.id AND m.upisao = ? AND m.id_loza_upisao = ?)";

$sql = "SELECT c.id, c.prezime, c.ime, c.loza, c.stupanj,
               s.stupanj AS stupanj_broj, s.naziv AS stupanj_naziv,
               l.id_obred AS id_obred, l.naziv AS loza_naziv, l.grad AS loza_grad,
               $brojSql AS broj_biljeski
        FROM clanovi c
        LEFT JOIN stupnjevi s ON s.id = c.stupanj
        LEFT JOIN loze l ON l.id = c.loza
        WHERE c.loza = ? AND c.aktivnost = 1 AND c.kandidat = 0
        ORDER BY c.prezime ASC, c.ime ASC";
$stmt = $mysqli->prepare($sql);
if (!$stmt) { header('Content-Type: text/plain'); echo '200,' . $mysqli->errno; exit; }
/* Redoslijed bindanja prati redoslijed upitnika u SQL-u: podupit u SELECT-u ide PRIJE WHERE-a. */
if ($kontrolna) $stmt->bind_param('i', $id_loza);
else $stmt->bind_param('iii', $ja, $mojaLoza, $id_loza);
$stmt->execute();
$res = $stmt->get_result();
$rows = [];
while ($row = $res->fetch_assoc()) { $rows[] = $row; }
$stmt->close();
$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);

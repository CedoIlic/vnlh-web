<?php
require_once __DIR__ . '/require_login_api.php';
// Clanovi_MOK_CRUD_sve.php — bilješke odabranog člana (GET id_clan), s primijenjenom DISKRECIJOM.
// Radna razina: samo vlastite bilješke zapisane u loži u kojoj sam i sada (id_loza_upisao = moja loža).
// Kontrolna razina (varijabla 127): sve bilješke, ali bez prava izmjene/brisanja.
// Svaki redak nosi `smijem_mijenjati` (autor + unutar roka) — klijent po tome gasi ikone.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }
require_once __DIR__ . '/Clanovi_MOK_CRUD_prava.php';

$id_clan = isset($_GET['id_clan']) ? (int) $_GET['id_clan'] : 0;
if ($id_clan <= 0) { header('Content-Type: application/json'); echo json_encode(['kontrolna' => false, 'rok_mjeseci' => 0, 'redovi' => []]); exit; }

$ja = (int) ($_SESSION['id_korisnik'] ?? 0);
$kontrolna = mok_kontrolna_razina($mysqli);
$rok = mok_rok_mjeseci($mysqli);
$mojaLoza = mok_moja_loza($mysqli);

$sqlBase = "SELECT m.id, m.id_clan, m.tekst, m.datum_upisa, m.datum_zadnje_izmjene,
                   m.upisao, m.id_loza_upisao, m.id_loza_clan,
                   a.prezime AS autor_prezime, a.ime AS autor_ime,
                   d.naziv AS autor_duznost
            FROM clanovi_mok m
            LEFT JOIN clanovi a ON a.id = m.upisao
            LEFT JOIN duznosnici d ON d.id = m.upisao_duznost
            WHERE m.id_clan = ?";

if ($kontrolna) {
    $sql = $sqlBase . " ORDER BY m.datum_upisa DESC, m.id DESC";
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) { header('Content-Type: text/plain'); echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param('i', $id_clan);
} else {
    // Radna razina: autor sam JA i bilješka je nastala u loži u kojoj sam i sada.
    $sql = $sqlBase . " AND m.upisao = ? AND m.id_loza_upisao = ? ORDER BY m.datum_upisa DESC, m.id DESC";
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) { header('Content-Type: text/plain'); echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param('iii', $id_clan, $ja, $mojaLoza);
}
$stmt->execute();
$res = $stmt->get_result();
$rows = [];
while ($row = $res->fetch_assoc()) {
    $svoja = ((int) $row['upisao'] === $ja);
    $row['moja'] = $svoja ? 1 : 0;
    // Izmjena/brisanje: samo autor i samo u roku. Kontrolna razina nad tuđim zapisom = 0.
    $row['smijem_mijenjati'] = ($svoja && mok_u_roku($row['datum_upisa'], $rok)) ? 1 : 0;
    $rows[] = $row;
}
$stmt->close();
$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'kontrolna'   => $kontrolna ? 1 : 0,
    'rok_mjeseci' => $rok,
    'redovi'      => $rows
], JSON_UNESCAPED_UNICODE);

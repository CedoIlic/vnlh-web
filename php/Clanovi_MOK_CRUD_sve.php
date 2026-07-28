<?php
require_once __DIR__ . '/require_login_api.php';
// Clanovi_MOK_CRUD_sve.php — bilješke odabranog člana (GET id_clan), s primijenjenom DISKRECIJOM.
// Radna razina: vlastite bilješke (upisao = ja) zapisane pod dužnošću pod kojom sam sada ulogiran
//   (upisao_duznost = sesijska dužnost) i to samo dok je član još u loži iz zapisa (clanovi.loza = id_loza_clan).
// Kontrolna razina (varijabla 127): sve bilješke, ali bez prava izmjene/brisanja.
// Svaki redak nosi `smijem_mijenjati` (vidljivo po radnoj razini + unutar roka) — klijent po tome gasi ikone.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }
require_once __DIR__ . '/Clanovi_MOK_CRUD_prava.php';

$id_clan = isset($_GET['id_clan']) ? (int) $_GET['id_clan'] : 0;
if ($id_clan <= 0) { header('Content-Type: application/json'); echo json_encode(['kontrolna' => false, 'rok_mjeseci' => 0, 'redovi' => []]); exit; }

$ja = (int) ($_SESSION['id_korisnik'] ?? 0);
$kontrolna = mok_kontrolna_razina($mysqli);
$rok = mok_rok_mjeseci($mysqli);
$mojaDuznost = mok_moja_duznost();

$sqlBase = "SELECT m.id, m.id_clan, m.tekst, m.datum_upisa, m.datum_zadnje_izmjene,
                   m.upisao, m.upisao_duznost, m.id_loza_upisao, m.id_loza_clan,
                   c.loza AS clan_loza_sada,
                   a.prezime AS autor_prezime, a.ime AS autor_ime,
                   d.naziv AS autor_duznost
            FROM clanovi_mok m
            LEFT JOIN clanovi c ON c.id = m.id_clan
            LEFT JOIN clanovi a ON a.id = m.upisao
            LEFT JOIN duznosnici d ON d.id = m.upisao_duznost
            WHERE m.id_clan = ?";

if ($kontrolna) {
    $sql = $sqlBase . " ORDER BY m.datum_upisa DESC, m.id DESC";
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) { header('Content-Type: text/plain'); echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param('i', $id_clan);
} else {
    // Radna razina: autor sam JA, ulogiran pod istom dužnošću, i član je još u loži iz zapisa.
    $sql = $sqlBase . " AND m.upisao = ? AND m.upisao_duznost = ? AND m.id_loza_clan = c.loza
                        ORDER BY m.datum_upisa DESC, m.id DESC";
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) { header('Content-Type: text/plain'); echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param('iii', $id_clan, $ja, $mojaDuznost);
}
$stmt->execute();
$res = $stmt->get_result();
$rows = [];
while ($row = $res->fetch_assoc()) {
    $svoja = ((int) $row['upisao'] === $ja);
    $row['moja'] = $svoja ? 1 : 0;
    // Izmjena/brisanje: vidljivo po radnoj razini (autor + ista dužnost + član u loži iz zapisa) i u roku.
    // Kontrolna razina nad tuđim zapisom = 0; isto i nad vlastitim ako je gledam pod drugom dužnošću.
    $row['smijem_mijenjati'] = (mok_vidljiva_radna($row) && mok_u_roku($row['datum_upisa'], $rok)) ? 1 : 0;
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

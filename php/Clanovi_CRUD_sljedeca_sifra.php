<?php
require_once __DIR__ . '/require_login_api.php';
// Clanovi_CRUD_sljedeca_sifra.php – vraća sljedeću slobodnu šifru iskaznice za državu.
// GET id_loza – ID lože; država se dohvaća iz tablice loze (id_drzava). Šifra format YYYY-NNNNNN (godina + serijski 6 znamenki).
// Iz tablice clanovi uzimamo sve šifre za tu državu, desni dio (iza "-"), najveći + 1, formatiran s vodećim nulama.
// Izlaz: text/plain, npr. "2025-000043" ili kod greške (100, 105).

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: text/plain; charset=utf-8');

$id_loza = isset($_GET['id_loza']) ? (int)$_GET['id_loza'] : 0;
if ($id_loza <= 0) {
    echo '105';
    exit;
}
$stmt = $mysqli->prepare("SELECT id_drzava FROM loze WHERE id = ? LIMIT 1");
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id_loza);
$stmt->execute();
$res = $stmt->get_result();
$row_loza = $res ? $res->fetch_assoc() : null;
$stmt->close();
if (!$row_loza || !isset($row_loza['id_drzava']) || (string)$row_loza['id_drzava'] === '') {
    echo '105';
    exit;
}
$id_drzava = (int)$row_loza['id_drzava'];
if ($id_drzava <= 0) {
    echo '105';
    exit;
}

$stmt = $mysqli->prepare("SELECT sifra FROM clanovi WHERE drzava = ? AND sifra IS NOT NULL AND TRIM(sifra) != ''");
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id_drzava);
$stmt->execute();
$result = $stmt->get_result();
$max = 0;
while ($row = $result->fetch_assoc()) {
    $sifra = isset($row['sifra']) ? trim((string)$row['sifra']) : '';
    if ($sifra === '') continue;
    $parts = explode('-', $sifra, 2);
    if (count($parts) < 2) continue;
    $right = trim($parts[1]);
    if ($right === '' || !ctype_digit($right)) continue;
    $num = (int)$right;
    if ($num > $max) $max = $num;
}
$stmt->close();
$mysqli->close();

$nextNum = $max + 1;
$yyyy = date('Y');
$nextSifra = $yyyy . '-' . str_pad((string)$nextNum, 6, '0', STR_PAD_LEFT);
echo $nextSifra;

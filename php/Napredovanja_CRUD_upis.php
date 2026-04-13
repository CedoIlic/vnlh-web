<?php
require_once __DIR__ . '/require_login_api.php';
// Napredovanja_CRUD_upis.php – upis novog napredovanja za člana.
// POST: id_clanovi (obavezno), id_stupanj (obavezno), id_tip_napredovanja (prazno = NULL),
//      id_loza_napredovanja (prazno = NULL), loza_napredovanja (prazno = NULL, max 50), datum_napredovanja (prazno = NULL).
// Izlaz (TEXT): OK | 100 | 105 | 200,errno

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$id_clanovi         = isset($_POST['id_clanovi']) ? (int)$_POST['id_clanovi'] : 0;
$id_stupanj         = isset($_POST['id_stupanj']) ? (int)$_POST['id_stupanj'] : 0;
$id_tip_napredovanja = isset($_POST['id_tip_napredovanja']) ? (int)$_POST['id_tip_napredovanja'] : 0;
$id_loza_raw        = isset($_POST['id_loza_napredovanja']) ? trim((string)$_POST['id_loza_napredovanja']) : '';
$loza_napredovanja  = isset($_POST['loza_napredovanja']) ? trim((string)$_POST['loza_napredovanja']) : '';
$datum_raw          = isset($_POST['datum_napredovanja']) ? trim((string)$_POST['datum_napredovanja']) : '';

if ($id_clanovi <= 0 || $id_stupanj <= 0) {
    echo '105';
    exit;
}
if (mb_strlen($loza_napredovanja) > 50) {
    echo '105';
    exit;
}

$id_loza_napredovanja = null;
if ($id_loza_raw !== '') {
    $v = (int)$id_loza_raw;
    if ($v > 0) {
        $id_loza_napredovanja = $v;
    }
}

$datum_napredovanja = ($datum_raw === '') ? null : $datum_raw;
$loza_val = ($loza_napredovanja === '') ? null : $loza_napredovanja;

// bind_param ne podržava NULL za integer; šaljemo 0 pa u SQL upisujemo NULL za 0
$id_loza_bind = $id_loza_napredovanja !== null ? $id_loza_napredovanja : 0;
$datum_bind = $datum_napredovanja !== null ? $datum_napredovanja : '';
$loza_napredovanja_bind = $loza_val !== null ? $loza_val : '';

$id_tip_bind = $id_tip_napredovanja > 0 ? $id_tip_napredovanja : 0;
$sql = "INSERT INTO napredovanja (id_clanovi, id_stupanj, id_tip_napredovanja, id_loza_napredovanja, datum_napredovanja, loza_napredovanja)
        VALUES (?, ?, NULLIF(?, 0), NULLIF(?, 0), NULLIF(?, ''), NULLIF(?, ''))";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}

$stmt->bind_param('iiiiss', $id_clanovi, $id_stupanj, $id_tip_bind, $id_loza_bind, $datum_bind, $loza_napredovanja_bind);
if ($stmt->execute()) {
    echo 'OK';
} else {
    echo '200,' . $stmt->errno;
}
$stmt->close();
$mysqli->close();

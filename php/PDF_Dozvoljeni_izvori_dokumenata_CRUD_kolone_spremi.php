<?php
// PDF_Dozvoljeni_izvori_dokumenata_CRUD_kolone_spremi.php
// Zamijeni (replace) skup dozvoljenih kolona za izvor. POST: izvor_id, kolone (JSON niz naziva).
// Transakcijski: DELETE sve za izvor → INSERT validne (postoje u tablici, nisu BLOB/TEXT).
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}

$izvorId = isset($_POST['izvor_id']) ? (int) $_POST['izvor_id'] : 0;
$koloneRaw = isset($_POST['kolone']) ? (string) $_POST['kolone'] : '[]';
if ($izvorId <= 0) { echo '105'; exit; }
$kolone = json_decode($koloneRaw, true);
if (!is_array($kolone)) $kolone = [];

try {
    // Izvor → tablica.
    $st = $mysqli->prepare('SELECT tablica FROM pdf_dozvoljeni_izvori_dokumenata WHERE id = ? LIMIT 1');
    if (!$st) { echo '200,' . $mysqli->errno; exit; }
    $st->bind_param('i', $izvorId);
    $st->execute();
    $rs = $st->get_result();
    $row = $rs ? $rs->fetch_assoc() : null;
    $st->close();
    if (!$row) { echo '105'; exit; }
    $tablica = $row['tablica'];

    // Filtriraj na valjane kolone (ident + postoji u tablici + nije BLOB/TEXT), bez duplikata.
    $valjane = [];
    $vidjene = [];
    foreach ($kolone as $kol) {
        $kol = is_string($kol) ? trim($kol) : '';
        if (!preg_match('/^[A-Za-z0-9_]{1,64}$/', $kol)) continue;
        if (isset($vidjene[$kol])) continue;
        $stc = $mysqli->prepare(
            "SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
               AND DATA_TYPE NOT IN ('blob','tinyblob','mediumblob','longblob','text','tinytext','mediumtext','longtext')
             LIMIT 1");
        if (!$stc) { echo '200,' . $mysqli->errno; exit; }
        $stc->bind_param('ss', $tablica, $kol);
        $stc->execute();
        $stc->store_result();
        $ok = $stc->num_rows > 0;
        $stc->close();
        if ($ok) { $valjane[] = $kol; $vidjene[$kol] = true; }
    }

    $mysqli->begin_transaction();
    $st = $mysqli->prepare('DELETE FROM pdf_dozvoljeni_izvori_dokumenata_kolone WHERE id_izvor = ?');
    $st->bind_param('i', $izvorId);
    $st->execute();
    $st->close();
    if (!empty($valjane)) {
        $st = $mysqli->prepare('INSERT INTO pdf_dozvoljeni_izvori_dokumenata_kolone (id_izvor, kolona) VALUES (?, ?)');
        foreach ($valjane as $kol) {
            $st->bind_param('is', $izvorId, $kol);
            $st->execute();
        }
        $st->close();
    }
    $mysqli->commit();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    try { $mysqli->rollback(); } catch (Throwable $e2) {}
    echo '200,' . $e->getCode();
}
$mysqli->close();

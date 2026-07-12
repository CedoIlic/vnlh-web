<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_Razgovori_CRUD_brisanje.php – brisanje jednog razgovora kandidata.
// POST JSON { id, id_clan }. Vraća 'OK' ili kod greške (105 ulaz, 200,<errno> SQL).
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
header('Content-Type: text/plain; charset=utf-8');

$raw = file_get_contents('php://input');
$d   = $raw ? json_decode($raw, true) : null;
if (!is_array($d)) { echo '105'; exit; }

$id      = isset($d['id']) && $d['id'] !== '' ? (int) $d['id'] : 0;
$id_clan = isset($d['id_clan']) && $d['id_clan'] !== '' ? (int) $d['id_clan'] : 0;
if ($id <= 0 || $id_clan <= 0) { echo '105'; exit; }

try {
    $stmt = $mysqli->prepare('DELETE FROM kandidat_dokumenti_razgovori WHERE id = ? AND id_clan = ?');
    $stmt->bind_param('ii', $id, $id_clan);
    $stmt->execute();
    $stmt->close();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}

$mysqli->close();

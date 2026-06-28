<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_CRUD_spremi.php – upsert životopisa kandidata (1:1 po id_clan).
// POST JSON { id_clan, zivotopis }. Vraća 'OK' ili kod greške (105 ulaz, 200,<errno> SQL).

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
header('Content-Type: text/plain; charset=utf-8');

$raw = file_get_contents('php://input');
$d   = $raw ? json_decode($raw, true) : null;
if (!is_array($d)) { echo '105'; exit; }

$id_clan = isset($d['id_clan']) && $d['id_clan'] !== '' ? (int) $d['id_clan'] : 0;
if ($id_clan <= 0) { echo '105'; exit; }

$zivotopis = isset($d['zivotopis']) ? trim((string) $d['zivotopis']) : '';
$zivotopis = ($zivotopis !== '') ? $zivotopis : null;

try {
    // 1:1 po članu (UNIQUE id_clan) → INSERT ... ON DUPLICATE KEY UPDATE.
    $stmt = $mysqli->prepare('
        INSERT INTO kandidat_dokumenti_zivotopis (id_clan, zivotopis)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE zivotopis = VALUES(zivotopis)
    ');
    $stmt->bind_param('is', $id_clan, $zivotopis);
    $stmt->execute();
    $stmt->close();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}

$mysqli->close();

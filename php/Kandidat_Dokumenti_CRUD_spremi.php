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

// upisao/vrijeme_upisa: pune se SAMO kod prvog upisa (INSERT), ne kod izmjene
// (zato nisu u ON DUPLICATE KEY UPDATE) — isto kao kod eseja.
$upisao = (int) ($_SESSION['id_korisnik'] ?? 0) ?: null;

try {
    // id_loza: denormalizirano iz clanovi.loza (most za PDF logo/ime lože u jednom skoku).
    // Postavlja se i na upisu i na izmjeni (ostaje u sync s ložom člana).
    // 1:1 po članu (UNIQUE id_clan) → INSERT ... ON DUPLICATE KEY UPDATE.
    $stmt = $mysqli->prepare('
        INSERT INTO kandidat_dokumenti_zivotopis (id_clan, id_loza, zivotopis, upisao, vrijeme_upisa)
        VALUES (?, (SELECT loza FROM clanovi WHERE id = ?), ?, ?, NOW())
        ON DUPLICATE KEY UPDATE zivotopis = VALUES(zivotopis), id_loza = VALUES(id_loza)
    ');
    $stmt->bind_param('iisi', $id_clan, $id_clan, $zivotopis, $upisao);
    $stmt->execute();
    $stmt->close();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}

$mysqli->close();

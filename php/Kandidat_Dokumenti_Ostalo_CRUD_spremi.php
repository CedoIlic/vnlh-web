<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_Ostalo_CRUD_spremi.php – upsert zapisa taba „Ostalo" (1:1 po id_clan).
// POST JSON { id_clan, planirani_datum_inicijacije, ispis_imena_kandidata, napomena }.
// Vraća 'OK' ili kod greške (105 ulaz, 200,<errno> SQL).

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
header('Content-Type: text/plain; charset=utf-8');

$raw = file_get_contents('php://input');
$d   = $raw ? json_decode($raw, true) : null;
if (!is_array($d)) { echo '105'; exit; }

$id_clan = isset($d['id_clan']) && $d['id_clan'] !== '' ? (int) $d['id_clan'] : 0;
if ($id_clan <= 0) { echo '105'; exit; }

$napomena = isset($d['napomena']) ? trim((string) $d['napomena']) : '';
$napomena = ($napomena !== '') ? $napomena : null;

// Datum: prazno → NULL; prihvaća se samo ISO oblik iz <input type="date">.
$datum = isset($d['planirani_datum_inicijacije']) ? trim((string) $d['planirani_datum_inicijacije']) : '';
if ($datum === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $datum)) $datum = null;

$ispis = isset($d['ispis_imena_kandidata']) && (string) $d['ispis_imena_kandidata'] === '0' ? 0 : 1;

try {
    // 1:1 po članu (UNIQUE id_clan) → INSERT ... ON DUPLICATE KEY UPDATE.
    $stmt = $mysqli->prepare('
        INSERT INTO kandidat_dokumenti_ostalo (id_clan, planirani_datum_inicijacije, ispis_imena_kandidata, napomena)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            planirani_datum_inicijacije = VALUES(planirani_datum_inicijacije),
            ispis_imena_kandidata = VALUES(ispis_imena_kandidata),
            napomena = VALUES(napomena)
    ');
    $stmt->bind_param('isis', $id_clan, $datum, $ispis, $napomena);
    $stmt->execute();
    $stmt->close();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}

$mysqli->close();

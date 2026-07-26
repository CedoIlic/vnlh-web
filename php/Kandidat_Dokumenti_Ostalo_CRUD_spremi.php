<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_Ostalo_CRUD_spremi.php – upsert zapisa taba „Ostalo" (1:1 po id_clan).
// POST JSON { id_clan, planirani_datum_inicijacije, ispis_imena_kandidata, urudzbeni_broj,
//             datum_dokumenta_101, loza_pridruzivana, datum_objave_do, napomena }.
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

// Obrazac 101: urudžbeni broj (max 50 znakova) + datum dokumenta (isti tretman kao datum inicijacije).
$ur_broj = isset($d['urudzbeni_broj']) ? trim((string) $d['urudzbeni_broj']) : '';
$ur_broj = ($ur_broj !== '') ? mb_substr($ur_broj, 0, 50) : null;

$datum101 = isset($d['datum_dokumenta_101']) ? trim((string) $d['datum_dokumenta_101']) : '';
if ($datum101 === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $datum101)) $datum101 = null;

// Loža pridruživanja: ništa izabrano → NULL (FK provjerava postoji li loža).
$loza_prid = isset($d['loza_pridruzivana']) ? (int) $d['loza_pridruzivana'] : 0;
$loza_prid = ($loza_prid > 0) ? $loza_prid : null;

$datum_objave = isset($d['datum_objave_do']) ? trim((string) $d['datum_objave_do']) : '';
if ($datum_objave === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $datum_objave)) $datum_objave = null;

try {
    // 1:1 po članu (UNIQUE id_clan) → INSERT ... ON DUPLICATE KEY UPDATE.
    $stmt = $mysqli->prepare('
        INSERT INTO kandidat_dokumenti_ostalo
            (id_clan, planirani_datum_inicijacije, ispis_imena_kandidata, urudzbeni_broj, datum_dokumenta_101,
             loza_pridruzivana, datum_objave_do, napomena)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            planirani_datum_inicijacije = VALUES(planirani_datum_inicijacije),
            ispis_imena_kandidata = VALUES(ispis_imena_kandidata),
            urudzbeni_broj = VALUES(urudzbeni_broj),
            datum_dokumenta_101 = VALUES(datum_dokumenta_101),
            loza_pridruzivana = VALUES(loza_pridruzivana),
            datum_objave_do = VALUES(datum_objave_do),
            napomena = VALUES(napomena)
    ');
    $stmt->bind_param('isississ', $id_clan, $datum, $ispis, $ur_broj, $datum101, $loza_prid, $datum_objave, $napomena);
    $stmt->execute();
    $stmt->close();

    // Mostovi za PDF na kandidat_dokumenti_001 (engine zna samo JEDAN skok, pa dokument s jednim
    // kontekstom do „Ostalog" dolazi preko ovih kolona). Osvježavaju se OVDJE jer forma sprema
    // „Ostalo" NAKON 001a — tamošnji subupiti bi inače uhvatili stanje prije ovog upisa.
    // Ako 001a red još ne postoji, UPDATE ne dira ništa; postavit će ga 001a pri sljedećem spremanju.
    $upd = $mysqli->prepare('
        UPDATE kandidat_dokumenti_001 k
           SET k.id_ostalo = (SELECT o.id FROM kandidat_dokumenti_ostalo o WHERE o.id_clan = k.id_clan LIMIT 1),
               k.id_loza_pridruzivana = (SELECT o2.loza_pridruzivana FROM kandidat_dokumenti_ostalo o2 WHERE o2.id_clan = k.id_clan LIMIT 1)
         WHERE k.id_clan = ?');
    $upd->bind_param('i', $id_clan);
    $upd->execute();
    $upd->close();

    echo 'OK';
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}

$mysqli->close();

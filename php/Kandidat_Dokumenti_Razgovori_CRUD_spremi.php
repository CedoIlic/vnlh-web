<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_Razgovori_CRUD_spremi.php – upis/izmjena razgovora kandidata (1:N).
// POST JSON { id (0=novi), id_clan, id_ispitivac, datum_razgovora (Y-m-d), naslov, tekst }.
// INSERT: puni id_loza (denorm iz clanovi.loza) + upisao/vrijeme_upisa (kao životopis, samo na upisu).
// UPDATE: mijenja naslov/datum/ispitivač/tekst + resync id_loza; NE dira upisao/vrijeme_upisa.
// Vraća 'OK|<id>' (id upisanog/izmijenjenog reda) ili kod greške (105 ulaz, 200,<errno> SQL).
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
header('Content-Type: text/plain; charset=utf-8');

$raw = file_get_contents('php://input');
$d   = $raw ? json_decode($raw, true) : null;
if (!is_array($d)) { echo '105'; exit; }

$id      = isset($d['id']) && $d['id'] !== '' ? (int) $d['id'] : 0;
$id_clan = isset($d['id_clan']) && $d['id_clan'] !== '' ? (int) $d['id_clan'] : 0;
if ($id_clan <= 0) { echo '105'; exit; }

$id_ispitivac = isset($d['id_ispitivac']) && $d['id_ispitivac'] !== '' ? (int) $d['id_ispitivac'] : null;
$datum = isset($d['datum_razgovora']) ? trim((string) $d['datum_razgovora']) : '';
if ($datum === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $datum)) { echo '105'; exit; }
$naslov = isset($d['naslov']) ? trim((string) $d['naslov']) : '';
$tekst  = isset($d['tekst']) ? trim((string) $d['tekst']) : '';
$tekst  = ($tekst !== '') ? $tekst : null;

$upisao = (int) ($_SESSION['id_korisnik'] ?? 0) ?: null;

try {
    if ($id > 0) {
        // Izmjena; id_loza (kandidat) i id_loza_ispitivac (ispitivač) se resinkroniziraju.
        $stmt = $mysqli->prepare('
            UPDATE kandidat_dokumenti_razgovori
               SET id_ispitivac = ?, datum_razgovora = ?, naslov = ?, tekst = ?,
                   id_loza = (SELECT loza FROM clanovi WHERE id = ?),
                   id_loza_ispitivac = (SELECT loza FROM clanovi WHERE id = ?)
             WHERE id = ? AND id_clan = ?
        ');
        $stmt->bind_param('isssiiii', $id_ispitivac, $datum, $naslov, $tekst, $id_clan, $id_ispitivac, $id, $id_clan);
        $stmt->execute();
        $stmt->close();
        echo 'OK|' . $id;
    } else {
        $stmt = $mysqli->prepare('
            INSERT INTO kandidat_dokumenti_razgovori
                (id_clan, id_ispitivac, id_loza, id_loza_ispitivac, datum_razgovora, naslov, tekst, upisao, vrijeme_upisa)
            VALUES (?, ?, (SELECT loza FROM clanovi WHERE id = ?), (SELECT loza FROM clanovi WHERE id = ?), ?, ?, ?, ?, NOW())
        ');
        $stmt->bind_param('iiiisssi', $id_clan, $id_ispitivac, $id_clan, $id_ispitivac, $datum, $naslov, $tekst, $upisao);
        $stmt->execute();
        $new_id = $stmt->insert_id;
        $stmt->close();
        echo 'OK|' . $new_id;
    }
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}

$mysqli->close();

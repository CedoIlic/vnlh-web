<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_001_CRUD_spremi.php – upsert Obrasca 001a kandidata (1:1 po id_clan).
// POST JSON { id_clan, mjesto_rodjenja, drzava_rodjenja, drzavljanstvo, zvanje, zanimanje,
//   gradjanski_status, broj_djece, poznavanje_jezika, pocasni_naslovi,
//   dijete_masona, veza_masoni, zahtjev_druga_loza, primljen_iniciran, datum_dokumenta }.
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

// Tekstualna polja (trim; prazno ostaje '' jer su NOT NULL DEFAULT '').
$mjesto_rodjenja   = isset($d['mjesto_rodjenja'])   ? trim((string) $d['mjesto_rodjenja'])   : '';
$drzava_rodjenja   = isset($d['drzava_rodjenja'])   ? trim((string) $d['drzava_rodjenja'])   : '';
$drzavljanstvo     = isset($d['drzavljanstvo'])     ? trim((string) $d['drzavljanstvo'])     : '';
$zvanje            = isset($d['zvanje'])            ? trim((string) $d['zvanje'])            : '';
$zanimanje         = isset($d['zanimanje'])         ? trim((string) $d['zanimanje'])         : '';
$gradjanski_status = isset($d['gradjanski_status']) ? trim((string) $d['gradjanski_status']) : '';
$poznavanje_jezika = isset($d['poznavanje_jezika']) ? trim((string) $d['poznavanje_jezika']) : '';
$pocasni_naslovi   = isset($d['pocasni_naslovi'])   ? trim((string) $d['pocasni_naslovi'])   : '';

// Broj djece: null kad prazno; inače klamp 0–255 (tinyint unsigned).
$broj_djece = null;
if (isset($d['broj_djece']) && $d['broj_djece'] !== '' && $d['broj_djece'] !== null) {
    $bd = (int) $d['broj_djece'];
    if ($bd < 0) $bd = 0;
    if ($bd > 255) $bd = 255;
    $broj_djece = $bd;
}

// Da/Ne (0/1).
$dijete_masona      = !empty($d['dijete_masona'])      ? 1 : 0;
$veza_masoni        = !empty($d['veza_masoni'])        ? 1 : 0;
$zahtjev_druga_loza = !empty($d['zahtjev_druga_loza']) ? 1 : 0;

// Status: samo dozvoljene vrijednosti enuma; inače NULL.
$primljen_iniciran = null;
if (isset($d['primljen_iniciran'])) {
    $pi = trim((string) $d['primljen_iniciran']);
    if ($pi === 'Primljen' || $pi === 'Iniciran') $primljen_iniciran = $pi;
}

// Datum dokumenta: prihvati YYYY-MM-DD; inače NULL.
$datum_dokumenta = null;
if (isset($d['datum_dokumenta'])) {
    $dd = trim((string) $d['datum_dokumenta']);
    if ($dd !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dd)) $datum_dokumenta = $dd;
}

// upisao/datum_upisa: SAMO na prvom upisu (INSERT), ne na izmjeni (izvan ON DUPLICATE KEY UPDATE).
$upisao = (int) ($_SESSION['id_korisnik'] ?? 0) ?: null;

try {
    // id_loza: denormalizirano iz clanovi.loza (most za PDF). Postavlja se i na upisu i na izmjeni.
    // 1:1 po članu (UNIQUE id_clan) → INSERT ... ON DUPLICATE KEY UPDATE.
    $sql = 'INSERT INTO kandidat_dokumenti_001
                (id_clan, id_loza, mjesto_rodjenja, drzava_rodjenja, drzavljanstvo, zvanje, zanimanje,
                 gradjanski_status, broj_djece, poznavanje_jezika, pocasni_naslovi,
                 dijete_masona, veza_masoni, zahtjev_druga_loza, primljen_iniciran, datum_dokumenta,
                 upisao, datum_upisa)
            VALUES (?, (SELECT loza FROM clanovi WHERE id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                id_loza = VALUES(id_loza),
                mjesto_rodjenja = VALUES(mjesto_rodjenja),
                drzava_rodjenja = VALUES(drzava_rodjenja),
                drzavljanstvo = VALUES(drzavljanstvo),
                zvanje = VALUES(zvanje),
                zanimanje = VALUES(zanimanje),
                gradjanski_status = VALUES(gradjanski_status),
                broj_djece = VALUES(broj_djece),
                poznavanje_jezika = VALUES(poznavanje_jezika),
                pocasni_naslovi = VALUES(pocasni_naslovi),
                dijete_masona = VALUES(dijete_masona),
                veza_masoni = VALUES(veza_masoni),
                zahtjev_druga_loza = VALUES(zahtjev_druga_loza),
                primljen_iniciran = VALUES(primljen_iniciran),
                datum_dokumenta = VALUES(datum_dokumenta)';
    $stmt = $mysqli->prepare($sql);
    $stmt->bind_param(
        'iissssssissiiissi',
        $id_clan, $id_clan,
        $mjesto_rodjenja, $drzava_rodjenja, $drzavljanstvo, $zvanje, $zanimanje,
        $gradjanski_status, $broj_djece, $poznavanje_jezika, $pocasni_naslovi,
        $dijete_masona, $veza_masoni, $zahtjev_druga_loza, $primljen_iniciran, $datum_dokumenta,
        $upisao
    );
    $stmt->execute();
    $stmt->close();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}

$mysqli->close();

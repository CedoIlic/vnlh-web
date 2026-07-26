<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_001b_CRUD_spremi.php – upsert Obrasca 001b u kandidat_dokumenti_001 (1:1 po id_clan;
// dijeli redak s 001a). Dira SAMO 001b kolone (+ id_loza most, upisao/datum_upisa na prvom upisu).
// POST JSON { id_clan, predlagaci:[id,...], glasanje_1:{datum,glasaca,za,protiv,suzdrzani}, glasanje_2, glasanje_3,
//   datum_razmatranja, datum_odbijanja, casni_id, sekretar_id, vip_id }.
// Kodiranje glasanja: "datum,glasača,za,protiv,suzdržani"; prazno polje → -1; cijeli stupac prazan → NULL.
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

// Predlagači: niz id-eva → "id,id,..." (samo pozitivni cijeli), NULL ako nijedan.
$predlagaci = null;
if (isset($d['predlagaci']) && is_array($d['predlagaci'])) {
    $ids = [];
    foreach ($d['predlagaci'] as $v) {
        $iv = (int) $v;
        if ($iv > 0) $ids[] = $iv;
    }
    if (count($ids) > 0) $predlagaci = implode(',', $ids);
}

// Glasanje: "datum,glasača,za,protiv,suzdržani"; prazno polje → -1; cijeli stupac prazan → NULL.
function encode_glasanje($g) {
    if (!is_array($g)) return null;
    $datumRaw = isset($g['datum']) ? trim((string) $g['datum']) : '';
    $numKeys  = ['glasaca', 'za', 'protiv', 'suzdrzani'];
    $anyFilled = ($datumRaw !== '');
    $parts = [];
    $parts[] = ($datumRaw === '') ? '-1' : (preg_match('/^\d{4}-\d{2}-\d{2}$/', $datumRaw) ? $datumRaw : '-1');
    foreach ($numKeys as $k) {
        $v = isset($g[$k]) ? trim((string) $g[$k]) : '';
        if ($v === '') { $parts[] = '-1'; }
        else { $anyFilled = true; $n = (int) $v; if ($n < 0) $n = 0; $parts[] = (string) $n; }
    }
    return $anyFilled ? implode(',', $parts) : null;
}
$glasanje_1 = encode_glasanje($d['glasanje_1'] ?? null);
$glasanje_2 = encode_glasanje($d['glasanje_2'] ?? null);
$glasanje_3 = encode_glasanje($d['glasanje_3'] ?? null);

// Datumi: YYYY-MM-DD ili NULL.
function datum_ili_null($v) {
    $s = isset($v) ? trim((string) $v) : '';
    return ($s !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) ? $s : null;
}
$datum_razmatranja = datum_ili_null($d['datum_razmatranja'] ?? '');
$datum_odbijanja   = datum_ili_null($d['datum_odbijanja'] ?? '');

// Razlog odbijanja: SAMO ako je datum_odbijanja valjan i tekst nije prazan; inače NULL. Max 1024.
$razlog_raw = isset($d['razlog_odbijanja']) ? trim((string) $d['razlog_odbijanja']) : '';
$razlog_odbijanja = ($datum_odbijanja !== null && $razlog_raw !== '') ? mb_substr($razlog_raw, 0, 1024) : null;

// Časni majstor / VIP: id člana ili NULL (FK na clanovi provjerava postojanje).
$casni_id = isset($d['casni_id']) && $d['casni_id'] !== '' ? (int) $d['casni_id'] : 0;
$casni_id = $casni_id > 0 ? $casni_id : null;
$sekretar_id = isset($d['sekretar_id']) && $d['sekretar_id'] !== '' ? (int) $d['sekretar_id'] : 0;
$sekretar_id = $sekretar_id > 0 ? $sekretar_id : null;
$vip_id   = isset($d['vip_id']) && $d['vip_id'] !== '' ? (int) $d['vip_id'] : 0;
$vip_id   = $vip_id > 0 ? $vip_id : null;

// upisao/datum_upisa: SAMO na prvom upisu (INSERT), ne na izmjeni (izvan ON DUPLICATE KEY UPDATE).
$upisao = (int) ($_SESSION['id_korisnik'] ?? 0) ?: null;

try {
    // 1:1 po članu (UNIQUE id_clan) → INSERT ... ON DUPLICATE KEY UPDATE; id_loza most iz clanovi.loza.
    // Na prvom upisu (npr. prije 001a) 001a kolone dobiju DEFAULT; izmjena dira samo 001b kolone.
    $sql = 'INSERT INTO kandidat_dokumenti_001
                (id_clan, id_loza, predlagaci, glasanje_1, glasanje_2, glasanje_3,
                 datum_razmatranja, datum_odbijanja, razlog_odbijanja, casni_id, sekretar_id, vip_id, upisao, datum_upisa)
            VALUES (?, (SELECT loza FROM clanovi WHERE id = ?),
                 ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                id_loza = VALUES(id_loza),
                predlagaci = VALUES(predlagaci),
                glasanje_1 = VALUES(glasanje_1),
                glasanje_2 = VALUES(glasanje_2),
                glasanje_3 = VALUES(glasanje_3),
                datum_razmatranja = VALUES(datum_razmatranja),
                datum_odbijanja = VALUES(datum_odbijanja),
                razlog_odbijanja = VALUES(razlog_odbijanja),
                casni_id = VALUES(casni_id),
                sekretar_id = VALUES(sekretar_id),
                vip_id = VALUES(vip_id)';
    $stmt = $mysqli->prepare($sql);
    // i id_clan, i id_clan(subupit loza), s predlagaci, s g1, s g2, s g3, s dat_razm, s dat_odb, s razlog, i casni, i sekretar, i vip, i upisao
    $stmt->bind_param(
        'iisssssssiiii',
        $id_clan, $id_clan,
        $predlagaci, $glasanje_1, $glasanje_2, $glasanje_3,
        $datum_razmatranja, $datum_odbijanja, $razlog_odbijanja, $casni_id, $sekretar_id, $vip_id,
        $upisao
    );
    $stmt->execute();
    $stmt->close();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}

$mysqli->close();

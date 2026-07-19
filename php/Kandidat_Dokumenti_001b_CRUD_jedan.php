<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_001b_CRUD_jedan.php – učitavanje Obrasca 001b za kandidata (GET id_clan).
// Čita 001b kolone iz kandidat_dokumenti_001; razrješava predlagaci/casni_id/vip_id u podatke člana
// (prezime, ime, loža, grad, stupanj + id_obred za klijentski filter stupnja). Glasanja parsira u objekte.
// Vraća JSON { postoji, predlagaci:[...], glasanje_1/2/3:{...}, datum_razmatranja, datum_odbijanja, casni, vip }.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

$id_clan = isset($_GET['id_clan']) ? (int) $_GET['id_clan'] : 0;
header('Content-Type: application/json; charset=utf-8');
if ($id_clan <= 0) { echo json_encode(['postoji' => false]); $mysqli->close(); exit; }

// Glasanje string → objekt (mjesta: datum, glasača, za, protiv, suzdržani; -1 → '').
function decode_glasanje($s) {
    $out = ['datum' => '', 'glasaca' => '', 'za' => '', 'protiv' => '', 'suzdrzani' => ''];
    if ($s === null || $s === '') return $out;
    $p = explode(',', $s);
    $keys = ['datum', 'glasaca', 'za', 'protiv', 'suzdrzani'];
    for ($i = 0; $i < 5; $i++) {
        $v = isset($p[$i]) ? trim($p[$i]) : '';
        $out[$keys[$i]] = ($v === '-1') ? '' : $v;
    }
    return $out;
}

$sql = 'SELECT predlagaci, glasanje_1, glasanje_2, glasanje_3, datum_razmatranja, datum_odbijanja, razlog_odbijanja, casni_id, vip_id
        FROM kandidat_dokumenti_001 WHERE id_clan = ? LIMIT 1';
$stmt = $mysqli->prepare($sql);
if (!$stmt) { echo json_encode(['postoji' => false]); $mysqli->close(); exit; }
$stmt->bind_param('i', $id_clan);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$row) { echo json_encode(['postoji' => false]); $mysqli->close(); exit; }

// postoji = redak u PARENTU (kandidat_dokumenti_001) već postoji za ovog kandidata → CRUD oznaka „Izmjeni".
// 001a i 001b dijele isti redak: ako je bilo koji od njih djelomično upisan, radi se o izmjeni, ne novom upisu.
// (Ovaj upit ide FROM kandidat_dokumenti_001, pa vraćeni $row po definiciji znači da parent postoji.)
$postoji = true;

// Skupi sve id-eve članova (predlagači + časni + VIP) za jedan dohvat.
$predIds = [];
if ($row['predlagaci'] !== null && $row['predlagaci'] !== '') {
    foreach (explode(',', $row['predlagaci']) as $part) {
        $iv = (int) trim($part);
        if ($iv > 0) $predIds[] = $iv;
    }
}
$casniId = $row['casni_id'] !== null ? (int) $row['casni_id'] : 0;
$vipId   = $row['vip_id'] !== null ? (int) $row['vip_id'] : 0;

$sviIds = $predIds;
if ($casniId > 0) $sviIds[] = $casniId;
if ($vipId > 0)   $sviIds[] = $vipId;
$sviIds = array_values(array_unique(array_filter($sviIds, static function ($v) { return $v > 0; })));

// Dohvat podataka članova (id-evi su cijeli brojevi iz baze → sigurno umetanje u IN).
$clanMap = [];
if (count($sviIds) > 0) {
    $inList = implode(',', array_map('intval', $sviIds));
    $q = "SELECT c.id, c.prezime, c.ime, c.loza AS id_loza, l.naziv AS loza_naziv, l.grad AS loza_grad,
                 c.stupanj, s.stupanj AS stupanj_broj, s.naziv AS stupanj_naziv, l.id_obred AS id_obred
          FROM clanovi c
          LEFT JOIN loze l ON l.id = c.loza
          LEFT JOIN stupnjevi s ON s.id = c.stupanj
          WHERE c.id IN ($inList)";
    if ($res = $mysqli->query($q)) {
        while ($r = $res->fetch_assoc()) { $clanMap[(string) $r['id']] = $r; }
        $res->free();
    }
}

// Predlagači u SPREMLJENOM redoslijedu (preskoči id-eve bez podatka — npr. obrisani član).
$predlagaci = [];
foreach ($predIds as $pid) {
    if (isset($clanMap[(string) $pid])) $predlagaci[] = $clanMap[(string) $pid];
}
$casni = ($casniId > 0 && isset($clanMap[(string) $casniId])) ? $clanMap[(string) $casniId] : null;
$vip   = ($vipId > 0 && isset($clanMap[(string) $vipId])) ? $clanMap[(string) $vipId] : null;

echo json_encode([
    'postoji'           => $postoji,
    'predlagaci'        => $predlagaci,
    'glasanje_1'        => decode_glasanje($row['glasanje_1']),
    'glasanje_2'        => decode_glasanje($row['glasanje_2']),
    'glasanje_3'        => decode_glasanje($row['glasanje_3']),
    'datum_razmatranja' => $row['datum_razmatranja'] !== null ? $row['datum_razmatranja'] : '',
    'datum_odbijanja'   => $row['datum_odbijanja'] !== null ? $row['datum_odbijanja'] : '',
    'razlog_odbijanja'  => $row['razlog_odbijanja'] !== null ? $row['razlog_odbijanja'] : '',
    'casni'             => $casni,
    'vip'               => $vip,
], JSON_UNESCAPED_UNICODE);

$mysqli->close();

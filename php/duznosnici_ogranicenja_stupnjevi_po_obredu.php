<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// duznosnici_ogranicenja_stupnjevi_po_obredu.php
// Dohvat dozvoljenih stupnjeva po obredu za dužnosnika (duznosnici_ogranicenja, tip 6).
// =====================================================
//
// Ulaz (GET):
//   id_duznosnik (opcionalno) – eksplicitni ID (npr. Duznosnici_Ogranicenja_CRUD pri uređivanju sloga).
//   id_duznosnik_test (opcionalno) – kao Duznosnici_Drzave_Regije_Loze_sve (Alati_Meni_Test).
//   Bez parametara: $_SESSION['id_duznosnik'] (npr. Lista članova).
// Prioritet: id_duznosnik_test > id_duznosnik > sesija.
//
// Izlaz (JSON objekt): ključ = id obreda (string),
//   vrijednost = {
//     "tekst": "1, 2, 3",
//     "id_stupnjeva": ["5","7"],
//     "stupnjevi": [ { "id": "5", "stupanj": 1, "naziv": "…" }, … ]  // za prikaz/zamjenu na klijentu (Lista)
//   }
//   tekst = brojevi stupnjeva (stupnjevi.stupanj), join ', '
//   id_stupnjeva = stupnjevi.id (modal selectedRowIds)
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$idDuznosnikTest = isset($_GET['id_duznosnik_test']) ? (int) $_GET['id_duznosnik_test'] : 0;
$idDuznosnikGet = isset($_GET['id_duznosnik']) ? (int) $_GET['id_duznosnik'] : 0;
if ($idDuznosnikTest > 0) {
    $id_duznosnik = $idDuznosnikTest;
} elseif ($idDuznosnikGet > 0) {
    $id_duznosnik = $idDuznosnikGet;
} else {
    $id_duznosnik = isset($_SESSION['id_duznosnik']) ? (int) $_SESSION['id_duznosnik'] : 0;
}

if ($id_duznosnik <= 0) {
    echo '{}';
    $mysqli->close();
    exit;
}

$sql = 'SELECT o.id_tip_obred_funkcionalnost AS obred_id, s.id AS stupanj_id, s.stupanj, s.naziv AS stupanj_naziv
        FROM duznosnici_ogranicenja o
        INNER JOIN stupnjevi s ON s.id = CAST(NULLIF(TRIM(o.vrijednost), \'\') AS UNSIGNED)
        WHERE o.id_duznosnik = ?
          AND o.id_tip_ogranicenja = 6
          AND o.id_tip_obred_funkcionalnost IS NOT NULL
          AND o.id_tip_obred_funkcionalnost > 0
        ORDER BY o.id_tip_obred_funkcionalnost ASC, s.stupanj ASC, s.id ASC';

$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    $mysqli->close();
    exit;
}
$stmt->bind_param('i', $id_duznosnik);
if (!$stmt->execute()) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    $stmt->close();
    $mysqli->close();
    exit;
}

$res = $stmt->get_result();
// obred_id => [ stupnjevi.id => [ 'stupanj' => int, 'naziv' => str ] ]
$grouped = [];
while ($row = $res->fetch_assoc()) {
    $oid = (int) ($row['obred_id'] ?? 0);
    if ($oid <= 0) {
        continue;
    }
    $key = (string) $oid;
    $sid = (int) ($row['stupanj_id'] ?? 0);
    $st = (int) ($row['stupanj'] ?? 0);
    if ($sid <= 0) {
        continue;
    }
    if (!isset($grouped[$key])) {
        $grouped[$key] = [];
    }
    $grouped[$key][$sid] = [
        'stupanj' => $st,
        'naziv' => (string) ($row['stupanj_naziv'] ?? ''),
    ];
}
$stmt->close();

$out = [];
foreach ($grouped as $oid => $idToMeta) {
    $stupnjeviOut = [];
    foreach ($idToMeta as $sid => $meta) {
        $stupnjeviOut[] = [
            'id' => (string) $sid,
            'stupanj' => (int) ($meta['stupanj'] ?? 0),
            'naziv' => (string) ($meta['naziv'] ?? ''),
        ];
    }
    usort($stupnjeviOut, static function ($x, $y) {
        if ($x['stupanj'] !== $y['stupanj']) {
            return $x['stupanj'] <=> $y['stupanj'];
        }

        return strcmp((string) $x['id'], (string) $y['id']);
    });
    $brojevi = array_map(static function ($r) {
        return $r['stupanj'];
    }, $stupnjeviOut);
    $out[$oid] = [
        'tekst' => implode(', ', $brojevi),
        'id_stupnjeva' => array_map(static function ($r) {
            return $r['id'];
        }, $stupnjeviOut),
        'stupnjevi' => $stupnjeviOut,
    ];
}

$mysqli->close();
echo json_encode($out, JSON_UNESCAPED_UNICODE);

<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// duznosnici_ogranicenja_stupnjevi_po_obredu.php
// Dohvat dozvoljenih stupnjeva po obredu za dužnosnika (duznosnici_ogranicenja, tip 6).
// =====================================================
//
// Ulaz (GET): id_duznosnik (obavezno)
//
// Izlaz (JSON objekt): ključ = id obreda (string),
//   vrijednost = { "tekst": "1, 2, 3", "id_stupnjeva": ["5","7"] }
//   tekst = brojevi stupnjeva (stupnjevi.stupanj) kao u Loze_Tip editu, join ', '
//   id_stupnjeva = stupnjevi.id za modal (selectedRowIds)
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$id_duznosnik = isset($_GET['id_duznosnik']) ? (int)$_GET['id_duznosnik'] : 0;
if ($id_duznosnik <= 0) {
    echo '{}';
    $mysqli->close();
    exit;
}

$sql = 'SELECT o.id_tip_obred_funkcionalnost AS obred_id, s.id AS stupanj_id, s.stupanj
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
// obred_id => [ stupnjevi.id => stupnjevi.stupanj ] (zadnji pobjeđuje pri duplikatu u bazi)
$grouped = [];
while ($row = $res->fetch_assoc()) {
    $oid = (int)($row['obred_id'] ?? 0);
    if ($oid <= 0) {
        continue;
    }
    $key = (string)$oid;
    $sid = (int)($row['stupanj_id'] ?? 0);
    $st = (int)($row['stupanj'] ?? 0);
    if ($sid <= 0) {
        continue;
    }
    if (!isset($grouped[$key])) {
        $grouped[$key] = [];
    }
    $grouped[$key][$sid] = $st;
}
$stmt->close();

$out = [];
foreach ($grouped as $oid => $idToStupanj) {
    asort($idToStupanj);
    $out[$oid] = [
        'tekst' => implode(', ', array_values($idToStupanj)),
        'id_stupnjeva' => array_map('strval', array_keys($idToStupanj)),
    ];
}

$mysqli->close();
echo json_encode($out, JSON_UNESCAPED_UNICODE);

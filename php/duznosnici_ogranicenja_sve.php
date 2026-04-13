<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// duznosnici_ogranicenja_sve.php
// Forma Duznosnici_Ogranicenja_CRUD – prva tablica (prava dužnika).
// Tablica duznosnici_prava: duznost → duznosnici(id), pravo → meni(id).
// =====================================================
//
// Tablica duznosnici_ogranicenja
// ---------------------------------------------------------------------------
// id_duznosnik                  – id dužnosnika čija su ograničenja u pitanju
// id_tip_ogranicenja            – id ograničenja:
//                                 1 = država, 2 = regija, 3 = loža,
//                                 4, 5 = edit/delete po funkcionalnosti
//                                 (4 = upisi-zamjeni, 5 = izbriši),
//                                 6 = obredi
// id_tip_obred_funkcionalnost   – za tip 6: id obreda (prikaz stupnja);
//                                 za tip 4 i 5: id menija (pravo / funkcionalnost)
// vrijednost                    – status ograničenja
// ---------------------------------------------------------------------------
// id_duznosnik                  int(11), NOT NULL
// id_tip_ogranicenja            smallint, NOT NULL
// id_tip_obred_funkcionalnost   int(11), NULL
// vrijednost                    NULL
// =====================================================
//
// Ulaz (GET):
//   id_duznosnik (obavezno) – ID dužnosnika
//
// Izlaz (JSON objekt):
//   id_drzave, id_regije, id_loze – nizovi cijelih brojeva iz duznosnici_ogranicenja
//     (id_tip_ogranicenja 1 = država, 2 = regija, 3 = loža; vrijednost = ID entiteta).
//   prava – [ { "upis_izmjena", "brisanje_sloga", "funkcionalnost", "id" }, ... ]
//     id = meni.id (pravo); funkcionalnost = meni.opis (prazan opis → naziv).
//     upis_izmjena / brisanje_sloga: tip 4 / 5, id menija u id_tip_obred_funkcionalnost, stanje u vrijednost.
//   Isključeni su izvršni meniji (meni_tip_id = var. 105) bez roditelja (roditelj NULL/0).
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
    echo json_encode([
        'id_drzave' => [],
        'id_regije' => [],
        'id_loze' => [],
        'prava' => [],
    ], JSON_UNESCAPED_UNICODE);
    $mysqli->close();
    exit;
}

// --- Države / regije / lože spremljene u duznosnici_ogranicenja ---
$id_drzave = [];
$id_regije = [];
$id_loze = [];
$sqlGr = 'SELECT DISTINCT id_tip_ogranicenja, vrijednost
          FROM duznosnici_ogranicenja
          WHERE id_duznosnik = ? AND id_tip_ogranicenja IN (1, 2, 3)
          ORDER BY id_tip_ogranicenja, CAST(vrijednost AS UNSIGNED), vrijednost';
$stmtGr = $mysqli->prepare($sqlGr);
if (!$stmtGr) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    $mysqli->close();
    exit;
}
$stmtGr->bind_param('i', $id_duznosnik);
if (!$stmtGr->execute()) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    $stmtGr->close();
    $mysqli->close();
    exit;
}
$resGr = $stmtGr->get_result();
while ($rowGr = $resGr->fetch_assoc()) {
    $tip = isset($rowGr['id_tip_ogranicenja']) ? (int)$rowGr['id_tip_ogranicenja'] : 0;
    $vid = isset($rowGr['vrijednost']) ? (int)$rowGr['vrijednost'] : 0;
    if ($vid <= 0) {
        continue;
    }
    if ($tip === 1) {
        $id_drzave[] = $vid;
    } elseif ($tip === 2) {
        $id_regije[] = $vid;
    } elseif ($tip === 3) {
        $id_loze[] = $vid;
    }
}
$stmtGr->close();

/**
 * Pretvara vrijednost iz duznosnici_ogranicenja u 0/1 za checkbox.
 */
function duznosnici_ogranicenja_vrijednost_u_cekbox($v)
{
    if ($v === null) {
        return 0;
    }
    $t = trim((string)$v);
    if ($t === '' || $t === '0') {
        return 0;
    }
    return ((int)$t) !== 0 ? 1 : 0;
}

/**
 * Za id_tip_ogranicenja 4 (upis) ili 5 (brisanje): mapa meni.id → 0/1.
 * Id menija (prava) je u id_tip_obred_funkcionalnost; stanje checkboxa iz kolone vrijednost.
 */
function duznosnici_ogranicenja_mapa_funkcionalnost($mysqli, $id_duznosnik, $id_tip)
{
    $map = [];
    $sql = 'SELECT id_tip_obred_funkcionalnost, vrijednost
            FROM duznosnici_ogranicenja
            WHERE id_duznosnik = ? AND id_tip_ogranicenja = ?
              AND id_tip_obred_funkcionalnost IS NOT NULL AND id_tip_obred_funkcionalnost > 0';
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        return $map;
    }
    $stmt->bind_param('ii', $id_duznosnik, $id_tip);
    if (!$stmt->execute()) {
        $stmt->close();
        return $map;
    }
    $res = $stmt->get_result();
    while ($r = $res->fetch_assoc()) {
        $f = (int)$r['id_tip_obred_funkcionalnost'];
        $map[$f] = duznosnici_ogranicenja_vrijednost_u_cekbox($r['vrijednost'] ?? null);
    }
    $stmt->close();
    return $map;
}

$mapUpis = duznosnici_ogranicenja_mapa_funkcionalnost($mysqli, $id_duznosnik, 4);
$mapBrisanje = duznosnici_ogranicenja_mapa_funkcionalnost($mysqli, $id_duznosnik, 5);

// --- Tip izvršnog menija = sustav_varijable id 105 (isto kao Duznosnici_Prava_CRUD_sve.php) ---
$izvrsniTipId = null;
$stmtVar = $mysqli->prepare("SELECT varijabla FROM sustav_varijable WHERE id = 105 LIMIT 1");
if ($stmtVar) {
    $stmtVar->execute();
    $resVar = $stmtVar->get_result();
    if ($resVar->num_rows > 0) {
        $rowVar = $resVar->fetch_assoc();
        $v = isset($rowVar['varijabla']) ? trim((string)$rowVar['varijabla']) : '';
        if ($v !== '' && $v !== '0') {
            $izvrsniTipId = (int)$v;
        }
    }
    $stmtVar->close();
}

$excludeKorijenIzvrsnog = ($izvrsniTipId !== null && $izvrsniTipId > 0)
    ? " AND NOT (m.meni_tip_id = ? AND (m.roditelj IS NULL OR m.roditelj = 0))"
    : '';

$sql = "SELECT COALESCE(NULLIF(TRIM(m.opis), ''), m.naziv, '') AS funkcionalnost,
        m.id AS id
        FROM duznosnici_prava dp
        INNER JOIN meni m ON m.id = dp.pravo
        WHERE dp.duznost = ?" . $excludeKorijenIzvrsnog . "
        ORDER BY m.naziv ASC";

$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    $mysqli->close();
    exit;
}

if ($excludeKorijenIzvrsnog !== '') {
    $stmt->bind_param('ii', $id_duznosnik, $izvrsniTipId);
} else {
    $stmt->bind_param('i', $id_duznosnik);
}

if (!$stmt->execute()) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    $stmt->close();
    $mysqli->close();
    exit;
}

$result = $stmt->get_result();
$out = [];
while ($row = $result->fetch_assoc()) {
    $mid = (int)$row['id'];
    $out[] = [
        'upis_izmjena' => isset($mapUpis[$mid]) ? (int)$mapUpis[$mid] : 0,
        'brisanje_sloga' => isset($mapBrisanje[$mid]) ? (int)$mapBrisanje[$mid] : 0,
        'funkcionalnost' => $row['funkcionalnost'] ?? '',
        'id' => $mid,
    ];
}

$stmt->close();

$payload = [
    'id_drzave' => $id_drzave,
    'id_regije' => $id_regije,
    'id_loze' => $id_loze,
    'prava' => $out,
];

$mysqli->close();

echo json_encode($payload, JSON_UNESCAPED_UNICODE);

<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// duznosnici_ogranicenja_upis.php
// Cjeloviti upis ograničenja dužnosnika (forma Duznosnici_Ogranicenja_CRUD).
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
// Ulaz (POST, JSON): {
//   "id_duznosnik" (obavezno),
//   "id_drzave", "id_regije", "id_loze" – nizovi pozitivnih cijelih brojeva (tip 1 / 2 / 3; vrijednost = id entiteta; id_tip_obred_funkcionalnost NULL),
//   "prava" – [ { "id": meni.id, "upis_izmjena": 0|1, "brisanje_sloga": 0|1 }, ... ] (tip 4 / 5; id_tip_obred_funkcionalnost = id menija),
//   "stupnjevi_po_obredu" – { "obredId": [ id_stupnjevi... ], ... } (tip 6)
// }
//
// Postupak: DELETE sve retke za id_duznosnik; zatim INSERT novih (ista semantika kao kod čitanja u duznosnici_ogranicenja_sve.php).
// Izlaz: OK | 105 | 200,<errno>
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}

header('Content-Type: text/plain; charset=utf-8');

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    echo '105';
    exit;
}

$id_duznosnik = isset($data['id_duznosnik']) ? (int)$data['id_duznosnik'] : 0;
if ($id_duznosnik <= 0) {
    echo '105';
    exit;
}

function ogranicenja_sanitize_int_list($arr)
{
    if (!is_array($arr)) {
        return [];
    }
    $out = [];
    foreach ($arr as $v) {
        $n = (int)$v;
        if ($n > 0) {
            $out[] = $n;
        }
    }
    return $out;
}

$id_drzave = ogranicenja_sanitize_int_list($data['id_drzave'] ?? []);
$id_regije = ogranicenja_sanitize_int_list($data['id_regije'] ?? []);
$id_loze = ogranicenja_sanitize_int_list($data['id_loze'] ?? []);

$prava = [];
if (isset($data['prava']) && is_array($data['prava'])) {
    foreach ($data['prava'] as $p) {
        if (!is_array($p)) {
            continue;
        }
        $mid = isset($p['id']) ? (int)$p['id'] : 0;
        if ($mid <= 0) {
            continue;
        }
        $u = isset($p['upis_izmjena']) && ((int)$p['upis_izmjena'] === 1 || $p['upis_izmjena'] === '1') ? 1 : 0;
        $b = isset($p['brisanje_sloga']) && ((int)$p['brisanje_sloga'] === 1 || $p['brisanje_sloga'] === '1') ? 1 : 0;
        $prava[] = ['id' => $mid, 'u' => $u, 'b' => $b];
    }
}

$stupnjeviPoObredu = [];
if (isset($data['stupnjevi_po_obredu']) && is_array($data['stupnjevi_po_obredu'])) {
    foreach ($data['stupnjevi_po_obredu'] as $obredKey => $lista) {
        $oid = (int)$obredKey;
        if ($oid <= 0) {
            continue;
        }
        $ids = ogranicenja_sanitize_int_list(is_array($lista) ? $lista : []);
        if (!empty($ids)) {
            $stupnjeviPoObredu[$oid] = $ids;
        }
    }
}

try {
    $mysqli->begin_transaction();

    $stmtDel = $mysqli->prepare('DELETE FROM duznosnici_ogranicenja WHERE id_duznosnik = ?');
    if (!$stmtDel) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmtDel->bind_param('i', $id_duznosnik);
    if (!$stmtDel->execute()) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        $stmtDel->close();
        exit;
    }
    $stmtDel->close();

    $stmtGeo = $mysqli->prepare(
        'INSERT INTO duznosnici_ogranicenja (id_duznosnik, id_tip_ogranicenja, id_tip_obred_funkcionalnost, vrijednost) VALUES (?, ?, NULL, ?)'
    );
    if (!$stmtGeo) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }

    foreach ($id_drzave as $vid) {
        $tip = 1;
        $v = (int)$vid;
        $stmtGeo->bind_param('iii', $id_duznosnik, $tip, $v);
        $stmtGeo->execute();
    }
    foreach ($id_regije as $vid) {
        $tip = 2;
        $v = (int)$vid;
        $stmtGeo->bind_param('iii', $id_duznosnik, $tip, $v);
        $stmtGeo->execute();
    }
    foreach ($id_loze as $vid) {
        $tip = 3;
        $v = (int)$vid;
        $stmtGeo->bind_param('iii', $id_duznosnik, $tip, $v);
        $stmtGeo->execute();
    }
    $stmtGeo->close();

    $stmtFull = $mysqli->prepare(
        'INSERT INTO duznosnici_ogranicenja (id_duznosnik, id_tip_ogranicenja, id_tip_obred_funkcionalnost, vrijednost) VALUES (?, ?, ?, ?)'
    );
    if (!$stmtFull) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }

    $tip4 = 4;
    $tip5 = 5;
    $tip6 = 6;
    foreach ($prava as $row) {
        $mid = (int)$row['id'];
        $uVal = (int)$row['u'];
        $bVal = (int)$row['b'];
        $stmtFull->bind_param('iiii', $id_duznosnik, $tip4, $mid, $uVal);
        $stmtFull->execute();
        $stmtFull->bind_param('iiii', $id_duznosnik, $tip5, $mid, $bVal);
        $stmtFull->execute();
    }

    foreach ($stupnjeviPoObredu as $oid => $stLista) {
        $obredId = (int)$oid;
        foreach ($stLista as $idSt) {
            $sid = (int)$idSt;
            $stmtFull->bind_param('iiii', $id_duznosnik, $tip6, $obredId, $sid);
            $stmtFull->execute();
        }
    }
    $stmtFull->close();

    $mysqli->commit();
    echo 'OK';
} catch (Exception $e) {
    $mysqli->rollback();
    echo '200,' . $mysqli->errno;
}
$mysqli->close();

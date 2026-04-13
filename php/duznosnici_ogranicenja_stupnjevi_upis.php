<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// duznosnici_ogranicenja_stupnjevi_upis.php
// Zamjena zapisa tipa 6 (obred + stupnjevi) za dužnosnika.
// =====================================================
//
// Ulaz (POST): id_duznosnik, id_obred (id obreda = id_tip_obred_funkcionalnost),
//   id_stupanj[] (opcionalno, prazno = ukloni sve stupnjeve za taj obred)
//
// Izlaz: OK | 105 | 200,<errno>
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}

$id_duznosnik = isset($_POST['id_duznosnik']) ? (int)$_POST['id_duznosnik'] : 0;
$id_obred = isset($_POST['id_obred']) ? (int)$_POST['id_obred'] : 0;
if ($id_duznosnik <= 0 || $id_obred <= 0) {
    echo '105';
    exit;
}

$id_stupnjevi = [];
if (isset($_POST['id_stupanj']) && is_array($_POST['id_stupanj'])) {
    foreach ($_POST['id_stupanj'] as $v) {
        $id = (int)$v;
        if ($id > 0) {
            $id_stupnjevi[] = $id;
        }
    }
}

$tip = 6;
try {
    $mysqli->begin_transaction();
    $stmt = $mysqli->prepare('DELETE FROM duznosnici_ogranicenja WHERE id_duznosnik = ? AND id_tip_ogranicenja = ? AND id_tip_obred_funkcionalnost = ?');
    if (!$stmt) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('iii', $id_duznosnik, $tip, $id_obred);
    $stmt->execute();
    $stmt->close();

    $stmtIns = $mysqli->prepare('INSERT INTO duznosnici_ogranicenja (id_duznosnik, id_tip_ogranicenja, id_tip_obred_funkcionalnost, vrijednost) VALUES (?, ?, ?, ?)');
    if (!$stmtIns) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }
    foreach ($id_stupnjevi as $id_stupanj) {
        $stmtIns->bind_param('iiii', $id_duznosnik, $tip, $id_obred, $id_stupanj);
        $stmtIns->execute();
    }
    $stmtIns->close();
    $mysqli->commit();
    echo 'OK';
} catch (Exception $e) {
    $mysqli->rollback();
    echo '200,' . $mysqli->errno;
}
$mysqli->close();

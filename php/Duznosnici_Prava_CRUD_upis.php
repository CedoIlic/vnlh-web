<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Duznosnici_Prava_CRUD_upis.php
// Spremanje prava za dužnosnika – zamjenjuje sve postojeće prava novima.
// duznosnici_prava: duznost=id dužnosnika, pravo=id meni.
// =====================================================
//
// Ulaz (POST):
//   id_duznosnik (obavezno) – ID dužnosnika
//   prava – zarezom odvojena lista meni ID-ova koji su dozvoljeni (prazno = ništa)
//
// Izlaz (TEXT): OK | 100 | 105 | 200,errno
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$id_duznosnik = isset($_POST['id_duznosnik']) ? (int)$_POST['id_duznosnik'] : 0;
$prava_raw = isset($_POST['prava']) ? trim((string)$_POST['prava']) : '';

if ($id_duznosnik <= 0) {
    echo '105';
    $mysqli->close();
    exit;
}

$pravaIds = [];
if ($prava_raw !== '') {
    foreach (explode(',', $prava_raw) as $s) {
        $v = (int)trim($s);
        if ($v > 0) $pravaIds[] = $v;
    }
    $pravaIds = array_values(array_unique($pravaIds));
}

$mysqli->begin_transaction();
try {
    $stmt = $mysqli->prepare("DELETE FROM duznosnici_prava WHERE duznost = ?");
    if (!$stmt) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        $mysqli->close();
        exit;
    }
    $stmt->bind_param('i', $id_duznosnik);
    $stmt->execute();
    $stmt->close();

    if (count($pravaIds) > 0) {
        $stmt = $mysqli->prepare("INSERT INTO duznosnici_prava (duznost, pravo) VALUES (?, ?)");
        if (!$stmt) {
            $mysqli->rollback();
            echo '200,' . $mysqli->errno;
            $mysqli->close();
            exit;
        }
        foreach ($pravaIds as $id_meni) {
            $stmt->bind_param('ii', $id_duznosnik, $id_meni);
            $stmt->execute();
        }
        $stmt->close();
    }

    $mysqli->commit();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    $mysqli->rollback();
    echo '200,' . $e->getCode();
}

$mysqli->close();

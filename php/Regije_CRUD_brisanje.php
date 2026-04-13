<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Regije_CRUD_brisanje.php
// Brisanje regije
// =====================================================
//
// Ulaz (POST):
//   id (obavezno) – ID regije za brisanje
//
// Izlaz (TEXT):
//   OK           – uspjeh
//   100          – greška konekcije na bazu (00_db.php)
//   105          – neispravan ulaz (id nedostaje ili <= 0)
//   106,<errno>  – FK constraint (MySQL 1451); poruka 106 s kodom
//   200,<kod>    – ostala SQL greška (prepare/execute)
//
// Koristi centralnu konekciju: 00_db.php ($mysqli)
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

if (!isset($_POST['id'])) {
    echo '105';
    exit;
}

$id = (int) $_POST['id'];
if ($id <= 0) {
    echo '105';
    exit;
}

try {

    $stmt = $mysqli->prepare(
        "DELETE FROM regije WHERE id = ?"
    );
    if (!$stmt) {
      echo '200,' . $mysqli->errno;
      exit;
    }

    $stmt->bind_param("i", $id);
    $stmt->execute();

    echo 'OK';

} catch (mysqli_sql_exception $e) {

    // MySQL error code 1451 = FK constraint → poruka 106 (kod greške #1)
    if ($e->getCode() == 1451) {
        echo '106,' . $e->getCode();
        exit;
    }

    echo '200,' . $e->getCode();
}

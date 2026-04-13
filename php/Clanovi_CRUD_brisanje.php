<?php
require_once __DIR__ . '/require_login_api.php';
// Clanovi_CRUD_brisanje.php – DELETE člana (+ povezani telefoni / e_maili / adrese) u transakciji.

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
header('Content-Type: text/plain; charset=utf-8');

$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
if ($id <= 0) {
    echo '105';
    exit;
}

try {
    $mysqli->begin_transaction();

    // Provjera da zapis postoji (i zaključavanje reda radi konzistentnosti).
    $stmt = $mysqli->prepare("SELECT id FROM clanovi WHERE id = ? FOR UPDATE");
    if (!$stmt) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res->num_rows === 0) {
        $stmt->close();
        $mysqli->rollback();
        echo '108';
        exit;
    }
    $stmt->close();

    // 1) Brisanje svih telefona vezanih uz člana.
    $stmt = $mysqli->prepare("DELETE FROM telefoni WHERE id_clanovi = ?");
    if (!$stmt) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $stmt->close();

    // 2) Brisanje svih e-mailova vezanih uz člana.
    $stmt = $mysqli->prepare("DELETE FROM e_maili WHERE id_clanovi = ?");
    if (!$stmt) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $stmt->close();

    // 3) Brisanje svih adresa vezanih uz člana.
    $stmt = $mysqli->prepare("DELETE FROM adrese WHERE id_clanovi = ?");
    if (!$stmt) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $stmt->close();

    // 4) Brisanje svih napredovanja vezanih uz člana (FK id_clanovi -> clanovi, ON DELETE RESTRICT).
    $stmt = $mysqli->prepare("DELETE FROM napredovanja WHERE id_clanovi = ?");
    if (!$stmt) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $stmt->close();

    // 5) Brisanje samog člana.
    $stmt = $mysqli->prepare("DELETE FROM clanovi WHERE id = ?");
    if (!$stmt) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $stmt->close();

    $mysqli->commit();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    $mysqli->rollback();
    if ($e->getCode() == 1451) {
        // FK ograničenje – poruka 106 kao i kod Loze (povezani zapisi onemogućavaju brisanje).
        echo '106,' . $e->getCode();
    } else {
        echo '200,' . $e->getCode();
    }
}

$mysqli->close();

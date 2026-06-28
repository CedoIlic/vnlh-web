<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_CRUD_jedan.php – dohvat životopisa kandidata po id_clan.
// GET id_clan. Vraća JSON { id_clan, postoji (bool), zivotopis (string|null) }.

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$id_clan = isset($_GET['id_clan']) ? (int) $_GET['id_clan'] : 0;
header('Content-Type: application/json; charset=utf-8');
if ($id_clan <= 0) {
    echo json_encode(['id_clan' => 0, 'postoji' => false, 'zivotopis' => null], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $stmt = $mysqli->prepare('SELECT zivotopis FROM kandidat_dokumenti_zivotopis WHERE id_clan = ? LIMIT 1');
    $stmt->bind_param('i', $id_clan);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res->fetch_assoc();
    $stmt->close();
    if ($row) {
        echo json_encode(['id_clan' => $id_clan, 'postoji' => true, 'zivotopis' => $row['zivotopis']], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode(['id_clan' => $id_clan, 'postoji' => false, 'zivotopis' => null], JSON_UNESCAPED_UNICODE);
    }
} catch (mysqli_sql_exception $e) {
    echo json_encode(['greska' => '200,' . $e->getCode()], JSON_UNESCAPED_UNICODE);
}

$mysqli->close();

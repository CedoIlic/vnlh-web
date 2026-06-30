<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

$result = $mysqli->query('SELECT * FROM pdf_tablica_stil ORDER BY naziv ASC');
if (!$result) { header('Content-Type: text/plain'); echo '200,' . $mysqli->errno; exit; }

$rows = [];
$indexPoId = [];
while ($row = $result->fetch_assoc()) {
    $row['kolone'] = [];
    $indexPoId[(int) $row['id']] = count($rows);
    $rows[] = $row;
}
// Pripoji stupce po stilu (redoslijed)
$rk = $mysqli->query('SELECT * FROM pdf_tablica_stil_kolona ORDER BY tablica_stil_id ASC, redoslijed ASC, id ASC');
if ($rk) {
    while ($o = $rk->fetch_assoc()) {
        $sid = (int) $o['tablica_stil_id'];
        if (isset($indexPoId[$sid])) $rows[$indexPoId[$sid]]['kolone'][] = $o;
    }
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
$mysqli->close();

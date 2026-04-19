<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$result = $mysqli->query(
    'SELECT id, redosljed, fg_boja, bg_boja FROM `Sustav_Odgovori_Razvoja_Boje` ORDER BY redosljed ASC, id ASC'
);
$rows = [];
if (!$result) {
    header('Content-Type: text/plain');
    require_once __DIR__ . '/Alati_Poruke_Razvoja_Tip_mysql_err.php';
    echo vnlh_tip_razvoja_je_mysql_1054($mysqli->errno) ? '154' : ('200,' . $mysqli->errno);
    exit;
}
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
header('Content-Type: application/json');
echo json_encode($rows);
$mysqli->close();

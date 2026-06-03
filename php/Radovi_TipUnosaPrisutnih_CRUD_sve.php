<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$result = $mysqli->query(
    'SELECT rpt.id, rpt.naziv, rpt.redosljed, rpt.duznosnik_ok, rpt.slobodan_unos,
            rpt.svi_clanovi_obedijncije,
            CASE rpt.id
              WHEN 2 THEN (SELECT boja    FROM zapisnik_boje_u_listi WHERE id = 5 LIMIT 1)
              WHEN 3 THEN (SELECT boja    FROM zapisnik_boje_u_listi WHERE id = 6 LIMIT 1)
              WHEN 4 THEN (SELECT boja    FROM zapisnik_boje_u_listi WHERE id = 7 LIMIT 1)
              ELSE rpt.boja_prikaza
            END AS boja_prikaza,
            CASE rpt.id
              WHEN 2 THEN (SELECT boja_bg FROM zapisnik_boje_u_listi WHERE id = 5 LIMIT 1)
              WHEN 3 THEN (SELECT boja_bg FROM zapisnik_boje_u_listi WHERE id = 6 LIMIT 1)
              WHEN 4 THEN (SELECT boja_bg FROM zapisnik_boje_u_listi WHERE id = 7 LIMIT 1)
              ELSE NULL
            END AS boja_prikaza_bg
     FROM radovi_prisustvo_tip rpt
     ORDER BY rpt.redosljed ASC'
);
$rows = [];
if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
$mysqli->close();

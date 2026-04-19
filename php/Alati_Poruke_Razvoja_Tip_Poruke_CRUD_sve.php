<?php
/**
 * JSON: sve poruke razvoja s JOIN na boje (za prikaz stupca „Boja“).
 * Poredak: redosljed, id.
 */
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$sql = 'SELECT p.id, p.redosljed, p.kod, p.boja, p.tekst,
               b.fg_boja AS fg_boja, b.bg_boja AS bg_boja
        FROM `Sustav_Odgovori_Razvoja_Poruke` p
        LEFT JOIN `Sustav_Odgovori_Razvoja_Boje` b ON p.boja = b.id
        ORDER BY p.redosljed ASC, p.id ASC';
$result = $mysqli->query($sql);
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

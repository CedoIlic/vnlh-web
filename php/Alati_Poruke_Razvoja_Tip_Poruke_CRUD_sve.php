<?php
/**
 * JSON: sve poruke razvoja s JOIN na boje — isti oblik kao Alati_Varijable_Sustava_CRUD_sve.php: { "rows": [ ... ] }.
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
        FROM `sustav_odgovori_razvoja_poruke` p
        LEFT JOIN `sustav_odgovori_razvoja_boje` b ON p.boja = b.id
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
$flags = JSON_UNESCAPED_UNICODE;
if (defined('JSON_INVALID_UTF8_SUBSTITUTE')) {
    $flags |= JSON_INVALID_UTF8_SUBSTITUTE;
}
$out = json_encode(['rows' => $rows], $flags);
if ($out === false) {
    header('Content-Type: text/plain; charset=utf-8');
    echo '200,' . json_last_error();
    exit;
}
header('Content-Type: application/json; charset=utf-8');
echo $out;
$mysqli->close();

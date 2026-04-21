<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}
$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
$fg = isset($_POST['fg_boja']) ? trim((string) $_POST['fg_boja']) : '';
$bg = isset($_POST['bg_boja']) ? trim((string) $_POST['bg_boja']) : '';
$red = isset($_POST['redosljed']) ? (int) $_POST['redosljed'] : 0;
if ($id <= 0) {
    echo '105';
    exit;
}
if ($red < 0 || $red > 255) {
    echo '105';
    exit;
}
if (strlen($fg) > 64 || strlen($bg) > 64) {
    echo '105';
    exit;
}
require_once __DIR__ . '/Alati_Poruke_Razvoja_Tip_mysql_err.php';
$stmt = $mysqli->prepare('UPDATE `sustav_odgovori_razvoja_boje` SET redosljed = ?, fg_boja = ?, bg_boja = ? WHERE id = ?');
if (!$stmt) {
    echo vnlh_tip_razvoja_je_mysql_1054($mysqli->errno) ? '154' : ('200,' . $mysqli->errno);
    exit;
}
$stmt->bind_param('issi', $red, $fg, $bg, $id);
if ($stmt->execute()) {
    echo 'OK';
    exit;
}
if ($mysqli->errno == 1451 || $mysqli->errno == 1452) {
    echo '107,' . $mysqli->errno;
    exit;
}
echo vnlh_tip_razvoja_je_mysql_1054($mysqli->errno) ? '154' : ('200,' . $mysqli->errno);
$stmt->close();
$mysqli->close();

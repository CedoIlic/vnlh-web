<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}
$fg = isset($_POST['fg_boja']) ? trim((string) $_POST['fg_boja']) : '';
$bg = isset($_POST['bg_boja']) ? trim((string) $_POST['bg_boja']) : '';
$red = isset($_POST['redosljed']) ? (int) $_POST['redosljed'] : 0;
if ($red < 0 || $red > 255) {
    echo '105';
    exit;
}
if (strlen($fg) > 64 || strlen($bg) > 64) {
    echo '105';
    exit;
}
require_once __DIR__ . '/Alati_Poruke_Razvoja_Tip_mysql_err.php';
try {
    $stmt = $mysqli->prepare('INSERT INTO `Sustav_Odgovori_Razvoja_Boje` (redosljed, fg_boja, bg_boja) VALUES (?, ?, ?)');
    if (!$stmt) {
        echo vnlh_tip_razvoja_je_mysql_1054($mysqli->errno) ? '154' : ('200,' . $mysqli->errno);
        exit;
    }
    $stmt->bind_param('iss', $red, $fg, $bg);
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    echo vnlh_tip_razvoja_je_mysql_1054($e->getCode()) ? '154' : ('200,' . $e->getCode());
}
$mysqli->close();

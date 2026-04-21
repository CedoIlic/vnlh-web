<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}
$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
if ($id <= 0) {
    echo '105';
    exit;
}
require_once __DIR__ . '/Alati_Poruke_Razvoja_Tip_mysql_err.php';
try {
    $stmt = $mysqli->prepare('DELETE FROM `sustav_odgovori_razvoja_poruke` WHERE id = ?');
    if (!$stmt) {
        echo vnlh_tip_razvoja_je_mysql_1054($mysqli->errno) ? '154' : ('200,' . $mysqli->errno);
        exit;
    }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    echo vnlh_tip_razvoja_je_mysql_1054($e->getCode()) ? '154' : ('200,' . $e->getCode());
}
$mysqli->close();

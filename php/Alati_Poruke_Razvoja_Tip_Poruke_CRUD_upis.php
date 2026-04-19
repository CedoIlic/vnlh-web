<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}
$red = isset($_POST['redosljed']) ? (int) $_POST['redosljed'] : 0;
$kod = isset($_POST['kod']) ? (int) $_POST['kod'] : 0;
$bojaRaw = isset($_POST['boja']) ? trim((string) $_POST['boja']) : '';
$bojaId = $bojaRaw === '' ? null : (int) $bojaRaw;
$tekst = isset($_POST['tekst']) ? trim((string) $_POST['tekst']) : '';
if ($red < 0 || $red > 255) {
    echo '105';
    exit;
}
if ($kod < 1 || $kod > 99) {
    echo '105';
    exit;
}
if (strlen($tekst) > 250) {
    echo '105';
    exit;
}
if ($bojaId !== null && $bojaId <= 0) {
    echo '105';
    exit;
}
require_once __DIR__ . '/Alati_Poruke_Razvoja_Tip_mysql_err.php';
try {
    if ($bojaId === null) {
        $stmt = $mysqli->prepare(
            'INSERT INTO `Sustav_Odgovori_Razvoja_Poruke` (redosljed, kod, boja, tekst) VALUES (?, ?, NULL, ?)'
        );
        if (!$stmt) {
            echo vnlh_tip_razvoja_je_mysql_1054($mysqli->errno) ? '154' : ('200,' . $mysqli->errno);
            exit;
        }
        $stmt->bind_param('iis', $red, $kod, $tekst);
    } else {
        $stmt = $mysqli->prepare(
            'INSERT INTO `Sustav_Odgovori_Razvoja_Poruke` (redosljed, kod, boja, tekst) VALUES (?, ?, ?, ?)'
        );
        if (!$stmt) {
            echo vnlh_tip_razvoja_je_mysql_1054($mysqli->errno) ? '154' : ('200,' . $mysqli->errno);
            exit;
        }
        $stmt->bind_param('iiis', $red, $kod, $bojaId, $tekst);
    }
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    if ($e->getCode() == 1452) {
        echo '107,' . $e->getCode();
        exit;
    }
    echo vnlh_tip_razvoja_je_mysql_1054($e->getCode()) ? '154' : ('200,' . $e->getCode());
}
$mysqli->close();

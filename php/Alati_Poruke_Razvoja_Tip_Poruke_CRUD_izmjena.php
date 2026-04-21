<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}
$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
$red = isset($_POST['redosljed']) ? (int) $_POST['redosljed'] : 0;
$kod = isset($_POST['kod']) ? (int) $_POST['kod'] : 0;
$bojaRaw = isset($_POST['boja']) ? trim((string) $_POST['boja']) : '';
$bojaId = $bojaRaw === '' ? null : (int) $bojaRaw;
$tekst = isset($_POST['tekst']) ? trim((string) $_POST['tekst']) : '';
if ($id <= 0) {
    echo '105';
    exit;
}
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
if ($bojaId === null) {
    $stmt = $mysqli->prepare(
        'UPDATE `sustav_odgovori_razvoja_poruke` SET redosljed = ?, kod = ?, boja = NULL, tekst = ? WHERE id = ?'
    );
    if (!$stmt) {
        echo vnlh_tip_razvoja_je_mysql_1054($mysqli->errno) ? '154' : ('200,' . $mysqli->errno);
        exit;
    }
    $stmt->bind_param('iisi', $red, $kod, $tekst, $id);
} else {
    $stmt = $mysqli->prepare(
        'UPDATE `sustav_odgovori_razvoja_poruke` SET redosljed = ?, kod = ?, boja = ?, tekst = ? WHERE id = ?'
    );
    if (!$stmt) {
        echo vnlh_tip_razvoja_je_mysql_1054($mysqli->errno) ? '154' : ('200,' . $mysqli->errno);
        exit;
    }
    $stmt->bind_param('iiisi', $red, $kod, $bojaId, $tekst, $id);
}
if ($stmt->execute()) {
    echo 'OK';
    $stmt->close();
    $mysqli->close();
    exit;
}
if ($mysqli->errno == 1451 || $mysqli->errno == 1452) {
    echo '107,' . $mysqli->errno;
    exit;
}
echo vnlh_tip_razvoja_je_mysql_1054($mysqli->errno) ? '154' : ('200,' . $mysqli->errno);
$stmt->close();
$mysqli->close();

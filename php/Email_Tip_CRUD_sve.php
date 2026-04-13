<?php
require_once __DIR__ . '/require_login_api.php';
// Email_Tip_CRUD_sve.php – dohvat svih tipova e-mail adresa
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$sql = "SELECT id, naziv, `Tip` FROM email_tip ORDER BY `Tip` DESC, naziv ASC";
$result = $mysqli->query($sql);
$rows = [];
if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
header('Content-Type: application/json');
echo json_encode($rows);
$mysqli->close();
?>

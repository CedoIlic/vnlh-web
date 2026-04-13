<?php
require_once __DIR__ . '/require_login_api.php';
// Email_Tip_CRUD_Tip_Change.php – promjena kolone Tip za jedan redak (samo jedan red može imati Tip=1)
// POST: id, Tip (0|1). Izlaz: OK | 100 | 105 | 200,errno
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}
$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
$tip = isset($_POST['Tip']) ? (int)$_POST['Tip'] : -1;
if ($id <= 0 || ($tip !== 0 && $tip !== 1)) {
    echo '105';
    exit;
}
if ($tip === 1) {
    $mysqli->query("UPDATE email_tip SET `Tip` = 0");
    if ($mysqli->errno) {
        echo '200,' . $mysqli->errno;
        exit;
    }
}
$stmt = $mysqli->prepare("UPDATE email_tip SET `Tip` = ? WHERE id = ?");
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param("ii", $tip, $id);
if (!$stmt->execute()) {
    echo '200,' . $mysqli->errno;
    exit;
}
echo 'OK';
$mysqli->close();
?>

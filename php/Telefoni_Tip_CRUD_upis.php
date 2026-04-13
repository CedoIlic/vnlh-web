<?php
require_once __DIR__ . '/require_login_api.php';
// Telefoni_Tip_CRUD_upis.php – dodavanje tipa telefona
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }
if (!isset($_POST['naziv'])) { echo '105'; exit; }
$naziv = trim($_POST['naziv']);
if ($naziv === '') { echo '105'; exit; }
$tip_val = isset($_POST['Tip']) ? (int)$_POST['Tip'] : 0;
if ($tip_val !== 0 && $tip_val !== 1) { $tip_val = 0; }
try {
    $stmt = $mysqli->prepare("SELECT id FROM telefoni_tip WHERE LOWER(naziv) = LOWER(?)");
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("s", $naziv);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) { echo '002'; exit; }
    $stmt->close();
    $stmt = $mysqli->prepare("INSERT INTO telefoni_tip (naziv, `Tip`) VALUES (?, ?)");
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("si", $naziv, $tip_val);
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) { echo '200,' . $e->getCode(); }
$mysqli->close();
?>

<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_Zapisnik_CRUD_upis.php – veže odabrani zapisnik uz kandidata.
// POST: id_clan, id_zapisnik_tip, id_zapisnik, biljeska. datum_upisa/upisao sa servera.
// Duplikati dozvoljeni (isti zapisnik može više puta).
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }

$id_clan         = isset($_POST['id_clan']) ? (int) $_POST['id_clan'] : 0;
$id_zapisnik_tip = isset($_POST['id_zapisnik_tip']) ? (int) $_POST['id_zapisnik_tip'] : 0;
$id_zapisnik     = isset($_POST['id_zapisnik']) ? (int) $_POST['id_zapisnik'] : 0;
$biljeska        = isset($_POST['biljeska']) ? trim((string) $_POST['biljeska']) : '';
if ($biljeska === '') { $biljeska = null; }
elseif (mb_strlen($biljeska, 'UTF-8') > 256) { $biljeska = mb_substr($biljeska, 0, 256, 'UTF-8'); }

if ($id_clan <= 0 || $id_zapisnik_tip <= 0 || $id_zapisnik <= 0) { echo '105'; exit; }
$upisao = (int) ($_SESSION['id_korisnik'] ?? 0) ?: null;

try {
    $stmt = $mysqli->prepare(
        "INSERT INTO kandidat_dokumenti_zapisnik (id_clan, id_zapisnik_tip, id_zapisnik, biljeska, datum_upisa, upisao)
         VALUES (?, ?, ?, ?, NOW(), ?)");
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param('iiisi', $id_clan, $id_zapisnik_tip, $id_zapisnik, $biljeska, $upisao);
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    if ($e->getCode() == 1452) { echo '107,' . $e->getCode(); exit; }   // FK: član/tip/zapisnik ne postoji
    echo '200,' . $e->getCode();
}
$mysqli->close();
?>

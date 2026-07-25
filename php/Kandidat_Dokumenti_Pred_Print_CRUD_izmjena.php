<?php
require_once __DIR__ . '/require_login_api.php';
// Izmjena retka šifarnika pred-printa (ista pravila kao upis).
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }

$id            = isset($_POST['id']) ? (int)$_POST['id'] : 0;
$id_dokument   = isset($_POST['id_dokument']) ? (int)$_POST['id_dokument'] : 0;
$izvor_tablica = isset($_POST['izvor_tablica']) ? trim($_POST['izvor_tablica']) : '';
$izvor_kolona  = isset($_POST['izvor_kolona']) ? trim($_POST['izvor_kolona']) : '';
if ($izvor_kolona === '') $izvor_kolona = 'id';
$naziv    = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
$napomena = isset($_POST['napomena']) ? trim($_POST['napomena']) : '';
$redosljed = isset($_POST['redosljed']) && $_POST['redosljed'] !== '' ? (int)$_POST['redosljed'] : 0;
if ($redosljed < 0) $redosljed = 0; elseif ($redosljed > 100) $redosljed = 100;
$aktivan = isset($_POST['aktivan']) && $_POST['aktivan'] === '1' ? 1 : 0;

if ($id <= 0 || $id_dokument <= 0 || $izvor_tablica === '') { echo '105'; exit; }

try {
    $stmt = $mysqli->prepare("SELECT id FROM pdf_dozvoljeni_izvori_dokumenata WHERE tablica = ? LIMIT 1");
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("s", $izvor_tablica);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows === 0) { echo '105'; exit; }
    $stmt->close();

    $stmt = $mysqli->prepare("SELECT id FROM kandidat_dokumenti_pred_print WHERE id_dokument = ? AND izvor_tablica = ? AND id <> ? LIMIT 1");
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("isi", $id_dokument, $izvor_tablica, $id);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) { echo '002'; exit; }
    $stmt->close();

    $naziv_db    = $naziv === '' ? null : $naziv;
    $napomena_db = $napomena === '' ? null : $napomena;
    $stmt = $mysqli->prepare("UPDATE kandidat_dokumenti_pred_print SET id_dokument = ?, naziv = ?, izvor_tablica = ?, izvor_kolona = ?, redosljed = ?, aktivan = ?, napomena = ? WHERE id = ?");
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("isssiisi", $id_dokument, $naziv_db, $izvor_tablica, $izvor_kolona, $redosljed, $aktivan, $napomena_db, $id);
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    if ($e->getCode() == 1451 || $e->getCode() == 1452) { echo '107,' . $e->getCode(); exit; }
    if ($e->getCode() == 1062) { echo '002'; exit; }
    echo '200,' . $e->getCode();
}
$mysqli->close();
?>

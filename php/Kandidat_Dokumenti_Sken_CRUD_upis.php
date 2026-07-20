<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_Sken_CRUD_upis.php – upload skena kandidata (multipart $_FILES['podatak']).
// POST: id_clan, id_sken_tip, biljeska, podatak (datoteka). Samo PDF. datum_upisa/upisao sa servera.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }

$id_clan     = isset($_POST['id_clan']) ? (int) $_POST['id_clan'] : 0;
$id_sken_tip = isset($_POST['id_sken_tip']) ? (int) $_POST['id_sken_tip'] : 0;
$biljeska    = isset($_POST['biljeska']) ? trim((string) $_POST['biljeska']) : '';
if ($biljeska === '') { $biljeska = null; }
elseif (mb_strlen($biljeska, 'UTF-8') > 256) { $biljeska = mb_substr($biljeska, 0, 256, 'UTF-8'); }

if ($id_clan <= 0 || $id_sken_tip <= 0) { echo '105'; exit; }
if (!isset($_FILES['podatak']) || $_FILES['podatak']['error'] !== UPLOAD_ERR_OK) { echo '105'; exit; }

$podatak = @file_get_contents($_FILES['podatak']['tmp_name']);
if ($podatak === false || $podatak === '') { echo '105'; exit; }
// Samo PDF — provjera magic bytes "%PDF-"
if (substr($podatak, 0, 5) !== '%PDF-') { echo '105'; exit; }
$mime   = 'application/pdf';
$upisao = (int) ($_SESSION['id_korisnik'] ?? 0) ?: null;

try {
    $stmt = $mysqli->prepare(
        "INSERT INTO kandidat_dokumenti_sken (id_clan, id_sken_tip, biljeska, podatak_mime, dokument, datum_upisa, upisao)
         VALUES (?, ?, ?, ?, ?, NOW(), ?)");
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $dummy = null;   // dokument ide preko send_long_data (index 4)
    $stmt->bind_param('iissbi', $id_clan, $id_sken_tip, $biljeska, $mime, $dummy, $upisao);
    $stmt->send_long_data(4, $podatak);
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    if ($e->getCode() == 1452) { echo '107,' . $e->getCode(); exit; }   // FK: član/tip ne postoji
    echo '200,' . $e->getCode();
}
$mysqli->close();
?>

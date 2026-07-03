<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }
require_once __DIR__ . '/Clanovi_Privremeni_Otpust_CRUD_validacija.php';

// Izmjena privremenog otpusta (član se NE mijenja). Audit: zadnja_izmjena = NOW(), id_zadnje_izmjene = korisnik.
// id_korisnik iz sesije JEST clanovi.id → FK na clanovi vrijedi. prvi_upis/id_prvog_upisa se NE diraju.
$id_korisnik = isset($_SESSION['id_korisnik']) ? (int)$_SESSION['id_korisnik'] : 0;
$id       = isset($_POST['id']) ? (int)$_POST['id'] : 0;
$datum_od = isset($_POST['datum_od']) ? trim((string)$_POST['datum_od']) : '';
$datum_do = isset($_POST['datum_do']) ? trim((string)$_POST['datum_do']) : '';
$napomena = isset($_POST['napomena']) ? trim((string)$_POST['napomena']) : '';

if ($id_korisnik <= 0) { echo '401'; exit; }
if ($id <= 0 || $datum_od === '' || $datum_do === '') { echo '105'; exit; }
if (strtotime($datum_do) !== false && strtotime($datum_od) !== false && strtotime($datum_do) < strtotime($datum_od)) { echo '105'; exit; }

// id_clan postojećeg zapisa (član se ne mijenja) — potreban za provjeru preklapanja.
$id_clan = 0;
if ($stmtC = $mysqli->prepare("SELECT id_clan FROM clanovi_privremeni_otpust WHERE id = ? LIMIT 1")) {
    $stmtC->bind_param('i', $id);
    $stmtC->execute();
    $rc = $stmtC->get_result()->fetch_assoc();
    $stmtC->close();
    if ($rc) $id_clan = (int) $rc['id_clan'];
}
if ($id_clan <= 0) { echo '105'; exit; }

// Validacije (035 preklapanje / 036 predugo / 037 unatrag) — izostavi sam zapis iz preklapanja.
$greska = clanovi_privremeni_otpust_validacija($mysqli, $id_clan, $datum_od, $datum_do, $id);
if ($greska !== '') { echo $greska; exit; }

try {
    $stmt = $mysqli->prepare("UPDATE clanovi_privremeni_otpust
        SET datum_od = ?, datum_do = ?, napomena = ?, zadnja_izmjena = NOW(), id_zadnje_izmjene = ?
        WHERE id = ?");
    if (!$stmt) { echo '200|' . $mysqli->errno; exit; }
    $stmt->bind_param('sssii', $datum_od, $datum_do, $napomena, $id_korisnik, $id);
    $stmt->execute();
    $stmt->close();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    echo '200|' . $e->getCode();
}

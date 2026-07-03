<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }
require_once __DIR__ . '/Clanovi_Privremeni_Otpust_CRUD_validacija.php';

// Upis novog privremenog otpusta člana. Audit: prvi_upis = NOW(), id_prvog_upisa = prijavljeni korisnik.
// id_korisnik iz sesije JEST clanovi.id (sustav_korisnici.id_korisnik = clanovi.id) → FK na clanovi vrijedi.
// id_zadnje_izmjene/zadnja_izmjena ostaju NULL do prve izmjene.
$id_korisnik = isset($_SESSION['id_korisnik']) ? (int)$_SESSION['id_korisnik'] : 0;
$id_clan  = isset($_POST['id_clan']) ? (int)$_POST['id_clan'] : 0;
$datum_od = isset($_POST['datum_od']) ? trim((string)$_POST['datum_od']) : '';
$datum_do = isset($_POST['datum_do']) ? trim((string)$_POST['datum_do']) : '';
$napomena = isset($_POST['napomena']) ? trim((string)$_POST['napomena']) : '';

if ($id_korisnik <= 0) { echo '401'; exit; }
if ($id_clan <= 0 || $datum_od === '' || $datum_do === '') { echo '105'; exit; }
if (strtotime($datum_do) !== false && strtotime($datum_od) !== false && strtotime($datum_do) < strtotime($datum_od)) { echo '105'; exit; }

// Validacije (035 preklapanje / 036 predugo / 037 unatrag)
$greska = clanovi_privremeni_otpust_validacija($mysqli, $id_clan, $datum_od, $datum_do, 0);
if ($greska !== '') { echo $greska; exit; }

try {
    $stmt = $mysqli->prepare("INSERT INTO clanovi_privremeni_otpust
        (id_clan, datum_od, datum_do, napomena, prvi_upis, id_prvog_upisa)
        VALUES (?, ?, ?, ?, NOW(), ?)");
    if (!$stmt) { echo '200|' . $mysqli->errno; exit; }
    $stmt->bind_param('isssi', $id_clan, $datum_od, $datum_do, $napomena, $id_korisnik);
    $stmt->execute();
    $stmt->close();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    echo '200|' . $e->getCode();
}

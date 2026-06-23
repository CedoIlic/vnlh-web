<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Jezici_CRUD_upis.php
// Dodavanje jezika (sustav_jezici): kod, naziv, zadani, aktivan, redoslijed
// =====================================================
//
// Ulaz (POST): kod (obavezno), naziv (obavezno), zadani (0/1), aktivan (0/1),
//              redoslijed (broj; prazno = sljedeći slobodni)
// Izlaz (TEXT): OK | 100 | 105 | 033 | 002,<polje> | 200,<errno>
// Pravila: zadani=1 makne zadani sa svih ostalih; zadani uvijek aktivan.
// Koristi: 00_db.php ($mysqli)
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}

$kod    = isset($_POST['kod']) ? strtolower(trim($_POST['kod'])) : '';
$naziv  = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
$naziv_izvorni = isset($_POST['naziv_izvorni']) ? trim($_POST['naziv_izvorni']) : '';
$drzava_kod = isset($_POST['drzava_kod']) ? strtolower(trim($_POST['drzava_kod'])) : '';
$zadani = (isset($_POST['zadani']) && $_POST['zadani'] !== '' && $_POST['zadani'] !== '0') ? 1 : 0;
$aktivan = (!isset($_POST['aktivan']) || ($_POST['aktivan'] !== '0' && $_POST['aktivan'] !== '')) ? 1 : 0;
$redoslijed = (isset($_POST['redoslijed']) && $_POST['redoslijed'] !== '') ? max(0, (int) $_POST['redoslijed']) : null;

if ($kod === '' || $naziv === '') {
    echo '105';
    exit;
}
if (!preg_match('/^[a-z]{2,}(-[a-z0-9]{1,8})?$/', $kod) || strlen($kod) > 10) {
    echo '033';
    exit;
}
if ($drzava_kod !== '' && !preg_match('/^[a-z]{2}$/', $drzava_kod)) {
    echo '105';
    exit;
}

/* Zadani jezik mora biti aktivan. */
if ($zadani === 1) {
    $aktivan = 1;
}

try {
    /* Duplikat naziva (case-insensitive). */
    $stmt = $mysqli->prepare("SELECT id FROM sustav_jezici WHERE LOWER(naziv) = LOWER(?) LIMIT 1");
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("s", $naziv);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) { $stmt->close(); echo '002,Naziv jezika'; exit; }
    $stmt->close();

    /* Duplikat šifre (kod je već lowercase). */
    $stmt = $mysqli->prepare("SELECT id FROM sustav_jezici WHERE kod = ? LIMIT 1");
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("s", $kod);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) { $stmt->close(); echo '002,Šifra jezika'; exit; }
    $stmt->close();

    /* Šifra zemlje (zastava) mora postojati u šifrarniku ako je zadana. */
    if ($drzava_kod !== '') {
        $cd = $mysqli->prepare("SELECT 1 FROM sustav_drzave WHERE kod = ? LIMIT 1");
        $okDrzava = false;
        if ($cd) { $cd->bind_param('s', $drzava_kod); $cd->execute(); $cd->store_result(); $okDrzava = $cd->num_rows > 0; $cd->close(); }
        if (!$okDrzava) { echo '105'; exit; }
    }
    $drzavaParam = ($drzava_kod === '') ? null : $drzava_kod;
    $izvorniParam = ($naziv_izvorni === '') ? null : $naziv_izvorni;

    /* Sljedeći slobodni redoslijed ako nije zadan. */
    if ($redoslijed === null) {
        $res = $mysqli->query("SELECT COALESCE(MAX(redoslijed), 0) + 1 AS r FROM sustav_jezici");
        $r = $res ? $res->fetch_assoc() : null;
        $redoslijed = $r ? (int) $r['r'] : 1;
    }

    $mysqli->begin_transaction();

    if ($zadani === 1) {
        $mysqli->query("UPDATE sustav_jezici SET zadani = 0 WHERE zadani = 1");
    }

    $stmt = $mysqli->prepare(
        "INSERT INTO sustav_jezici (kod, drzava_kod, naziv, naziv_izvorni, zadani, aktivan, redoslijed) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    if (!$stmt) { $mysqli->rollback(); echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("ssssiii", $kod, $drzavaParam, $naziv, $izvorniParam, $zadani, $aktivan, $redoslijed);
    $stmt->execute();
    $stmt->close();

    $mysqli->commit();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    if ($mysqli->errno) { @$mysqli->rollback(); }
    if ($e->getCode() == 1062) { echo '109'; exit; }
    echo '200,' . $e->getCode();
}

$mysqli->close();
?>

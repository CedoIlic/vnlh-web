<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Jezici_CRUD_izmjena.php
// Izmjena jezika (sustav_jezici): kod, naziv, zadani, aktivan, redoslijed
// =====================================================
//
// Ulaz (POST): id (obavezno), kod, naziv (obavezno), zadani (0/1), aktivan (0/1), redoslijed
// Izlaz (TEXT): OK | 100 | 105 | 033 | 034 | 002,<polje> | 107,<errno> | 200,<errno>
// Pravila: zadani=1 makne zadani sa svih ostalih; zadani jezik ne može se
//          deaktivirati ni izgubiti oznaku zadani (mora se prvo prebaciti na drugi).
// Koristi: 00_db.php ($mysqli)
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}

$id     = isset($_POST['id']) ? (int) $_POST['id'] : 0;
$kod    = isset($_POST['kod']) ? strtolower(trim($_POST['kod'])) : '';
$naziv  = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
$naziv_izvorni = isset($_POST['naziv_izvorni']) ? trim($_POST['naziv_izvorni']) : '';
$drzava_kod = isset($_POST['drzava_kod']) ? strtolower(trim($_POST['drzava_kod'])) : '';
$zadani = (isset($_POST['zadani']) && $_POST['zadani'] !== '' && $_POST['zadani'] !== '0') ? 1 : 0;
$aktivan = (!isset($_POST['aktivan']) || ($_POST['aktivan'] !== '0' && $_POST['aktivan'] !== '')) ? 1 : 0;
$redoslijed = (isset($_POST['redoslijed']) && $_POST['redoslijed'] !== '') ? max(0, (int) $_POST['redoslijed']) : 0;

if ($id <= 0 || $kod === '' || $naziv === '') {
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

try {
    /* Trenutno stanje retka (je li ovo zadani jezik). */
    $stmt = $mysqli->prepare("SELECT zadani FROM sustav_jezici WHERE id = ? LIMIT 1");
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $res = $stmt->get_result();
    $cur = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (!$cur) { echo '105'; exit; }
    $biojeZadani = ((int) $cur['zadani'] === 1);

    /* Zaštita zadanog: ne smije izgubiti oznaku zadani niti biti deaktiviran. */
    if ($biojeZadani && $zadani === 0) {
        echo '034';
        exit;
    }
    if ($zadani === 1 && $aktivan === 0) {
        echo '034';
        exit;
    }

    /* Duplikat naziva (case-insensitive) osim sebe. */
    $stmt = $mysqli->prepare("SELECT id FROM sustav_jezici WHERE LOWER(naziv) = LOWER(?) AND id <> ? LIMIT 1");
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("si", $naziv, $id);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) { $stmt->close(); echo '002,Naziv jezika'; exit; }
    $stmt->close();

    /* Duplikat šifre osim sebe. */
    $stmt = $mysqli->prepare("SELECT id FROM sustav_jezici WHERE kod = ? AND id <> ? LIMIT 1");
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("si", $kod, $id);
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

    $mysqli->begin_transaction();

    if ($zadani === 1) {
        $stmt = $mysqli->prepare("UPDATE sustav_jezici SET zadani = 0 WHERE zadani = 1 AND id <> ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $stmt->close();
    }

    $stmt = $mysqli->prepare(
        "UPDATE sustav_jezici SET kod = ?, drzava_kod = ?, naziv = ?, naziv_izvorni = ?, zadani = ?, aktivan = ?, redoslijed = ? WHERE id = ?"
    );
    if (!$stmt) { $mysqli->rollback(); echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("ssssiiii", $kod, $drzavaParam, $naziv, $izvorniParam, $zadani, $aktivan, $redoslijed, $id);
    $stmt->execute();
    $stmt->close();

    $mysqli->commit();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    if ($mysqli->errno) { @$mysqli->rollback(); }
    if ($e->getCode() == 1451 || $e->getCode() == 1452) { echo '107,' . $e->getCode(); exit; }
    if ($e->getCode() == 1062) { echo '109'; exit; }
    echo '200,' . $e->getCode();
}

$mysqli->close();
?>

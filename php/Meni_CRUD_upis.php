<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Meni_CRUD_upis.php
// Dodavanje nove stavke menija
// =====================================================
//
// Ulaz (POST):
// - naziv (obavezno)
// - html_fajl, ref, putanja, napomena (tekstualna polja, prazno = '')
// - redoslijed (broj, default 0)
// - meni_tip_id (0 = Nije izabran → NULL u bazi zbog FK)
// - roditelj (0 = Nije izabran, može ostati 0)
// - aktivno, test (checkboxi: ako postoji POST key → 1, inače 0)
// - device (0 = sve jedinice, 1 = samo desktop, 2 = samo mobitel; default 0)
//
// Izlaz (TEXT): OK | 100 | 105 | 200,<errno>
// Koristi: 00_db.php ($mysqli)
// =====================================================

// --- Blok: Konekcija na bazu ---
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}

// --- Blok: Validacija ulaza ---
if (!isset($_POST['naziv'])) {
    echo '105';
    exit;
}

$naziv = trim($_POST['naziv']);
if ($naziv === '') {
    echo '105';
    exit;
}

// --- Blok: SELECT polja ---
$meni_tip_id = isset($_POST['meni_tip_id']) ? (int)$_POST['meni_tip_id'] : 0;
$roditelj = isset($_POST['roditelj']) ? (int)$_POST['roditelj'] : 0;

// --- Blok: Tekstualna polja (prazno = prazan string) ---
$opis = trim($_POST['opis'] ?? '');
$napomena = trim($_POST['napomena'] ?? '');
$html_fajl = trim($_POST['html_fajl'] ?? '');
$putanja = trim($_POST['putanja'] ?? '');
$ref = trim($_POST['ref'] ?? '');

// --- Blok: Numerička polja ---
$redoslijed = isset($_POST['redoslijed']) ? (int)$_POST['redoslijed'] : 0;

// --- Blok: Checkbox polja ---
$aktivno = isset($_POST['aktivno']) ? 1 : 0;
$test = isset($_POST['test']) ? 1 : 0;

// --- Blok: Device (0 = sve, 1 = desktop, 2 = mobitel) ---
$deviceRaw = isset($_POST['device']) ? (int)$_POST['device'] : 0;
$device = ($deviceRaw >= 0 && $deviceRaw <= 2) ? $deviceRaw : 0;

// --- Blok: INSERT ---
// VAŽNO: meni_tip_id ide kroz NULLIF(?,0) -> 0 postaje NULL (FK safe)
$sql = "
    INSERT INTO meni (
        naziv,
        opis,
        napomena,
        html_fajl,
        putanja,
        ref,
        meni_tip_id,
        roditelj,
        redoslijed,
        aktivno,
        test,
        device
    ) VALUES (?, ?, ?, ?, ?, ?, NULLIF(?,0), ?, ?, ?, ?, ?)
";

// --- Blok: Prepare i bind ---
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
// Tipovi: s = string, i = integer
$stmt->bind_param(
    'ssssssiiiiii',
    $naziv,
    $opis,
    $napomena,
    $html_fajl,
    $putanja,
    $ref,
    $meni_tip_id,
    $roditelj,
    $redoslijed,
    $aktivno,
    $test,
    $device
);

// --- Blok: Izvršenje i odgovor ---
try {
    if ($stmt->execute()) {
        echo 'OK';
    } else {
        echo '200,' . $mysqli->errno;
    }
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}

$stmt->close();
$mysqli->close();
?>

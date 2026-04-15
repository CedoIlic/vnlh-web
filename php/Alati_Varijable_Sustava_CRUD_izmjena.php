<?php
require_once __DIR__ . '/require_login_api.php';
require_once __DIR__ . '/vnlh_varijable_sustava_razvoj.php';
// =====================================================
// Alati_Varijable_Sustava_CRUD_izmjena.php
// Izmjena retka sustav_varijable (varijabla, Naziv, opis)
// =====================================================
//
// Ulaz (POST): id, varijabla, naziv (obavezno); opis (opcionalno); razvoj (0|1, samo admin retka 1002)
// Izlaz (TEXT): OK | 100 | 105 | 002 | 107,<errno> | 109 | 200,<errno>
// =====================================================

// --- Blok: Konekcija na bazu ---
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}

// --- Blok: Validacija ulaza ---
$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
$varijabla = isset($_POST['varijabla']) ? trim((string) $_POST['varijabla']) : '';
$naziv = isset($_POST['naziv']) ? trim((string) $_POST['naziv']) : '';
$opis = isset($_POST['opis']) ? trim((string) $_POST['opis']) : '';

if ($id <= 0 || $varijabla === '' || $naziv === '') {
    echo '105';
    exit;
}

$idK = isset($_SESSION['id_korisnik']) ? (int) $_SESSION['id_korisnik'] : 0;
$zeliRazvoj = isset($_POST['razvoj']) && (string) $_POST['razvoj'] === '1';
$efektRazvoj = vnlh_var_sust_efektivni_razvoj_ukljucen($mysqli, $idK, $zeliRazvoj);
if (!$efektRazvoj && $id > 999) {
    echo '105';
    exit;
}
if (mb_strlen($varijabla, 'UTF-8') > 200 || mb_strlen($naziv, 'UTF-8') > 200) {
    echo '105';
    exit;
}
if (mb_strlen($opis, 'UTF-8') > 2048) {
    echo '105';
    exit;
}

$varNorm = mb_strtolower($varijabla, 'UTF-8');

// --- Blok: Provjera duplikata varijable (isključujući trenutni id) ---
$stmt = $mysqli->prepare('SELECT id FROM sustav_varijable WHERE LOWER(varijabla) = ? AND id <> ? LIMIT 1');
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('si', $varNorm, $id);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
    echo '002';
    $stmt->close();
    $mysqli->close();
    exit;
}
$stmt->close();

// --- Blok: UPDATE ---
$stmt = $mysqli->prepare(
    'UPDATE sustav_varijable SET varijabla = ?, `Naziv` = ?, opis = NULLIF(?, \'\') WHERE id = ?'
);
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('sssi', $varijabla, $naziv, $opis, $id);

if ($stmt->execute()) {
    if ($id === 111 || $id === 112 || $id === 113) {
        require_once __DIR__ . '/sesija_pracenje_aktivnosti_lib.php';
        sesija_pracenje_aktivnosti_cache_invalidate();
    }
    echo 'OK';
    $stmt->close();
    $mysqli->close();
    exit;
}

if ($mysqli->errno == 1451 || $mysqli->errno == 1452) {
    echo '107,' . $mysqli->errno;
    $stmt->close();
    $mysqli->close();
    exit;
}
if ($mysqli->errno == 1062) {
    echo '109';
    $stmt->close();
    $mysqli->close();
    exit;
}
echo '200,' . $mysqli->errno;
$stmt->close();
$mysqli->close();

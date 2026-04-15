<?php
require_once __DIR__ . '/require_login_api.php';
require_once __DIR__ . '/vnlh_varijable_sustava_razvoj.php';
// =====================================================
// Alati_Varijable_Sustava_CRUD_brisanje.php
// Brisanje retka sustav_varijable (FK 1451 → kod 106)
// =====================================================
//
// Ulaz (POST): id (obavezno); razvoj (0|1, samo admin retka 1002)
// Izlaz (TEXT): OK | 100 | 105 | 106,<errno> | 200,<errno>
// =====================================================

// --- Blok: Konekcija na bazu ---
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}

// --- Blok: Validacija ulaza ---
$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
if ($id <= 0) {
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

$sql = 'DELETE FROM sustav_varijable WHERE id = ?';

try {
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    if ((int) $e->getCode() === 1451) {
        echo '106,' . $e->getCode();
        exit;
    }
    echo '200,' . $e->getCode();
    exit;
}
$mysqli->close();

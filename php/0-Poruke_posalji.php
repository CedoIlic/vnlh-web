<?php
// =====================================================
// 0-Poruke_posalji.php
// API: slanje odgovora na poruku (INSERT u sustav_sesije_poruke).
//
// Ulaz (POST):
//   id_primatelj  (obavezno) – ID korisnika koji prima poruku
//   poruka        (obavezno) – tekst poruke
//   id_razgovor   (opcionalno) – ID razgovora za nastavak niti; 0 = novi razgovor
//
// Izlaz:
//   (TEXT) Uspjeh: -1
//   (TEXT) Greška konekcije: 100
//   (TEXT) Nedostaje parametar: 105
//   (TEXT) SQL greška: 200,<sql_errno>
// =====================================================

require_once __DIR__ . '/require_login_api.php';

// --- Blok: Konekcija na bazu ---
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: text/plain; charset=utf-8');

// --- Blok: Parametri (POST) ---
$idPrimatelj = isset($_POST['id_primatelj']) ? (int) $_POST['id_primatelj'] : 0;
$poruka      = isset($_POST['poruka']) ? trim($_POST['poruka']) : '';
$idRazgovor  = isset($_POST['id_razgovor']) ? (int) $_POST['id_razgovor'] : 0;

if ($idPrimatelj <= 0 || $poruka === '') {
    echo '105';
    exit;
}

$idPosiljatelj = (int) $_SESSION['id_korisnik'];
$sessionId     = session_id();

// --- Blok: Ako id_razgovor=0, stvori novi razgovor (sljedeći slobodni id_razgovor) ---
if ($idRazgovor <= 0) {
    $sqlMaxRazg = "SELECT COALESCE(MAX(id_razgovor), 0) + 1 AS novi FROM sustav_sesije_poruke";
    $resMaxRazg = $mysqli->query($sqlMaxRazg);
    if ($resMaxRazg) {
        $rowMax = $resMaxRazg->fetch_assoc();
        $idRazgovor = $rowMax ? (int) $rowMax['novi'] : 1;
    } else {
        $idRazgovor = 1;
    }
}

// --- Blok: INSERT poruke ---
$sql = "
    INSERT INTO sustav_sesije_poruke
        (id_razgovor, id_posiljatelj, id_primatelj, session_id_posiljatelj, poruka, vrijeme_slanja, status, tip)
    VALUES
        (?, ?, ?, ?, ?, NOW(), 'Novo', 'Poruka')
";

$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}

$stmt->bind_param('iiiss', $idRazgovor, $idPosiljatelj, $idPrimatelj, $sessionId, $poruka);

if (!$stmt->execute()) {
    echo '200,' . $stmt->errno;
    $stmt->close();
    exit;
}

$stmt->close();
$mysqli->close();
// Flag ima_neprocitanih u sustav_sesije_aktivne ažurira AFTER INSERT trigger automatski.

// Uspjeh – VNLH konvencija
echo '-1';

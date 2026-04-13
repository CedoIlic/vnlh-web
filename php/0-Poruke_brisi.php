<?php
// =====================================================
// 0-Poruke_brisi.php
// API: brisanje svih poruka između logged korisnika i odabranog pošiljatelja.
// Briše poruke u oba smjera (korisnik→pošiljatelj i pošiljatelj→korisnik).
//
// Ulaz (POST):
//   id_posiljatelj  (obavezno) – ID korisnika čiji se razgovor briše
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
$idPosiljatelj = isset($_POST['id_posiljatelj']) ? (int) $_POST['id_posiljatelj'] : 0;

if ($idPosiljatelj <= 0) {
    echo '105';
    exit;
}

$idKorisnik = (int) $_SESSION['id_korisnik'];

// --- Blok: DELETE svih poruka u oba smjera između ova dva korisnika ---
$sql = "
    DELETE FROM sustav_sesije_poruke
    WHERE (id_posiljatelj = ? AND id_primatelj = ?)
       OR (id_posiljatelj = ? AND id_primatelj = ?)
";

$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}

$stmt->bind_param('iiii', $idPosiljatelj, $idKorisnik, $idKorisnik, $idPosiljatelj);

if (!$stmt->execute()) {
    echo '200,' . $stmt->errno;
    $stmt->close();
    exit;
}

$stmt->close();
$mysqli->close();
// Flag ima_neprocitanih u sustav_sesije_aktivne ažurira AFTER DELETE trigger automatski.

// Uspjeh – VNLH konvencija
echo '-1';

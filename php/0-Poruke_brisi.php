<?php
// =====================================================
// 0-Poruke_brisi.php
// API: logičko brisanje niti – samo tip = 'Poruka' (modal Poruke). Chat nit: poruke_chat_brisi.php.
// Postavlja sustav_sesije_poruke.brisano = 1 u oba smjera (redovi ostaju u bazi).
//
// Rezime kolone brisano: brisanje postavlja 1 i ne uklanja poruku iz baze. U povijesti se
// prikazuju samo poruke koje imaju brisano=0. Poruke s brisano=1 ne pojavljuju se nigdje –
// ponašaju se kao da ne postoje.
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

// --- Blok: UPDATE brisano=1 za sve poruke u oba smjera (logičko brisanje) ---
$sql = "
    UPDATE sustav_sesije_poruke
       SET brisano = 1
    WHERE tip = 'Poruka'
      AND ((id_posiljatelj = ? AND id_primatelj = ?)
       OR (id_posiljatelj = ? AND id_primatelj = ?))
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
// Flag ima_neprocitanih u sustav_sesije_aktivne ažurira trg_poruke_after_update (brisano 0→1, status Novo).

// Uspjeh – VNLH konvencija
echo '-1';

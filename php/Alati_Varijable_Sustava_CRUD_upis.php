<?php
require_once __DIR__ . '/require_login_api.php';
require_once __DIR__ . '/vnlh_varijable_sustava_razvoj.php';
// =====================================================
// Alati_Varijable_Sustava_CRUD_upis.php
// Novi red u sustav_varijable (id = MAX(id)+1 jer stupac nema AUTO_INCREMENT)
// =====================================================
//
// Ulaz (POST): varijabla, naziv (obavezno); opis (opcionalno, prazno → NULL u bazi)
//   id (opcionalno): ako je > 0 i u tablici još nema retka s tim id-em, INSERT koristi taj id (rupa / ručni broj);
//   ako id nema ili je 0, koristi se COALESCE(MAX(id),0)+1. Zauzet PK (id) → 002 (ne provjerava se jedinstvenost stupca varijabla — to je „Vrijednost”, nije PK).
// POST razvoj: 1 samo za administratora (redak id 1002); bez uključenog razvoja id mora biti 0–999.
// Izlaz (TEXT): OK | 100 | 105 | 002 | 200,<errno>
// =====================================================

// --- Blok: Konekcija na bazu ---
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}

// --- Blok: Validacija ulaza ---
if (!isset($_POST['varijabla'], $_POST['naziv'])) {
    echo '105';
    exit;
}
$varijabla = trim((string) $_POST['varijabla']);
$naziv = trim((string) $_POST['naziv']);
$opis = isset($_POST['opis']) ? trim((string) $_POST['opis']) : '';

if ($varijabla === '' || $naziv === '') {
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

// --- Blok: Izračun id (PK) — jedinstvenost stupca varijabla (Vrijednost u UI-ju) se ne provjerava; u bazi nema UNIQUE na tom stupcu.

$idK = isset($_SESSION['id_korisnik']) ? (int) $_SESSION['id_korisnik'] : 0;
$zeliRazvoj = isset($_POST['razvoj']) && (string) $_POST['razvoj'] === '1';
$efektRazvoj = vnlh_var_sust_efektivni_razvoj_ukljucen($mysqli, $idK, $zeliRazvoj);

$sqlNext = $efektRazvoj
    ? 'SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM sustav_varijable'
    : 'SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM sustav_varijable WHERE id <= 999';
$resMax = $mysqli->query($sqlNext);
if (!$resMax) {
    echo '200,' . $mysqli->errno;
    $mysqli->close();
    exit;
}
$maxRow = $resMax->fetch_assoc();
$resMax->free();
$nextId = isset($maxRow['next_id']) ? (int) $maxRow['next_id'] : 1;
if ($nextId <= 0) {
    $nextId = 1;
}

// Odabir id-a za INSERT: eksplicitni POST id ako je slobodan, inače sljedeći MAX+1 (u ograničenom načinu samo među id <= 999).
$clientId = isset($_POST['id']) ? (int) $_POST['id'] : 0;
$useId = $nextId;
if ($clientId > 0) {
    $chkId = $mysqli->prepare('SELECT 1 FROM sustav_varijable WHERE id = ? LIMIT 1');
    if (!$chkId) {
        echo '200,' . $mysqli->errno;
        $mysqli->close();
        exit;
    }
    $chkId->bind_param('i', $clientId);
    $chkId->execute();
    $chkId->store_result();
    if ($chkId->num_rows > 0) {
        echo '002';
        $chkId->close();
        $mysqli->close();
        exit;
    }
    $chkId->close();
    $useId = $clientId;
}

if (!$efektRazvoj && ($useId < 0 || $useId > 999)) {
    echo '105';
    exit;
}

// --- Blok: INSERT (opis: prazan nakon trima → NULL u stupcu preko NULLIF) ---
$stmt = $mysqli->prepare('INSERT INTO sustav_varijable (id, varijabla, `Naziv`, opis) VALUES (?, ?, ?, NULLIF(?, \'\'))');
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    $mysqli->close();
    exit;
}
$stmt->bind_param('isss', $useId, $varijabla, $naziv, $opis);
if (!$stmt->execute()) {
    if ($mysqli->errno == 1062) {
        echo '002';
    } else {
        echo '200,' . $mysqli->errno;
    }
    $stmt->close();
    $mysqli->close();
    exit;
}
echo 'OK';
$stmt->close();
$mysqli->close();

<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }

// Upis promjene lože / izlaska. Dvije faze u transakciji: (1) UPDATE clanovi, (2) INSERT clanovi_izlazak.
// Ponašanje ovisi o ključu tipa izlaska (clanovi_izlazak_tip.kljuc).
$id_clan         = isset($_POST['id_clan']) ? (int)$_POST['id_clan'] : 0;
$kljuc           = isset($_POST['kljuc']) ? trim((string)$_POST['kljuc']) : '';
$id_izlazak_tip  = isset($_POST['id_izlazak_tip']) ? (int)$_POST['id_izlazak_tip'] : 0;
$id_loza_odlaska = isset($_POST['id_loza_odlaska']) ? (int)$_POST['id_loza_odlaska'] : 0;
$id_loza_dolaska = isset($_POST['id_loza_dolaska']) ? (int)$_POST['id_loza_dolaska'] : 0;
$datum_ulaska    = isset($_POST['datum_ulaska']) && trim((string)$_POST['datum_ulaska']) !== '' ? trim((string)$_POST['datum_ulaska']) : null;
$datum_izlaska   = isset($_POST['datum_izlaska']) ? trim((string)$_POST['datum_izlaska']) : '';
$napomena        = isset($_POST['napomena']) ? trim((string)$_POST['napomena']) : '';

if ($id_clan <= 0) { echo '105'; exit; }

// ===== KLJUČ 1 — promjena lože (prelazak) =====
if ($kljuc === '1') {
    if ($id_izlazak_tip <= 0 || $id_loza_odlaska <= 0 || $id_loza_dolaska <= 0 || $datum_izlaska === '') { echo '105'; exit; }
    try {
        $mysqli->begin_transaction();

        // Faza 1: clanovi — datum_ulaska_lozu = Datum izlaska; loza = odlazna loža.
        $stmt = $mysqli->prepare("UPDATE clanovi SET datum_ulaska_lozu = ?, loza = ? WHERE id = ?");
        if (!$stmt) { $mysqli->rollback(); echo '200|' . $mysqli->errno; exit; }
        $stmt->bind_param('sii', $datum_izlaska, $id_loza_dolaska, $id_clan);
        $stmt->execute();
        $stmt->close();

        // Faza 2: clanovi_izlazak — redak povijesti.
        $stmt = $mysqli->prepare("INSERT INTO clanovi_izlazak
            (id_clan, id_loza_odlaska, id_loza_dolaska, id_izlazak_tip, datum_ulaska, datum_izlaska, napomena)
            VALUES (?, ?, ?, ?, ?, ?, ?)");
        if (!$stmt) { $mysqli->rollback(); echo '200|' . $mysqli->errno; exit; }
        $stmt->bind_param('iiiisss', $id_clan, $id_loza_odlaska, $id_loza_dolaska, $id_izlazak_tip, $datum_ulaska, $datum_izlaska, $napomena);
        $stmt->execute();
        $stmt->close();

        $mysqli->commit();
        echo 'OK';
    } catch (mysqli_sql_exception $e) {
        $mysqli->rollback();
        echo '200|' . $e->getCode();
    }
    exit;
}

// ===== KLJUČ 2 — izlazak / pokrivanje =====
if ($kljuc === '2') {
    if ($id_izlazak_tip <= 0 || $id_loza_odlaska <= 0 || $datum_izlaska === '') { echo '105'; exit; }
    $id_loza_dolaska_null = null;   // nema dolazne lože
    try {
        $mysqli->begin_transaction();

        // Faza 1: clanovi — datum_izlaska_pokrivanja = Datum izlaska; aktivnost = 0.
        $stmt = $mysqli->prepare("UPDATE clanovi SET datum_izlaska_pokrivanja = ?, aktivnost = 0 WHERE id = ?");
        if (!$stmt) { $mysqli->rollback(); echo '200|' . $mysqli->errno; exit; }
        $stmt->bind_param('si', $datum_izlaska, $id_clan);
        $stmt->execute();
        $stmt->close();

        // Faza 2: clanovi_izlazak — redak povijesti (id_loza_odlaska = matična loža, bez dolazne lože).
        $stmt = $mysqli->prepare("INSERT INTO clanovi_izlazak
            (id_clan, id_loza_odlaska, id_loza_dolaska, id_izlazak_tip, datum_ulaska, datum_izlaska, napomena)
            VALUES (?, ?, ?, ?, ?, ?, ?)");
        if (!$stmt) { $mysqli->rollback(); echo '200|' . $mysqli->errno; exit; }
        $stmt->bind_param('iiiisss', $id_clan, $id_loza_odlaska, $id_loza_dolaska_null, $id_izlazak_tip, $datum_ulaska, $datum_izlaska, $napomena);
        $stmt->execute();
        $stmt->close();

        $mysqli->commit();
        echo 'OK';
    } catch (mysqli_sql_exception $e) {
        $mysqli->rollback();
        echo '200|' . $e->getCode();
    }
    exit;
}

// ===== Ostali ključevi — definirat ćemo naknadno =====
echo '105';

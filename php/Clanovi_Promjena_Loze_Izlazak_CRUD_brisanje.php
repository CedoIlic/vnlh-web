<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }

// Brisanje zapisa iz clanovi_izlazak = poništavanje upisa (suprotno, ovisno o ključu tipa).
// Sve u transakciji. Endpoint sam pročita redak (i ključ preko tipa) radi integriteta.
$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
if ($id <= 0) { echo '105'; exit; }

try {
    $mysqli->begin_transaction();

    // Pročitaj redak + ključ tipa.
    $stmt = $mysqli->prepare("SELECT ci.id_clan, ci.id_loza_odlaska, ci.datum_ulaska, t.kljuc AS kljuc
                              FROM clanovi_izlazak ci
                              LEFT JOIN clanovi_izlazak_tip t ON t.id = ci.id_izlazak_tip
                              WHERE ci.id = ?");
    if (!$stmt) { $mysqli->rollback(); echo '200|' . $mysqli->errno; exit; }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $red = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$red) { $mysqli->rollback(); echo '105'; exit; }

    $kljuc           = (string)$red['kljuc'];
    $id_clan         = (int)$red['id_clan'];
    $id_loza_odlaska = (int)$red['id_loza_odlaska'];
    $datum_ulaska    = $red['datum_ulaska']; // može biti NULL

    if ($kljuc === '1') {
        // Poništi prelazak: vrati matičnu ložu + stari datum ulaska.
        $stmt = $mysqli->prepare("UPDATE clanovi SET loza = ?, datum_ulaska_lozu = ? WHERE id = ?");
        if (!$stmt) { $mysqli->rollback(); echo '200|' . $mysqli->errno; exit; }
        $stmt->bind_param('isi', $id_loza_odlaska, $datum_ulaska, $id_clan);
        $stmt->execute();
        $stmt->close();
    } elseif ($kljuc === '2') {
        // Poništi izlazak/pokrivanje: aktiviraj, očisti datum izlaska/pokrivanja, vrati datum ulaska u ložu.
        $stmt = $mysqli->prepare("UPDATE clanovi SET aktivnost = 1, datum_izlaska_pokrivanja = NULL, datum_ulaska_lozu = ? WHERE id = ?");
        if (!$stmt) { $mysqli->rollback(); echo '200|' . $mysqli->errno; exit; }
        $stmt->bind_param('si', $datum_ulaska, $id_clan);
        $stmt->execute();
        $stmt->close();
    } else {
        $mysqli->rollback();
        echo '105';
        exit;
    }

    // Obriši redak povijesti.
    $stmt = $mysqli->prepare("DELETE FROM clanovi_izlazak WHERE id = ?");
    if (!$stmt) { $mysqli->rollback(); echo '200|' . $mysqli->errno; exit; }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $stmt->close();

    $mysqli->commit();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    $mysqli->rollback();
    echo '200|' . $e->getCode();
}

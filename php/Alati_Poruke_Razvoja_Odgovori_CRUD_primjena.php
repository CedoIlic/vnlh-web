<?php
/**
 * API: primjena predloška (sustav_odgovori_razvoja_poruke) na poruku tipa „Poruka razvoju“.
 * Na kraj polja poruka dodaje blok #kod*tekst# (tekst iz predloška). Opcionalno prvo uklanja sve postojeće blokove.
 *
 * Ulaz (POST):
 *   id             — ID retka sustav_sesije_poruke
 *   id_predlozak   — ID retka sustav_odgovori_razvoja_poruke
 *   brisi_stare    — 1 = ukloni sve postojeće sufiksne odgovore pa dodaj novi; 0 = dodaj još jedan blok na kraj
 *
 * Izlaz: „OK“ ili kod greške (105 = nevaljani parametri, 108 = nije pronađeno, 200,errno = SQL).
 */
require_once __DIR__ . '/require_login_api.php';
require_once __DIR__ . '/poruke_razvoj_odgovor_parse.php';

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain; charset=utf-8');
    echo $db_ret;
    exit;
}

header('Content-Type: text/plain; charset=utf-8');

$idPoruke = isset($_POST['id']) ? (int) $_POST['id'] : 0;
$idPredlozak = isset($_POST['id_predlozak']) ? (int) $_POST['id_predlozak'] : 0;
$brisiStare = isset($_POST['brisi_stare']) && ($_POST['brisi_stare'] === '1' || $_POST['brisi_stare'] === 1);

if ($idPoruke <= 0 || $idPredlozak <= 0) {
    echo '105';
    $mysqli->close();
    exit;
}

$stmtP = $mysqli->prepare(
    'SELECT poruka FROM sustav_sesije_poruke WHERE id = ? AND tip = \'Poruka razvoju\' AND brisano = 0 LIMIT 1'
);
if (!$stmtP) {
    echo '200,' . (int) $mysqli->errno;
    $mysqli->close();
    exit;
}
$stmtP->bind_param('i', $idPoruke);
if (!$stmtP->execute()) {
    echo '200,' . (int) $stmtP->errno;
    $stmtP->close();
    $mysqli->close();
    exit;
}
$resP = $stmtP->get_result();
$rowP = $resP ? $resP->fetch_assoc() : null;
$stmtP->close();
if (!$rowP) {
    echo '108,' . $idPoruke;
    $mysqli->close();
    exit;
}

$stmtT = $mysqli->prepare(
    'SELECT kod, tekst FROM `sustav_odgovori_razvoja_poruke` WHERE id = ? LIMIT 1'
);
if (!$stmtT) {
    echo '200,' . (int) $mysqli->errno;
    $mysqli->close();
    exit;
}
$stmtT->bind_param('i', $idPredlozak);
if (!$stmtT->execute()) {
    echo '200,' . (int) $stmtT->errno;
    $stmtT->close();
    $mysqli->close();
    exit;
}
$resT = $stmtT->get_result();
$rowT = $resT ? $resT->fetch_assoc() : null;
$stmtT->close();
if (!$rowT) {
    echo '108,' . $idPredlozak;
    $mysqli->close();
    exit;
}

$kod = (int) $rowT['kod'];
$tekstPredloska = isset($rowT['tekst']) ? (string) $rowT['tekst'] : '';
$trenutna = isset($rowP['poruka']) ? (string) $rowP['poruka'] : '';

if (strpos($tekstPredloska, '#') !== false) {
    /* Šifrirani tekst ne smije sadržavati '#' — inače se kvari sufiks. */
    echo '155';
    $mysqli->close();
    exit;
}

if ($brisiStare) {
    $baza = razvoj_ukloni_sve_odgovore($trenutna);
    $novaPoruka = razvoj_dodaj_odgovor($baza, $kod, $tekstPredloska);
} else {
    $novaPoruka = razvoj_dodaj_odgovor($trenutna, $kod, $tekstPredloska);
}

$stmtU = $mysqli->prepare('UPDATE sustav_sesije_poruke SET poruka = ? WHERE id = ? AND tip = \'Poruka razvoju\' AND brisano = 0');
if (!$stmtU) {
    echo '200,' . (int) $mysqli->errno;
    $mysqli->close();
    exit;
}
$stmtU->bind_param('si', $novaPoruka, $idPoruke);
if (!$stmtU->execute()) {
    echo '200,' . (int) $stmtU->errno;
    $stmtU->close();
    $mysqli->close();
    exit;
}
if ($stmtU->affected_rows < 1) {
    $stmtU->close();
    echo '108,' . $idPoruke;
    $mysqli->close();
    exit;
}
$stmtU->close();
$mysqli->close();
echo 'OK';

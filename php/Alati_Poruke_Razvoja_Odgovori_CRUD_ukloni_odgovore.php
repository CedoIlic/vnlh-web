<?php
/**
 * API: uklanjanje svih sufiksnih odgovora razvoja s poruke tipa „Poruka razvoju“.
 *
 * Polje sustav_sesije_poruke.poruka može na kraju imati jedan ili više blokova #<kod>*<tekst>#.
 * Ova skripta učitava tekst, primjenjuje razvoj_ukloni_sve_odgovore() (samo prefiks / baza)
 * i UPDATE-om snima očišćeni tekst. Red se ne briše (brisano ostaje 0).
 *
 * Ulaz: POST id (int, primarni ključ retka u sustav_sesije_poruke).
 * Izlaz: tekst „OK“ ili kod greške (105 = nevaljan id, 108 = red nije pronađen, 200,errno = SQL).
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

$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
if ($id <= 0) {
    echo '105';
    $mysqli->close();
    exit;
}

$stmtSel = $mysqli->prepare(
    'SELECT poruka FROM sustav_sesije_poruke WHERE id = ? AND tip = \'Poruka razvoju\' AND brisano = 0 LIMIT 1'
);
if (!$stmtSel) {
    echo '200,' . (int) $mysqli->errno;
    $mysqli->close();
    exit;
}
$stmtSel->bind_param('i', $id);
if (!$stmtSel->execute()) {
    echo '200,' . (int) $stmtSel->errno;
    $stmtSel->close();
    $mysqli->close();
    exit;
}
$resSel = $stmtSel->get_result();
$row = $resSel ? $resSel->fetch_assoc() : null;
$stmtSel->close();
if (!$row) {
    echo '108,' . $id;
    $mysqli->close();
    exit;
}

$stari = (string) $row['poruka'];
$novi = razvoj_ukloni_sve_odgovore($stari);

/* Ako nema sufiksnih blokova, tekst je već „čist“ — nema UPDATE-a, ali operacija je uspješna. */
if ($novi === $stari) {
    $mysqli->close();
    echo 'OK';
    exit;
}

$stmtUp = $mysqli->prepare(
    'UPDATE sustav_sesije_poruke SET poruka = ? WHERE id = ? AND tip = \'Poruka razvoju\' AND brisano = 0'
);
if (!$stmtUp) {
    echo '200,' . (int) $mysqli->errno;
    $mysqli->close();
    exit;
}
$stmtUp->bind_param('si', $novi, $id);
if (!$stmtUp->execute()) {
    echo '200,' . (int) $stmtUp->errno;
    $stmtUp->close();
    $mysqli->close();
    exit;
}
if ($stmtUp->affected_rows < 1) {
    $stmtUp->close();
    $mysqli->close();
    echo '108,' . $id;
    exit;
}
$stmtUp->close();
$mysqli->close();
echo 'OK';

<?php
/**
 * API: logičko brisanje jedne poruke tipa „Poruka razvoju“ (brisano = 1).
 * Ulaz: POST id (int, primarni ključ retka u sustav_sesije_poruke).
 * Izlaz: tekst „OK“ ili kod greške (105 = nevaljan id, 108 = red nije pronađen, 200,errno = SQL).
 */
require_once __DIR__ . '/require_login_api.php';
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

$stmt = $mysqli->prepare(
    'UPDATE sustav_sesije_poruke SET brisano = 1 WHERE id = ? AND tip = \'Poruka razvoju\' AND brisano = 0'
);
if (!$stmt) {
    echo '200,' . (int) $mysqli->errno;
    $mysqli->close();
    exit;
}

$stmt->bind_param('i', $id);
if (!$stmt->execute()) {
    echo '200,' . (int) $stmt->errno;
    $stmt->close();
    $mysqli->close();
    exit;
}

if ($stmt->affected_rows < 1) {
    /* Red ne postoji, već je obrisan ili nije tip „Poruka razvoju“. */
    $stmt->close();
    $mysqli->close();
    echo '108,' . $id;
    exit;
}

$stmt->close();
$mysqli->close();
echo 'OK';

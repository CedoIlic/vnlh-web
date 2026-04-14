<?php
/**
 * poruke_chat_brisi.php
 * API: logičko brisanje svih chat poruka između logiranog korisnika i sugovornika (samo tip = Chat poruka).
 *
 * POST:
 *   id_sugovornik (obavezno) – drugi sudionik
 *
 * Izlaz (text/plain): -1 uspjeh; 105 parametri; 200,errno SQL; 403 CHAT_DENIED
 */
require_once __DIR__ . '/require_login_api.php';

if (empty($_SESSION['chat_dozvoljen'])) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'CHAT_DENIED';
    exit;
}

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain; charset=utf-8');
    echo $db_ret;
    exit;
}

header('Content-Type: text/plain; charset=utf-8');

$idJa = (int) ($_SESSION['id_korisnik'] ?? 0);
$idSug = isset($_POST['id_sugovornik']) ? (int) $_POST['id_sugovornik'] : 0;

if ($idJa <= 0 || $idSug <= 0 || $idSug === $idJa) {
    echo '105';
    $mysqli->close();
    exit;
}

$sql = '
    UPDATE sustav_sesije_poruke
       SET brisano = 1
     WHERE tip = \'Chat poruka\'
       AND ((id_posiljatelj = ? AND id_primatelj = ?)
         OR (id_posiljatelj = ? AND id_primatelj = ?))
';

$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    $mysqli->close();
    exit;
}

$stmt->bind_param('iiii', $idSug, $idJa, $idJa, $idSug);

if (!$stmt->execute()) {
    echo '200,' . $stmt->errno;
    $stmt->close();
    $mysqli->close();
    exit;
}

$stmt->close();
$mysqli->close();

echo '-1';

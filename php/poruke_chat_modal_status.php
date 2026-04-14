<?php
/**
 * poruke_chat_modal_status.php
 * API: stanje chat modala u sustav_sesije_aktivne (bez $_SESSION chat_aktivan).
 *
 * POST:
 *   akcija         – 'otvori' | 'zatvori' (obavezno)
 *   id_sugovornik  – za otvori: sustav_korisnici.id_korisnik sugovornika (>0)
 *
 * Izlaz (text/plain):
 *   -1  uspjeh
 *   105 nedostaje/loša akcija
 *   106 id_sugovornik nevaljan
 *   403 CHAT_DENIED (nema prava na chat)
 *   200,<errno> SQL
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

$akcija = isset($_POST['akcija']) ? trim((string) $_POST['akcija']) : '';
$idJa = (int) ($_SESSION['id_korisnik'] ?? 0);
$sid = session_id();

if ($sid === '' || $idJa <= 0) {
    echo '105';
    exit;
}

if ($akcija !== 'otvori' && $akcija !== 'zatvori') {
    $mysqli->close();
    echo '105';
    exit;
}

if ($akcija === 'zatvori') {
    $sql = 'UPDATE sustav_sesije_aktivne
               SET chat_modal_otvoren = 0, chat_modal_sugovornik_id = 0
             WHERE session_id = ? AND id_korisnik = ? AND status = \'aktivna\'';
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        $mysqli->close();
        exit;
    }
    $stmt->bind_param('si', $sid, $idJa);
    $stmt->execute();
    $stmt->close();
    $mysqli->close();
    echo '-1';
    exit;
}

$idSug = isset($_POST['id_sugovornik']) ? (int) $_POST['id_sugovornik'] : 0;
if ($idSug <= 0 || $idSug === $idJa) {
    echo '106';
    $mysqli->close();
    exit;
}

$sql = 'UPDATE sustav_sesije_aktivne
           SET chat_modal_otvoren = 1, chat_modal_sugovornik_id = ?
         WHERE session_id = ? AND id_korisnik = ? AND status = \'aktivna\'';
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    $mysqli->close();
    exit;
}
$stmt->bind_param('isi', $idSug, $sid, $idJa);
$stmt->execute();
$stmt->close();
$mysqli->close();
echo '-1';

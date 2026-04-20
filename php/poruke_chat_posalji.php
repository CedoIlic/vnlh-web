<?php
/**
 * poruke_chat_posalji.php
 * API: slanje jedne chat poruke (INSERT tip = Chat poruka).
 *
 * POST:
 *   id_sugovornik (obavezno) – primatelj (sustav_korisnici.id_korisnik)
 *   poruka        (obavezno) – tekst
 *   id_razgovor   (opcionalno) – nastavak niti; 0 = automatski (postojeći chat par ili novi MAX+1)
 *
 * Izlaz (text/plain): -1 uspjeh; 105 parametri; CHAT_SUGOVORNIK_NEAKTIVAN ako primatelj nema aktivnu sesiju;
 * 200,errno SQL; 403 CHAT_DENIED
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

require_once __DIR__ . '/Alati_Sesije_Aktivne.php';
Alati_Sesije_Aktivne_reconcile_timeout_stale_aktivne($mysqli);

header('Content-Type: text/plain; charset=utf-8');

$idJa = (int) ($_SESSION['id_korisnik'] ?? 0);
$idSug = isset($_POST['id_sugovornik']) ? (int) $_POST['id_sugovornik'] : 0;
$poruka = isset($_POST['poruka']) ? trim((string) $_POST['poruka']) : '';
$idRazUlaz = isset($_POST['id_razgovor']) ? (int) $_POST['id_razgovor'] : 0;

if ($idJa <= 0 || $idSug <= 0 || $idSug === $idJa || $poruka === '') {
    echo '105';
    $mysqli->close();
    exit;
}

require_once __DIR__ . '/poruke_chat_sesija.php';

if (!poruke_chat_je_korisnik_aktivan($mysqli, $idSug)) {
    echo 'CHAT_SUGOVORNIK_NEAKTIVAN';
    $mysqli->close();
    exit;
}

$idRazgovor = 0;
if ($idRazUlaz > 0 && poruke_chat_id_razgovor_valjan_za_par($mysqli, $idJa, $idSug, $idRazUlaz)) {
    $idRazgovor = $idRazUlaz;
} else {
    $idRazgovor = poruke_chat_zadnji_id_razgovor($mysqli, $idJa, $idSug);
}

if ($idRazgovor <= 0) {
    $sqlMax = 'SELECT COALESCE(MAX(id_razgovor), 0) + 1 AS novi FROM sustav_sesije_poruke WHERE tip = \'Chat poruka\'';
    $resMax = $mysqli->query($sqlMax);
    if ($resMax) {
        $rowMax = $resMax->fetch_assoc();
        $idRazgovor = $rowMax ? (int) $rowMax['novi'] : 1;
    } else {
        $idRazgovor = 1;
    }
}

$sessionId = session_id();

$sql = '
    INSERT INTO sustav_sesije_poruke
        (id_razgovor, id_posiljatelj, id_primatelj, session_id_posiljatelj, poruka, vrijeme_slanja, status, tip, brisano)
    VALUES
        (?, ?, ?, ?, ?, NOW(), \'Novo\', \'Chat poruka\', 0)
';

$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    $mysqli->close();
    exit;
}

$stmt->bind_param('iiiss', $idRazgovor, $idJa, $idSug, $sessionId, $poruka);

if (!$stmt->execute()) {
    echo '200,' . $stmt->errno;
    $stmt->close();
    $mysqli->close();
    exit;
}

$stmt->close();
$mysqli->close();

echo '-1';

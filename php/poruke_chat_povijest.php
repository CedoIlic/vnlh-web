<?php
/**
 * poruke_chat_povijest.php
 * API: povijest chat poruka (tip = Chat poruka) između logiranog korisnika i sugovornika.
 *
 * GET:
 *   id_sugovornik (obavezno) – sustav_korisnici.id_korisnik drugog sudionika
 *
 * Izlaz (JSON):
 *   { "id_razgovor": int, "sugovornik_aktivan": 0|1, "poruke": [ ... ] } — polje poruke: novije prvo (ORDER vrijeme_slanja DESC, id DESC).
 *   sugovornik_aktivan: ima li sugovornik aktivnu sesiju (isto kao poruke_chat_aktivni_korisnici.php) – UI onemogućuje slanje ako 0.
 *   smjer: "primljena" | "odgovor" (isti jezik kao 0-Poruke_poruke.php)
 *
 * Nakon SELECT-a: nepročitane primljene chat poruke → status Pročitano (triggeri ažuriraju ima_chat_neprocitanih).
 *
 * 403 CHAT_DENIED ako nema chat_dozvoljen u sesiji.
 */
require_once __DIR__ . '/require_login_api.php';

if (empty($_SESSION['chat_dozvoljen'])) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'CHAT_DENIED'], JSON_UNESCAPED_UNICODE);
    exit;
}

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain; charset=utf-8');
    echo $db_ret;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$idJa = (int) ($_SESSION['id_korisnik'] ?? 0);
$idSug = isset($_GET['id_sugovornik']) ? (int) $_GET['id_sugovornik'] : 0;

if ($idJa <= 0 || $idSug <= 0 || $idSug === $idJa) {
    header('Content-Type: text/plain; charset=utf-8');
    echo '105';
    $mysqli->close();
    exit;
}

require_once __DIR__ . '/poruke_chat_sesija.php';
$idRazTrenutni = poruke_chat_zadnji_id_razgovor($mysqli, $idJa, $idSug);

$sqlSelect = '
    SELECT
        p.id,
        p.id_razgovor,
        p.poruka,
        p.vrijeme_slanja,
        p.id_posiljatelj,
        p.id_primatelj,
        p.status
    FROM sustav_sesije_poruke p
    WHERE p.brisano = 0
      AND p.tip = \'Chat poruka\'
      AND ((p.id_posiljatelj = ? AND p.id_primatelj = ?)
       OR (p.id_posiljatelj = ? AND p.id_primatelj = ?))
    ORDER BY p.vrijeme_slanja DESC, p.id DESC
';

$stmtSel = $mysqli->prepare($sqlSelect);
if (!$stmtSel) {
    echo json_encode(['error' => '200', 'sql_errno' => $mysqli->errno], JSON_UNESCAPED_UNICODE);
    $mysqli->close();
    exit;
}

$stmtSel->bind_param('iiii', $idSug, $idJa, $idJa, $idSug);

if (!$stmtSel->execute()) {
    echo json_encode(['error' => '200', 'sql_errno' => $stmtSel->errno], JSON_UNESCAPED_UNICODE);
    $stmtSel->close();
    $mysqli->close();
    exit;
}

$result = $stmtSel->get_result();
$poruke = [];

while ($row = $result->fetch_assoc()) {
    $smjer = ((int) $row['id_posiljatelj'] === $idJa) ? 'odgovor' : 'primljena';
    $procitano = ($row['status'] === 'Pročitano') ? 1 : 0;

    $poruke[] = [
        'id'             => (int) $row['id'],
        'id_razgovor'    => (int) $row['id_razgovor'],
        'poruka'         => $row['poruka'] ?? '',
        'vrijeme_slanja' => $row['vrijeme_slanja'] ?? '',
        'smjer'          => $smjer,
        'procitano'      => $procitano,
    ];
}

$stmtSel->close();

$sqlUpdate = '
    UPDATE sustav_sesije_poruke
       SET status = \'Pročitano\', vrijeme_procitano = NOW()
     WHERE id_primatelj = ?
       AND id_posiljatelj = ?
       AND status = \'Novo\'
       AND brisano = 0
       AND tip = \'Chat poruka\'
';
$stmtUpd = $mysqli->prepare($sqlUpdate);
if ($stmtUpd) {
    $stmtUpd->bind_param('ii', $idJa, $idSug);
    $stmtUpd->execute();
    $stmtUpd->close();
}

$sugovornikAktivan = poruke_chat_je_korisnik_aktivan($mysqli, $idSug) ? 1 : 0;

$mysqli->close();

echo json_encode(
    [
        'id_razgovor'         => $idRazTrenutni,
        'sugovornik_aktivan'  => $sugovornikAktivan,
        'poruke'              => $poruke,
    ],
    JSON_UNESCAPED_UNICODE
);

<?php
/**
 * poruke_chat_aktivni_korisnici.php
 * API: lista za popup chata – aktivni korisnici (sustav_sesije_aktivne) PLUS pošiljatelji s barem jednom
 * nepročitanom primljenom chat porukom (status Novo, tip Chat poruka) čak i ako više nisu aktivni.
 *
 * Izlaz (JSON): niz objekata:
 *   id (int), prezime (string), ime (string),
 *   aktivan (0|1) – ima li aktivnu sesiju (isti kriterij kao sustav_sesije_aktivne.status = aktivna),
 *   ima_neprocitanih_chat (0|1) – ima li barem jednu nepročitanu primljenu chat poruku od tog korisnika.
 * Bez trenutno logiranog korisnika; DISTINCT po id. Sort: prezime, ime.
 *
 * Boja imena u UI (0-Chat.css): aktivan bez nepročitanih → sistemska; aktivan + nepročitano → --c-red-900;
 * neaktivan + nepročitano → --c-red-500 (neaktivni bez nepročitanih nisu u listi). Težina fonta ista kao ostali redovi.
 *
 * 403 CHAT_DENIED ako nema chat_dozvoljen u sesiji.
 *
 * Prije SELECT-a: reconciliacija „starih” aktivnih sesija (zadnja_aktivnost starija od idle praga → timeout),
 * inače bi korisnici bez pinga ostali vječno „aktivni” u listi dok netko ne otvori Alati / aktivne sesije.
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

require_once __DIR__ . '/Alati_Sesije_Aktivne.php';
Alati_Sesije_Aktivne_reconcile_timeout_stale_aktivne($mysqli);

header('Content-Type: application/json; charset=utf-8');

$idJa = (int) ($_SESSION['id_korisnik'] ?? 0);
if ($idJa <= 0) {
    echo json_encode([], JSON_UNESCAPED_UNICODE);
    $mysqli->close();
    exit;
}

require_once __DIR__ . '/poruke_chat_sesija.php';

/*
 * Korak 1: DISTINCT pošiljatelji s nepročitanom primljenom chat porukom (primatelj = ja).
 * Isti semantički model kao označavanje „Novo” u poruke_chat_povijest.php prije UPDATE-a u Pročitano.
 */
$sqlNeproc = '
    SELECT DISTINCT p.id_posiljatelj AS id, c.prezime, c.ime
      FROM sustav_sesije_poruke p
      LEFT JOIN clanovi c ON c.id = p.id_posiljatelj
     WHERE p.tip = \'Chat poruka\'
       AND p.brisano = 0
       AND p.id_primatelj = ?
       AND p.id_posiljatelj <> ?
       AND p.status = \'Novo\'
';

$stmtN = $mysqli->prepare($sqlNeproc);
if (!$stmtN) {
    echo json_encode(['error' => '200', 'sql_errno' => $mysqli->errno], JSON_UNESCAPED_UNICODE);
    $mysqli->close();
    exit;
}
$stmtN->bind_param('ii', $idJa, $idJa);
if (!$stmtN->execute()) {
    echo json_encode(['error' => '200', 'sql_errno' => $stmtN->errno], JSON_UNESCAPED_UNICODE);
    $stmtN->close();
    $mysqli->close();
    exit;
}
$resN = $stmtN->get_result();
$neprocitaniPoId = [];
while ($rowN = $resN->fetch_assoc()) {
    $nid = (int) ($rowN['id'] ?? 0);
    if ($nid <= 0 || $nid === $idJa) {
        continue;
    }
    $neprocitaniPoId[$nid] = [
        'id'      => $nid,
        'prezime' => isset($rowN['prezime']) ? trim((string) $rowN['prezime']) : '',
        'ime'     => isset($rowN['ime']) ? trim((string) $rowN['ime']) : '',
    ];
}
$stmtN->close();

/*
 * Korak 2: aktivni korisnici (kao prije), s oznakom ima_neprocitanih_chat ako su u koraku 1.
 */
$sqlAkt = '
    SELECT DISTINCT sa.id_korisnik AS id, c.prezime, c.ime
      FROM sustav_sesije_aktivne sa
      LEFT JOIN clanovi c ON c.id = sa.id_korisnik
     WHERE sa.status = \'aktivna\'
       AND sa.id_korisnik <> ?
     ORDER BY c.prezime ASC, c.ime ASC
';

$stmt = $mysqli->prepare($sqlAkt);
if (!$stmt) {
    echo json_encode(['error' => '200', 'sql_errno' => $mysqli->errno], JSON_UNESCAPED_UNICODE);
    $mysqli->close();
    exit;
}
$stmt->bind_param('i', $idJa);
if (!$stmt->execute()) {
    echo json_encode(['error' => '200', 'sql_errno' => $stmt->errno], JSON_UNESCAPED_UNICODE);
    $stmt->close();
    $mysqli->close();
    exit;
}

$res = $stmt->get_result();
$byId = [];
while ($row = $res->fetch_assoc()) {
    $id = (int) $row['id'];
    if ($id <= 0) {
        continue;
    }
    $byId[$id] = [
        'id'                    => $id,
        'prezime'               => isset($row['prezime']) ? trim((string) $row['prezime']) : '',
        'ime'                   => isset($row['ime']) ? trim((string) $row['ime']) : '',
        'aktivan'               => 1,
        'ima_neprocitanih_chat' => isset($neprocitaniPoId[$id]) ? 1 : 0,
    ];
}
$stmt->close();

/*
 * Korak 3: pošiljatelji s nepročitanima koji nisu u listi aktivnih (npr. virtualni test ili odjavljeni).
 * aktivan se računa zasebno (često 0).
 */
foreach ($neprocitaniPoId as $nid => $meta) {
    if (isset($byId[$nid])) {
        continue;
    }
    $byId[$nid] = [
        'id'                    => $nid,
        'prezime'               => $meta['prezime'],
        'ime'                   => $meta['ime'],
        'aktivan'               => poruke_chat_je_korisnik_aktivan($mysqli, $nid) ? 1 : 0,
        'ima_neprocitanih_chat' => 1,
    ];
}

$out = array_values($byId);
usort(
    $out,
    static function (array $a, array $b): int {
        $pa = ($a['prezime'] ?? '') . ' ' . ($a['ime'] ?? '');
        $pb = ($b['prezime'] ?? '') . ' ' . ($b['ime'] ?? '');
        return strcasecmp($pa, $pb);
    }
);

$mysqli->close();

echo json_encode($out, JSON_UNESCAPED_UNICODE);

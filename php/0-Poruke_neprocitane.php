<?php
// =====================================================
// 0-Poruke_neprocitane.php
// API: postoje li nepročitane poruke za logiranog korisnika.
// Lagani endpoint za polling (mail ikona boja).
//
// Optimizacija: umjesto COUNT(*) na tablici poruka (koja raste),
// čita flagove ima_neprocitanih (mail) i ima_chat_neprocitanih iz sustav_sesije_aktivne
// (lookup po session_id). Migracija: sql/sustav_sesije_aktivne_chat_kolone_i_triggere.sql
// Flagove ažuriraju: triggeri na sustav_sesije_poruke, Login COUNT, 0-Poruke_brisi (UPDATE brisano).
//
// Ulaz: nema parametara (koristi session_id() za lookup)
//
// Izlaz:
//   (JSON) Uspjeh: {
//     "neprocitane": 0|1,
//     "chat_neprocitane": 0|1,
//     "chat_zadnja_neprocitana_id": 0 ili MAX(id) nepročitane Chat poruke (primatelj = ja),
//     "chat_sugovornik_id": 0 ili id_posiljatelj te poruke (za auto-otvaranje modala),
//     "chat_sugovornik_prezime", "chat_sugovornik_ime": iz clanovi (kao poruke_chat_aktivni_korisnici.php)
//   }
//   (TEXT) Greška konekcije: 100
//   (TEXT) SQL greška: 200
// =====================================================

require_once __DIR__ . '/require_login_api.php';

// --- Blok: Konekcija na bazu ---
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

// --- Blok: Čitaj flag ima_neprocitanih iz sustav_sesije_aktivne ---
// Lookup po UNIQUE KEY session_id – najbrži mogući upit na ovoj tablici.
$sessionId = session_id();

$sql = "SELECT ima_neprocitanih, ima_chat_neprocitanih FROM sustav_sesije_aktivne WHERE session_id = ? AND status = 'aktivna' LIMIT 1";

$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    echo json_encode(['error' => '200', 'sql_errno' => $mysqli->errno]);
    exit;
}

$stmt->bind_param('s', $sessionId);

if (!$stmt->execute()) {
    echo json_encode(['error' => '200', 'sql_errno' => $stmt->errno]);
    $stmt->close();
    exit;
}

$result = $stmt->get_result();
$row = $result->fetch_assoc();
// Ako sesija nije nađena (timeout/odjava), sigurno nema nepročitanih
$flagMail = $row ? (int) $row['ima_neprocitanih'] : 0;
$flagChat = $row ? (int) ($row['ima_chat_neprocitanih'] ?? 0) : 0;

$stmt->close();

$idJa = (int) ($_SESSION['id_korisnik'] ?? 0);
$chatZadnjaId = 0;
$chatSugId = 0;
$chatSugPrez = '';
$chatSugIme = '';

if ($idJa > 0 && $flagChat === 1) {
    $sqlChat = '
        SELECT p.id AS zid, p.id_posiljatelj AS sid, c.prezime, c.ime
          FROM sustav_sesije_poruke p
          LEFT JOIN clanovi c ON c.id = p.id_posiljatelj
         WHERE p.id_primatelj = ?
           AND p.tip = \'Chat poruka\'
           AND p.status = \'Novo\'
           AND p.brisano = 0
         ORDER BY p.id DESC
         LIMIT 1
    ';
    $st2 = $mysqli->prepare($sqlChat);
    if ($st2) {
        $st2->bind_param('i', $idJa);
        if ($st2->execute()) {
            $r2 = $st2->get_result()->fetch_assoc();
            if ($r2) {
                $chatZadnjaId = (int) ($r2['zid'] ?? 0);
                $chatSugId = (int) ($r2['sid'] ?? 0);
                $chatSugPrez = isset($r2['prezime']) ? trim((string) $r2['prezime']) : '';
                $chatSugIme = isset($r2['ime']) ? trim((string) $r2['ime']) : '';
            }
        }
        $st2->close();
    }
}

$mysqli->close();

echo json_encode([
    'neprocitane' => $flagMail,
    'chat_neprocitane' => $flagChat,
    'chat_zadnja_neprocitana_id' => $chatZadnjaId,
    'chat_sugovornik_id' => $chatSugId,
    'chat_sugovornik_prezime' => $chatSugPrez,
    'chat_sugovornik_ime' => $chatSugIme,
], JSON_UNESCAPED_UNICODE);

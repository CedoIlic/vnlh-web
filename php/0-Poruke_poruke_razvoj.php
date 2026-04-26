<?php
// =====================================================
// 0-Poruke_poruke_razvoj.php
// API: povijest poruka tipa „Poruka razvoju" primljenih od logiranog korisnika.
// Svaka poruka razvoju ide svim primateljima iz var. 1002 — svaki čita svoju kopiju (id_primatelj = ja).
// Poredak: najnovije poruke prve (vrijeme_slanja DESC).
//
// Ulaz: GET (bez parametara) – id korisnika iz sesije.
//
// Izlaz: JSON niz [{ id, id_razgovor, poruka, vrijeme_slanja, smjer, procitano, clan_prezime, clan_ime }, …]
//   smjer: 'odgovor' = ja sam pošiljatelj | 'primljena' = netko drugi je pošiljatelj
//   clan_prezime, clan_ime: ime pošiljatelja (iz clanovi)
//   (TEXT) Greška konekcije: 100 | SQL greška: 200
// =====================================================

require_once __DIR__ . '/require_login_api.php';

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$idKorisnik = (int) $_SESSION['id_korisnik'];

$sql = "
    SELECT
        p.id,
        p.id_razgovor,
        p.id_posiljatelj,
        p.poruka,
        p.vrijeme_slanja,
        p.status,
        c.prezime AS clan_prezime,
        c.ime     AS clan_ime
    FROM sustav_sesije_poruke p
    LEFT JOIN clanovi c ON c.id = p.id_posiljatelj
    WHERE p.brisano = 0
      AND p.tip = 'Poruka razvoju'
      AND p.id_primatelj = ?
    ORDER BY p.vrijeme_slanja DESC, p.id DESC
";

$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    echo json_encode(['error' => '200', 'sql_errno' => $mysqli->errno], JSON_UNESCAPED_UNICODE);
    exit;
}

$stmt->bind_param('i', $idKorisnik);

if (!$stmt->execute()) {
    echo json_encode(['error' => '200', 'sql_errno' => $stmt->errno], JSON_UNESCAPED_UNICODE);
    $stmt->close();
    exit;
}

$result = $stmt->get_result();
$poruke = [];

while ($row = $result->fetch_assoc()) {
    $procitano = ($row['status'] === 'Pročitano') ? 1 : 0;
    $smjer = ((int) $row['id_posiljatelj'] === $idKorisnik) ? 'odgovor' : 'primljena';
    $poruke[] = [
        'id'             => (int) $row['id'],
        'id_razgovor'    => (int) $row['id_razgovor'],
        'poruka'         => $row['poruka'] ?? '',
        'vrijeme_slanja' => $row['vrijeme_slanja'] ?? '',
        'smjer'          => $smjer,
        'procitano'      => $procitano,
        'clan_prezime'   => $row['clan_prezime'] ?? '',
        'clan_ime'       => $row['clan_ime'] ?? '',
    ];
}

$stmt->close();

// Označi nepročitane primljene poruke kao pročitane (trigger ažurira ima_neprocitanih automatski).
$stmtUpd = $mysqli->prepare("UPDATE sustav_sesije_poruke SET status = 'Pročitano', vrijeme_procitano = NOW() WHERE id_primatelj = ? AND tip = 'Poruka razvoju' AND status = 'Novo' AND brisano = 0");
if ($stmtUpd) {
    $stmtUpd->bind_param('i', $idKorisnik);
    $stmtUpd->execute();
    $stmtUpd->close();
}

$mysqli->close();

echo json_encode($poruke, JSON_UNESCAPED_UNICODE);

<?php
// =====================================================
// 0-Poruke_poruke.php
// API: dohvat poruka (samo tip = 'Poruka') između logiranog korisnika i odabranog pošiljatelja.
// Chat (tip = 'Chat poruka') je odvojen – poruke_chat_povijest.php. Ne miješati tipove.
// Dohvaća poruke u OBA smjera (primljene + poslane) – cijeli razgovor.
// Poruke su sortirane po id_razgovor, vrijeme_slanja.
// Nepročitane primljene poruke se označavaju kao pročitane (status='Pročitano').
// SQL isključuje brisano=1 (rezime kolone: vidi zaglavlje 0-Poruke_brisi.php).
//
// Ulaz (GET):
//   id_posiljatelj (obavezno) – ID korisnika čije poruke čitamo
//
// Izlaz:
//   (JSON) Uspjeh: niz objekata [{id, id_razgovor, poruka, vrijeme_slanja, smjer, procitano}, ...]
//     smjer: 'primljena' = poruka koju je poslao drugi korisnik ovom,
//            'odgovor'   = poruka koju je ovaj korisnik poslao drugom
//     procitano: 1 = pročitana, 0 = nepročitana
//   (TEXT) Greška konekcije: 100
//   (TEXT) Nedostaje id: 105
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

// --- Blok: Parametri ---
$idPosiljatelj = isset($_GET['id_posiljatelj']) ? (int) $_GET['id_posiljatelj'] : 0;
if ($idPosiljatelj <= 0) {
    header('Content-Type: text/plain');
    echo '105';
    exit;
}

$idKorisnik = (int) $_SESSION['id_korisnik'];

// --- Blok: PRVO dohvat poruka (da vidimo originalni status PRIJE označavanja) ---
// Smjer: primljena = id_posiljatelj->ovaj korisnik; odgovor = ovaj korisnik->id_posiljatelj.
$sqlSelect = "
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
      AND p.tip = 'Poruka'
      AND ((p.id_posiljatelj = ? AND p.id_primatelj = ?)
       OR (p.id_posiljatelj = ? AND p.id_primatelj = ?))
    ORDER BY p.id_razgovor ASC, p.vrijeme_slanja ASC
";

$stmtSel = $mysqli->prepare($sqlSelect);
if (!$stmtSel) {
    echo json_encode(['error' => '200', 'sql_errno' => $mysqli->errno]);
    exit;
}

$stmtSel->bind_param('iiii', $idPosiljatelj, $idKorisnik, $idKorisnik, $idPosiljatelj);

if (!$stmtSel->execute()) {
    echo json_encode(['error' => '200', 'sql_errno' => $stmtSel->errno]);
    $stmtSel->close();
    exit;
}

$result = $stmtSel->get_result();
$poruke = [];

while ($row = $result->fetch_assoc()) {
    $smjer = ((int) $row['id_posiljatelj'] === $idKorisnik) ? 'odgovor' : 'primljena';
    // Pročitano flag čuva ORIGINALNI status (Novo/Pročitano) – 
    // frontend koristi ovo za razliku boja između novih i već viđenih poruka
    $procitano = ($row['status'] === 'Pročitano') ? 1 : 0;

    $poruke[] = [
        'id'             => (int) $row['id'],
        'id_razgovor'    => (int) $row['id_razgovor'],
        'poruka'         => $row['poruka'] ?? '',
        'vrijeme_slanja' => $row['vrijeme_slanja'] ?? '',
        'smjer'          => $smjer,
        'procitano'      => $procitano
    ];
}

$stmtSel->close();

// --- Blok: NAKON dohvata – označi nepročitane primljene poruke kao pročitane ---
// Redoslijed: SELECT pa UPDATE – da frontend dobije originalni status za prikaz boja
$sqlUpdate = "
    UPDATE sustav_sesije_poruke
    SET status = 'Pročitano', vrijeme_procitano = NOW()
    WHERE id_primatelj = ? AND id_posiljatelj = ? AND status = 'Novo' AND brisano = 0
      AND tip = 'Poruka'
";
$stmtUpd = $mysqli->prepare($sqlUpdate);
if ($stmtUpd) {
    $stmtUpd->bind_param('ii', $idKorisnik, $idPosiljatelj);
    $stmtUpd->execute();
    $stmtUpd->close();
}
// Flag ima_neprocitanih u sustav_sesije_aktivne ažurira trg_poruke_after_update automatski.

$mysqli->close();

echo json_encode($poruke, JSON_UNESCAPED_UNICODE);

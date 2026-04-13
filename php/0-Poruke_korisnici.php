<?php
// =====================================================
// 0-Poruke_korisnici.php
// API: dohvat svih korisnika iz sustav_korisnici kojima se može poslati poruka.
// JOIN na clanovi za prezime/ime. Isključuje logged korisnika.
//
// Ulaz: nema parametara (GET)
//
// Izlaz:
//   (JSON) [ { id_korisnik, prezime, ime }, ... ]
//   (TEXT) Greška konekcije: 100
//   (TEXT) SQL greška: 200,<sql_errno>
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

$idKorisnik = (int) $_SESSION['id_korisnik'];

// --- Blok: Dohvat korisnika iz sustav_korisnici JOIN clanovi ---
// DISTINCT jer isti korisnik može imati više dužnosti (redaka u sustav_korisnici).
// Isključuje trenutno logiranog korisnika (nema smisla slati poruku samom sebi).
$sql = "
    SELECT DISTINCT sk.id_korisnik, c.prezime, c.ime
    FROM sustav_korisnici sk
    LEFT JOIN clanovi c ON c.id = sk.id_korisnik
    WHERE sk.id_korisnik != ?
    ORDER BY c.prezime ASC, c.ime ASC
";

$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    echo json_encode(['error' => '200', 'sql_errno' => $mysqli->errno]);
    exit;
}

$stmt->bind_param('i', $idKorisnik);

if (!$stmt->execute()) {
    echo json_encode(['error' => '200', 'sql_errno' => $stmt->errno]);
    $stmt->close();
    exit;
}

$result = $stmt->get_result();
$lista = [];

while ($row = $result->fetch_assoc()) {
    $lista[] = [
        'id_korisnik' => (int) $row['id_korisnik'],
        'prezime'     => $row['prezime'] ?? '',
        'ime'         => $row['ime'] ?? ''
    ];
}

$stmt->close();
$mysqli->close();

echo json_encode($lista, JSON_UNESCAPED_UNICODE);

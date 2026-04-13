<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Stupnjevi_CRUD_slika.php
// Dohvat kolone slika za selektirani red (samo za ovu formu)
// =====================================================
//
// Blokovi: Konekcija na bazu, Validacija ulaza, Dohvat slike i MIME, ispis tijela.
// Ulaz (GET): id (obavezno, id stupnja)
// Izlaz: binarno tijelo kolone slika, Content-Type iz slika_mime;
//        id ≤ 0 ili nema reda → 200, text/plain "108,<id>" (greška);
//        red postoji ali slika NULL/prazna → 200, prazno tijelo (nije greška).
// Koristi: 00_db.php ($mysqli)
// =====================================================

// --- Blok: Konekcija na bazu ---
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    /* Greška konekcije; 500 i kod (100 ili drugi). */
    http_response_code(500);
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

// --- Blok: Validacija ulaza ---
$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($id <= 0) {
    /* id nedostaje ili nije > 0 → greška 108. */
    header('Content-Type: text/plain');
    echo '108,' . $id;
    exit;
}

// --- Blok: Dohvat slike i MIME ---
$sql = "SELECT slika, slika_mime FROM stupnjevi WHERE id = ? LIMIT 1";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    /* prepare() nije uspio → 500 i SQL kod. */
    http_response_code(500);
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param("i", $id);
$stmt->execute();
$result = $stmt->get_result();
$row = $result ? $result->fetch_assoc() : null;
$stmt->close();
$mysqli->close();

if (!$row) {
    /* Red ne postoji → greška 108. */
    header('Content-Type: text/plain');
    echo '108,' . $id;
    exit;
}
if ($row['slika'] === null || $row['slika'] === '') {
    /* Red postoji, slika nije upisana → nije greška, vraćamo prazno (null za sliku). */
    http_response_code(200);
    exit;
}

/* MIME iz baze ili default za binarno. */
$mime = !empty($row['slika_mime']) ? trim($row['slika_mime']) : 'application/octet-stream';
header('Content-Type: ' . $mime);
echo $row['slika'];

<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Stupnjevi_CRUD_sve.php
// Dohvat stupnjeva za obred (bez kolona slika)
// =====================================================
//
// Ulaz (GET), jedan od načina:
//   id_loza  – id reda u loze; id_obred se čita iz loze.id_obred; id_tip_loze iz istog retka. Ako je id_tip_loze > 0,
//              u rezultat ulaze samo stupnjevi upisani u loze_tip_stupanj_enum za taj loze_tip (id_vlasnik = id_tip_loze,
//              id_pozicija = 1) – isto polje "Stupnjevi nadležnosti" kao u Loze_Tip_CRUD (upis: Loze_Tip_CRUD_enum_stupnjevi_upis.php).
//              Ako nema tipa lože (NULL/0) ili nema nijednog retka u enumu za tip, ponašanje: bez tipa = svi stupnjevi tog obreda;
//              s tipom ali prazan enum = prazna lista (INNER JOIN).
//   obred_id – izravan id obreda (stari modul, kao dosad) – nema filtra po loze_tip / enumu.
// Izlaz (JSON): [ { "id": 1, "id_obred": 1, "naziv": "...", "stupanj": 0, "ima_sliku": 1 }, ... ]
//               ima_sliku: 1 ako je slika IS NOT NULL, 0 ako je NULL
// Greška (TEXT): 100 | 105 | 200,<errno>
// Koristi: 00_db.php ($mysqli)
// =====================================================

// --- Blok: Konekcija na bazu ---
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

// --- Blok: Validacija ulaza i id_obred (iz loze ili iz GET obred_id) ---
$id_loza  = isset($_GET['id_loza'])  ? (int) $_GET['id_loza']  : 0;
$obred_id = isset($_GET['obred_id']) ? (int) $_GET['obred_id'] : 0;

// Ako se traži po id_loza, nakon ove grane: $obred_id, eventualno $id_tip_loze_za_filtar (>0 kad treba ograničiti na enum nadležnosti).
$id_tip_loze_za_filtar = 0;
if ($id_loza > 0) {
    $stL = $mysqli->prepare('SELECT id_obred, id_tip_loze FROM loze WHERE id = ? LIMIT 1');
    if (!$stL) {
        header('Content-Type: text/plain');
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stL->bind_param('i', $id_loza);
    $stL->execute();
    $resL = $stL->get_result();
    if (!$resL) {
        header('Content-Type: text/plain');
        echo '200,' . $mysqli->errno;
        $stL->close();
        $mysqli->close();
        exit;
    }
    $lozaRow = $resL->fetch_assoc();
    $stL->close();
    if (!$lozaRow || (int) ($lozaRow['id_obred'] ?? 0) <= 0) {
        $mysqli->close();
        header('Content-Type: text/plain');
        echo '105';
        exit;
    }
    $obred_id = (int) $lozaRow['id_obred'];
    if (isset($lozaRow['id_tip_loze']) && $lozaRow['id_tip_loze'] !== null && (string) $lozaRow['id_tip_loze'] !== '') {
        $id_tip_loze_za_filtar = (int) $lozaRow['id_tip_loze'];
    }
} elseif ($obred_id <= 0) {
    header('Content-Type: text/plain');
    echo '105';
    exit;
}

// --- Blok: Dohvat stupnjeva (bez slika) ---
if ($id_tip_loze_za_filtar > 0) {
    // Povezano s Loze_Tip: tablica loze_tip_stupanj_enum (id_pozicija 1 = stupnjevi nadležnosti u Loze_Tip_CRUD).
    $sql = 'SELECT s.id, s.id_obred, s.naziv, s.stupanj, (s.slika IS NOT NULL) AS ima_sliku'
        . ' FROM stupnjevi s'
        . ' INNER JOIN loze_tip_stupanj_enum e ON e.id_stupanj = s.id AND e.id_vlasnik = ? AND e.id_pozicija = 1'
        . ' WHERE s.id_obred = ?'
        . ' ORDER BY s.stupanj ASC, s.naziv ASC';
} else {
    $sql = 'SELECT id, id_obred, naziv, stupanj, (slika IS NOT NULL) AS ima_sliku FROM stupnjevi WHERE id_obred = ? ORDER BY stupanj ASC, naziv ASC';
}
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
if ($id_tip_loze_za_filtar > 0) {
    $stmt->bind_param('ii', $id_tip_loze_za_filtar, $obred_id);
} else {
    $stmt->bind_param('i', $obred_id);
}
$stmt->execute();
$result = $stmt->get_result();
if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}

$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
$stmt->close();
$mysqli->close();

header('Content-Type: application/json');
echo json_encode($rows);

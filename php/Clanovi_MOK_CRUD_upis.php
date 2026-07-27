<?php
require_once __DIR__ . '/require_login_api.php';
// Clanovi_MOK_CRUD_upis.php — nova MOK bilješka (POST: id_clan, tekst).
// Autora, njegovu dužnost i OBJE lože (autorovu i članovu) puni SERVER — klijent ih ne šalje.
// Vraća 'OK|<id>' ili kod greške.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }

$id_clan = isset($_POST['id_clan']) ? (int) $_POST['id_clan'] : 0;
$tekst   = isset($_POST['tekst']) ? trim((string) $_POST['tekst']) : '';
if ($id_clan <= 0 || $tekst === '') { echo '105'; exit; }

$upisao  = (int) ($_SESSION['id_korisnik'] ?? 0);
$duznost = (int) ($_SESSION['id_duznosnik'] ?? 0);
if ($upisao <= 0) { echo '105'; exit; }

// Loža autora i loža člana — obje se pamte kakve su U TRENUTKU upisa.
$lozaAutor = null; $lozaClan = null;
$stmt = $mysqli->prepare('SELECT id, loza FROM clanovi WHERE id IN (?, ?)');
if ($stmt) {
    $stmt->bind_param('ii', $upisao, $id_clan);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($r = $res->fetch_assoc()) {
        if ((int) $r['id'] === $upisao) $lozaAutor = $r['loza'] !== null ? (int) $r['loza'] : null;
        if ((int) $r['id'] === $id_clan) $lozaClan  = $r['loza'] !== null ? (int) $r['loza'] : null;
    }
    $stmt->close();
}
$duznostVal = $duznost > 0 ? $duznost : null;

try {
    $stmt = $mysqli->prepare(
        "INSERT INTO clanovi_mok (id_clan, id_loza_clan, upisao, upisao_duznost, id_loza_upisao, tekst, datum_upisa)
         VALUES (?, ?, ?, ?, ?, ?, NOW())");
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param('iiiiis', $id_clan, $lozaClan, $upisao, $duznostVal, $lozaAutor, $tekst);
    $stmt->execute();
    $noviId = $stmt->insert_id;
    $stmt->close();
    echo 'OK|' . $noviId;
} catch (mysqli_sql_exception $e) {
    if ($e->getCode() == 1452) { echo '107,' . $e->getCode(); exit; }   // FK: član/dužnost/loža ne postoji
    echo '200,' . $e->getCode();
}
$mysqli->close();

<?php
require_once __DIR__ . '/require_login_api.php';
// Duznosnici_Osobe_CRUD_upis.php – nova dodjela (id_korisnik, id_duznosnik) u sustav_korisnici.
// POST: id_duznosnik (obavezno), id_clanovi (obavezno) = id_korisnik (član.id u tablici clanovi),
//       zamjena (opcijski, '1') = potvrđena zamjena postojećeg nosioca te dužnosti.
// Pravilo: dužnost ima najviše jednog nosioca (UNIQUE uq_sustav_korisnici_duznosnik);
//          jedna osoba smije imati više dužnosti (novi redak po dužnosti).
// Ako par već postoji: OK (bez promjene).
// Ako dužnost ima drugog nosioca: bez zamjena=1 → 135; sa zamjena=1 → DELETE stari + INSERT novi (transakcija).
// Član mora imati aktivnost = 1.
// Izlaz (TEXT): OK | 100 | 105 | 135 | 200,errno

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain; charset=utf-8');
    echo $db_ret;
    exit;
}

$id_duznosnik = isset($_POST['id_duznosnik']) ? (int)$_POST['id_duznosnik'] : 0;
$id_clanovi   = isset($_POST['id_clanovi']) ? (int)$_POST['id_clanovi'] : 0;
$zamjena      = isset($_POST['zamjena']) && (string)$_POST['zamjena'] === '1';

if ($id_duznosnik <= 0 || $id_clanovi <= 0) {
    echo '105';
    exit;
}

$stmt = $mysqli->prepare('SELECT id FROM duznosnici WHERE id = ? LIMIT 1');
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id_duznosnik);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows === 0) {
    $stmt->close();
    echo '105';
    exit;
}
$stmt->close();

$stmt = $mysqli->prepare('SELECT id FROM clanovi WHERE id = ? AND aktivnost = 1 LIMIT 1');
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id_clanovi);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows === 0) {
    $stmt->close();
    echo '105';
    exit;
}
$stmt->close();

// --- Blok: postojeći nosioc te dužnosti (najviše jedan; više redaka moguće samo prije ALTER-a s UNIQUE) ---
$stmt = $mysqli->prepare('SELECT id_korisnik FROM sustav_korisnici WHERE id_duznosnik = ?');
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id_duznosnik);
$stmt->execute();
$res_nos = $stmt->get_result();
$postojeci = [];
if ($res_nos) {
    while ($r = $res_nos->fetch_assoc()) {
        $postojeci[] = (int) $r['id_korisnik'];
    }
}
$stmt->close();

// Isti član je već nosioc te dužnosti (i nema viška) — nema promjene.
if ($postojeci === [$id_clanovi]) {
    echo 'OK';
    $mysqli->close();
    exit;
}

// Dužnost ima drugog nosioca, a zamjena nije potvrđena (npr. netko drugi ju je dodijelio u međuvremenu).
if (!empty($postojeci) && !$zamjena) {
    echo '135';
    $mysqli->close();
    exit;
}

// --- Blok: upis (uz zamjenu postojećeg nosioca, ako ga ima) ---
$mysqli->begin_transaction();

if (!empty($postojeci)) {
    $stmt = $mysqli->prepare('DELETE FROM sustav_korisnici WHERE id_duznosnik = ?');
    if (!$stmt) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        $mysqli->close();
        exit;
    }
    $stmt->bind_param('i', $id_duznosnik);
    $ok_del = $stmt->execute();
    $stmt->close();
    if (!$ok_del) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        $mysqli->close();
        exit;
    }
}

$stmt = $mysqli->prepare('INSERT INTO sustav_korisnici (id_duznosnik, id_korisnik) VALUES (?, ?)');
if (!$stmt) {
    $mysqli->rollback();
    echo '200,' . $mysqli->errno;
    $mysqli->close();
    exit;
}
$stmt->bind_param('ii', $id_duznosnik, $id_clanovi);
$ok = $stmt->execute();
$errno_ins = $mysqli->errno;
$stmt->close();

if (!$ok) {
    $mysqli->rollback();
    echo '200,' . $errno_ins;
    $mysqli->close();
    exit;
}

$mysqli->commit();
echo 'OK';
$mysqli->close();

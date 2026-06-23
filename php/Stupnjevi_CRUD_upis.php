<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Stupnjevi_CRUD_upis.php
// Upis novog stupnja s poljima obred_id, naziv, stupanj, slika, slika_mime, slika_thumbnail, slika_thumbnail_mime.
// =====================================================
//
// Blokovi: Konekcija na bazu, Validacija ulaza, Slike (opcionalno), Upis (INSERT).
// Ulaz (POST): obred_id (obavezno), naziv (obavezno, max 50), stupanj (1–99)
//              slika (file, opcionalno), slika_mime (opcionalno), slika_thumbnail (file, opcionalno), slika_thumbnail_mime (opcionalno)
// Izlaz (TEXT): OK | 002,<polje> | 100 | 105 | 200,<errno>
// Koristi: 00_db.php ($mysqli)
// =====================================================

// --- Blok: Konekcija na bazu ---
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    /* Greška konekcije (00_db vraća kod 100 ili drugi); ispiši kod i prekini. */
    echo $db_ret;
    exit;
}

// --- Blok: Validacija ulaza ---
$obred_id = isset($_POST['obred_id']) ? (int)$_POST['obred_id'] : 0;
$naziv    = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
$stupanj  = isset($_POST['stupanj']) ? (int)$_POST['stupanj'] : 0;

if ($obred_id <= 0 || $naziv === '') {
    /* obred_id nedostaje/nevaljan ili naziv prazan → nevaljani ulaz. */
    echo '105';
    exit;
}
if (mb_strlen($naziv) > 50) {
    /* Naziv predugačak (max 50 znakova). */
    echo '105';
    exit;
}
if ($stupanj < 1 || $stupanj > 99) {
    /* Stupanj izvan dozvoljenog raspona 1–99. */
    echo '105';
    exit;
}

// --- Blok: Provjera duplikata unutar obreda (isti naziv ILI isti stupanj nisu dozvoljeni) ---
/* Vraća 002,<polje>; JS popuni #1 prevedenom labelom tog polja (naziv/stupanj). */
if ($dupStmt = $mysqli->prepare("SELECT id FROM stupnjevi WHERE id_obred = ? AND LOWER(naziv) = LOWER(?) LIMIT 1")) {
    $dupStmt->bind_param("is", $obred_id, $naziv);
    $dupStmt->execute();
    $exists = ($r = $dupStmt->get_result()) && $r->fetch_assoc();
    $dupStmt->close();
    if ($exists) { echo '002,naziv'; exit; }
}
if ($dupStmt = $mysqli->prepare("SELECT id FROM stupnjevi WHERE id_obred = ? AND stupanj = ? LIMIT 1")) {
    $dupStmt->bind_param("ii", $obred_id, $stupanj);
    $dupStmt->execute();
    $exists = ($r = $dupStmt->get_result()) && $r->fetch_assoc();
    $dupStmt->close();
    if ($exists) { echo '002,stupanj'; exit; }
}

// --- Blok: Slike (opcionalno) ---
$slika                = null;
$slika_mime           = null;
$slika_thumbnail      = null;
$slika_thumbnail_mime = null;

if (isset($_FILES['slika']) && $_FILES['slika']['error'] === UPLOAD_ERR_OK) {
    /* Poslana je datoteka slike; učitaj i validiraj. */
    $tmp = $_FILES['slika']['tmp_name'];
    $t   = isset($_FILES['slika']['type']) ? $_FILES['slika']['type'] : '';
    if (is_uploaded_file($tmp) && $t && strpos($t, 'image/') === 0) {
        /* Stvarni upload i tip image/*; čitaj sadržaj. */
        $slika = file_get_contents($tmp);
        if ($slika !== false) {
            $slika_mime = isset($_POST['slika_mime']) ? trim((string)$_POST['slika_mime']) : $t;
            if (!preg_match('#^image/[a-z0-9.+-]+$#i', $slika_mime) || mb_strlen($slika_mime) > 32) {
                /* MIME nevaljan ili predugačak → default webp. */
                $slika_mime = 'image/webp';
            }
        } else {
            $slika = null;
        }
    }
}
if (isset($_FILES['thumb']) && $_FILES['thumb']['error'] === UPLOAD_ERR_OK) {
    /* Poslan je thumbnail; učitaj i validiraj. */
    $tmp = $_FILES['thumb']['tmp_name'];
    $t   = isset($_FILES['thumb']['type']) ? $_FILES['thumb']['type'] : '';
    if (is_uploaded_file($tmp) && $t && strpos($t, 'image/') === 0) {
        $slika_thumbnail = file_get_contents($tmp);
        if ($slika_thumbnail !== false) {
            $slika_thumbnail_mime = isset($_POST['thumb_mime']) ? trim((string)$_POST['thumb_mime']) : $t;
            if (!preg_match('#^image/[a-z0-9.+-]+$#i', $slika_thumbnail_mime) || mb_strlen($slika_thumbnail_mime) > 32) {
                /* MIME nevaljan ili predugačak → default jpeg. */
                $slika_thumbnail_mime = 'image/jpeg';
            }
        } else {
            $slika_thumbnail = null;
        }
    }
}

// --- Blok: Upis ---
$sql = "INSERT INTO stupnjevi (id_obred, naziv, stupanj, slika, slika_mime, slika_thumbnail, slika_thumbnail_mime) VALUES (?, ?, ?, ?, ?, ?, ?)";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    /* prepare() nije uspio → SQL greška. */
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param("isissss", $obred_id, $naziv, $stupanj, $slika, $slika_mime, $slika_thumbnail, $slika_thumbnail_mime);
if ($stmt->execute()) {
    echo 'OK';
} else {
    /* execute() nije uspio → SQL greška (npr. duplikat, FK). */
    echo '200,' . $mysqli->errno;
}
$stmt->close();
$mysqli->close();

<?php
// PDF_Dozvoljeni_izvori_dokumenata_CRUD_upis.php — dodaje tablicu u dozvoljene.
// Defenzivno: tablica mora biti valjan identifikator, postojati kao BASE TABLE i imati stupac `id`
// (ne vjeruje se klijentu iako se bira iz padajućeg popisa). Jedinstvenost po `tablica`.
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}

$tablica = isset($_POST['tablica']) ? trim((string) $_POST['tablica']) : '';
if (!preg_match('/^[A-Za-z0-9_]{1,64}$/', $tablica)) {
    echo '105';
    exit;
}

$napomena = isset($_POST['napomena']) ? trim((string) $_POST['napomena']) : '';
if ($napomena === '') {
    $napomena = null;
} elseif (mb_strlen($napomena, 'UTF-8') > 1024) {
    $napomena = mb_substr($napomena, 0, 1024, 'UTF-8');
}

try {
    // Tablica mora postojati kao BASE TABLE i imati stupac `id`.
    $st = $mysqli->prepare("SELECT 1 FROM information_schema.TABLES t
        JOIN information_schema.COLUMNS c
          ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME AND c.COLUMN_NAME = 'id'
        WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_TYPE = 'BASE TABLE' AND t.TABLE_NAME = ? LIMIT 1");
    if (!$st) { echo '200,' . $mysqli->errno; exit; }
    $st->bind_param('s', $tablica);
    $st->execute();
    $st->store_result();
    $postoji = $st->num_rows > 0;
    $st->close();
    if (!$postoji) { echo '105'; exit; }

    // Duplikat?
    $st = $mysqli->prepare('SELECT id FROM pdf_dozvoljeni_izvori_dokumenata WHERE tablica = ? LIMIT 1');
    if (!$st) { echo '200,' . $mysqli->errno; exit; }
    $st->bind_param('s', $tablica);
    $st->execute();
    $st->store_result();
    if ($st->num_rows > 0) { echo '002'; exit; }
    $st->close();

    $st = $mysqli->prepare('INSERT INTO pdf_dozvoljeni_izvori_dokumenata (tablica, napomena) VALUES (?, ?)');
    if (!$st) { echo '200,' . $mysqli->errno; exit; }
    $st->bind_param('ss', $tablica, $napomena);
    $st->execute();
    $noviId = $mysqli->insert_id;
    $st->close();
    echo (string) $noviId;   // vraća id novog izvora (za spremanje kolona koje su odabrane prije snimanja)
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}
$mysqli->close();

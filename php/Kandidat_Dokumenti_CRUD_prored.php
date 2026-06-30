<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_CRUD_prored.php – upis SAMO množitelja extra-proreda
// dokumenta (kandidat_dokumenti_zivotopis.dokument_prored, decimal(3,2)).
// Korisnički zadatak u aplikaciji: korisnik podešava prored gotovog/testiranog
// PDF životopisa. Ulaz: POST JSON { id_clan, prored }. Klamp 0.80–2.00.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
header('Content-Type: text/plain; charset=utf-8');

$raw = file_get_contents('php://input');
$d   = $raw ? json_decode($raw, true) : null;
if (!is_array($d)) { echo '105'; exit; }

$id_clan = (isset($d['id_clan']) && $d['id_clan'] !== '') ? (int) $d['id_clan'] : 0;
if ($id_clan <= 0) { echo '105'; exit; }

// Prored: prihvati zarez ili točku; klamp na [0.80, 2.00]; 2 decimale.
$proredRaw = isset($d['prored']) ? str_replace(',', '.', trim((string) $d['prored'])) : '';
if ($proredRaw === '' || !is_numeric($proredRaw)) { echo '105'; exit; }
$prored = (float) $proredRaw;
if ($prored < 0.80) $prored = 0.80;
if ($prored > 2.00) $prored = 2.00;
$prored = round($prored, 2);

try {
    $stmt = $mysqli->prepare('UPDATE kandidat_dokumenti_zivotopis SET dokument_prored = ? WHERE id_clan = ?');
    $stmt->bind_param('di', $prored, $id_clan);
    $stmt->execute();
    $stmt->close();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}

$mysqli->close();

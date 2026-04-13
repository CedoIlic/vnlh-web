<?php
require_once __DIR__ . '/require_login_api.php';
// Clanovi_CRUD_ima_vezane.php – provjera ima li član vezane podatke (adrese, telefoni, e_maili, napredovanja).
// Ulaz: POST id (id člana).
// Izlaz: 1 = ima barem jedan vezani slog u nekoj od tablica; 0 = nema; 105 = nevaljan id; 200,errno = greška.
// Koristi: 00_db.php ($mysqli)

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: text/plain; charset=utf-8');

$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
if ($id <= 0) {
    echo '105';
    exit;
}

$ima = 0;
$tables = ['adrese', 'telefoni', 'e_maili', 'napredovanja'];

foreach ($tables as $table) {
    $sql = "SELECT 1 FROM `{$table}` WHERE id_clanovi = ? LIMIT 1";
    $stmt = @$mysqli->prepare($sql);
    if (!$stmt) {
        if ($mysqli->errno === 1146) {
            continue;
        }
        echo '200,' . $mysqli->errno;
        $mysqli->close();
        exit;
    }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res && $res->num_rows > 0) {
        $ima = 1;
        $stmt->close();
        break;
    }
    $stmt->close();
}

echo $ima ? '1' : '0';
$mysqli->close();

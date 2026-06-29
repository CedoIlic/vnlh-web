<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$result = $mysqli->query('SELECT * FROM pdf_template ORDER BY naziv ASC');
if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$rows = [];
$indexPoId = [];
while ($row = $result->fetch_assoc()) {
    $row['okviri'] = [];
    $rows[count($rows)] = $row;
    if (isset($row['id'])) {
        $indexPoId[(int) $row['id']] = count($rows) - 1;
    }
}

// Okviri (pdf_template_okvir) — pripoji svakom templateu po redoslijedu lanca.
// Tolerantno: ako tablica još ne postoji (prije ručnog SQL-a u Heidiju), preskoči bez greške.
try {
    $ro = $mysqli->query('SELECT * FROM pdf_template_okvir ORDER BY template_id ASC, redoslijed ASC, id ASC');
    if ($ro) {
        while ($o = $ro->fetch_assoc()) {
            $tid = isset($o['template_id']) ? (int) $o['template_id'] : 0;
            if (isset($indexPoId[$tid])) {
                $rows[$indexPoId[$tid]]['okviri'][] = $o;
            }
        }
    }
} catch (mysqli_sql_exception $e) {
    // 1146 = tablica ne postoji → okviri ostaju prazni
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
$mysqli->close();

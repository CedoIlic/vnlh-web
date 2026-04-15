<?php
require_once __DIR__ . '/require_login_api.php';
require_once __DIR__ . '/vnlh_varijable_sustava_razvoj.php';
// --- Alati_Varijable_Sustava_CRUD_sve.php – dohvat redaka sustav_varijable (sort: id). ---
// GET razvoj: 0 (default) = samo id 0–999; 1 = sve (samo ako je korisnik na listi u retku id=1002).
// Izlaz: JSON { "rows": [ { "id", "varijabla", "naziv", "opis" }, ... ], "mozeRazvojToggle": bool } – ključ "naziv" je alias za stupac Naziv (MySQL).
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$idK = isset($_SESSION['id_korisnik']) ? (int) $_SESSION['id_korisnik'] : 0;
$mozeRazvojToggle = vnlh_var_sust_korisnik_moze_toggle_razvoj($mysqli, $idK);
$zeliRazvoj = isset($_GET['razvoj']) && (string) $_GET['razvoj'] === '1';
$efektRazvoj = vnlh_var_sust_efektivni_razvoj_ukljucen($mysqli, $idK, $zeliRazvoj);

$sql = 'SELECT id, varijabla, `Naziv` AS naziv, opis FROM sustav_varijable';
if (!$efektRazvoj) {
    $sql .= ' WHERE id >= 0 AND id <= 999';
}
$sql .= ' ORDER BY id ASC';

$result = $mysqli->query($sql);
$rows = [];
if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
header('Content-Type: application/json; charset=utf-8');
echo json_encode(
    [
        'rows' => $rows,
        'mozeRazvojToggle' => $mozeRazvojToggle,
    ],
    JSON_UNESCAPED_UNICODE
);
$mysqli->close();

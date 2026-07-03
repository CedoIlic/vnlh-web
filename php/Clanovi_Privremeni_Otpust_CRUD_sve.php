<?php
require_once __DIR__ . '/require_login_api.php';
// Clanovi_Privremeni_Otpust_CRUD_sve.php – članovi lože s TRENUTNO aktivnim privremenim otpustom.
// GET id_loza. Aktivan = datum_od <= CURDATE() <= datum_do. Vraća i audit (datumi + imena autora).
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$id_loza = isset($_GET['id_loza']) ? (int)$_GET['id_loza'] : 0;
if ($id_loza <= 0) {
    header('Content-Type: application/json');
    echo '[]';
    exit;
}
// sve=1 → prikaži SVE otpuste (bez filtra po trenutnom datumu); inače samo trenutno aktivne (od ≤ danas ≤ do).
$sve = isset($_GET['sve']) && (string)$_GET['sve'] === '1';
$sql = "SELECT
            po.id                AS id_otpust,
            po.id_clan,
            c.prezime,
            c.ime,
            c.kandidat,
            s.stupanj            AS stupanj_show,
            po.datum_od,
            po.datum_do,
            po.napomena,
            po.prvi_upis,
            po.id_prvog_upisa,
            po.zadnja_izmjena,
            po.id_zadnje_izmjene,
            TRIM(CONCAT_WS(' ', ap.prezime, ap.ime)) AS autor_upis,
            TRIM(CONCAT_WS(' ', az.prezime, az.ime)) AS autor_izmjena,
            (po.datum_od <= CURDATE() AND po.datum_do >= CURDATE()) AS aktivan
        FROM clanovi_privremeni_otpust po
        INNER JOIN clanovi c ON c.id = po.id_clan
        LEFT JOIN stupnjevi s ON s.id = c.stupanj
        LEFT JOIN clanovi ap ON ap.id = po.id_prvog_upisa
        LEFT JOIN clanovi az ON az.id = po.id_zadnje_izmjene
        WHERE c.loza = ?" . ($sve ? "" : " AND po.datum_od <= CURDATE() AND po.datum_do >= CURDATE()") . "
        ORDER BY po.datum_od DESC, c.prezime ASC, c.ime ASC";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    header('Content-Type: text/plain');
    echo '200|' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id_loza);
$stmt->execute();
$result = $stmt->get_result();
$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
$stmt->close();
$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);

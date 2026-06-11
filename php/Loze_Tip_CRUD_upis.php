<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }
if (!isset($_POST['naziv'])) { echo '105'; exit; }
$naziv = trim($_POST['naziv']);
if ($naziv === '') { echo '105'; exit; }
$id_obred = isset($_POST['id_obred']) ? (int)$_POST['id_obred'] : 0;
if ($id_obred <= 0) { echo '105'; exit; }
$redosljed = isset($_POST['redosljed']) ? trim($_POST['redosljed']) : '';
$redosljed_int = ($redosljed === '') ? null : (int)$redosljed;
if ($redosljed !== '' && ($redosljed_int === null || $redosljed_int < 1 || $redosljed_int > 99)) { echo '105'; exit; }

/* CSV id-eva stupnjeva za child enum tablicu: nadležnosti = pozicija 1, pregled = pozicija 2.
   Mehanizam parent-pa-child u istom PHP-u (kao Zapisnik): nakon INSERT-a tipa dobijemo id i njime upišemo enume. */
function lozeTipParseCsvIds($s) {
    $out = [];
    if ($s === null) { return $out; }
    foreach (explode(',', (string)$s) as $v) {
        $id = (int)trim($v);
        if ($id > 0 && !in_array($id, $out, true)) { $out[] = $id; }
    }
    return $out;
}
$stupnjevi_nadleznost = lozeTipParseCsvIds(isset($_POST['stupnjevi_nadleznost']) ? $_POST['stupnjevi_nadleznost'] : '');
$stupnjevi_pregled    = lozeTipParseCsvIds(isset($_POST['stupnjevi_pregled']) ? $_POST['stupnjevi_pregled'] : '');

try {
    $mysqli->begin_transaction();

    $stmt = $mysqli->prepare("SELECT id FROM loze_tip WHERE LOWER(naziv) = LOWER(?) AND id_obred = ?");
    if (!$stmt) { $mysqli->rollback(); echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("si", $naziv, $id_obred);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) { $stmt->close(); $mysqli->rollback(); echo '002'; exit; }
    $stmt->close();

    $redosljed_val = ($redosljed_int === null || $redosljed_int < 1) ? 0 : $redosljed_int;
    $stmt = $mysqli->prepare("INSERT INTO loze_tip (naziv, id_obred, redosljed) VALUES (?, ?, ?)");
    if (!$stmt) { $mysqli->rollback(); echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("sii", $naziv, $id_obred, $redosljed_val);
    $stmt->execute();
    $new_id = (int)$mysqli->insert_id;
    $stmt->close();

    /* Child enum redovi s tek dobivenim id-em (isti oblik kao Loze_Tip_CRUD_enum_stupnjevi_upis.php). */
    if ($new_id > 0 && (count($stupnjevi_nadleznost) > 0 || count($stupnjevi_pregled) > 0)) {
        $stmtE = $mysqli->prepare("INSERT INTO loze_tip_stupanj_enum (id_vlasnik, id_stupanj, id_pozicija) VALUES (?, ?, ?)");
        if (!$stmtE) { $mysqli->rollback(); echo '200,' . $mysqli->errno; exit; }
        $grupe = array(1 => $stupnjevi_nadleznost, 2 => $stupnjevi_pregled);
        foreach ($grupe as $poz => $arr) {
            foreach ($arr as $id_stupanj) {
                $stmtE->bind_param("iii", $new_id, $id_stupanj, $poz);
                $stmtE->execute();
            }
        }
        $stmtE->close();
    }

    $mysqli->commit();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    if (isset($mysqli)) { $mysqli->rollback(); }
    echo '200,' . $e->getCode();
}
$mysqli->close();
?>

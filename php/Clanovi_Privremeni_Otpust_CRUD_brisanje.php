<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }

// Brisanje privremenog otpusta (leaf tablica – nema djece). Potvrda (modal 128) je na klijentu.
$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
if ($id <= 0) { echo '105'; exit; }

try {
    $stmt = $mysqli->prepare("DELETE FROM clanovi_privremeni_otpust WHERE id = ?");
    if (!$stmt) { echo '200|' . $mysqli->errno; exit; }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $stmt->close();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    // 1451 = FK RESTRICT (nema djece pa se ne očekuje) → poruka "u upotrebi" (106), inače generička.
    if ((int)$e->getCode() === 1451) { echo '106'; } else { echo '200|' . $e->getCode(); }
}

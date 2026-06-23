<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Jezici_CRUD_drzave_toggle.php
// Uključi/isključi državu u šifrarniku zastava (sustav_drzave.aktivan).
// Ulaz (POST): kod (2 slova), aktivan (0/1)
// Izlaz (TEXT): OK | 105 | 200,<errno>
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}

$kod = isset($_POST['kod']) ? strtolower(trim($_POST['kod'])) : '';
$aktivan = (isset($_POST['aktivan']) && $_POST['aktivan'] === '1') ? 1 : 0;

if ($kod === '' || !preg_match('/^[a-z]{2}$/', $kod)) {
    echo '105';
    exit;
}

$stmt = $mysqli->prepare("UPDATE sustav_drzave SET aktivan = ? WHERE kod = ?");
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('is', $aktivan, $kod);
$stmt->execute();
$stmt->close();

echo 'OK';
$mysqli->close();

<?php
require_once __DIR__ . '/require_login.php';
require_once __DIR__ . '/vnlh_paths.php';
require_once __DIR__ . '/vnlh_db_connect.php';

$basename = 'Zapisnik_CRUD.html';
$abs = __DIR__ . '/../html/' . basename($basename);
if (!is_readable($abs)) {
    http_response_code(500);
    echo 'HTML template missing: ' . htmlspecialchars($basename, ENT_QUOTES, 'UTF-8');
    return;
}
$raw = file_get_contents($abs);
if ($raw === false) {
    http_response_code(500);
    echo 'HTML template read error.';
    return;
}

$idKorisnik = (int) ($_SESSION['id_korisnik'] ?? 0);
$prezime = '';
$ime = '';
if ($idKorisnik > 0) {
    $db = vnlh_db_connect();
    if ($db !== false) {
        $stmt = $db->prepare("SELECT prezime, ime FROM clanovi WHERE id = ? LIMIT 1");
        if ($stmt) {
            $stmt->bind_param('i', $idKorisnik);
            $stmt->execute();
            $res = $stmt->get_result();
            if ($res && ($row = $res->fetch_assoc())) {
                $prezime = $row['prezime'] ?? '';
                $ime     = $row['ime']     ?? '';
            }
            $stmt->close();
        }
        $db->close();
    }
}

$korisnikJson = json_encode(
    ['id' => $idKorisnik, 'prezime' => $prezime, 'ime' => $ime],
    JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS
);

$html = str_replace('__VNLH_TEKUCI_KORISNIK__', $korisnikJson, $raw);
$html = vnlh_apply_asset_token_to_html($html);
$html = vnlh_inject_chat_flag_script($html);
$html = vnlh_inject_app_base_path_script($html);
echo vnlh_inject_sesija_pracenje_aktivnosti_script($html);

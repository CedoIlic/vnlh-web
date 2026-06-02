<?php
/**
 * html_router.php — generički router za HTML stranice bez individualnog PHP wrappera.
 * Poziva se iz .htaccess kada php/X.php ne postoji a html/X.html postoji.
 * ?page=X (samo slova, brojevi, _, -); sve ostalo → 404.
 *
 * Podržani placeholder-i:
 *   __VNLH_TEKUCI_KORISNIK__           JSON { id, prezime, ime } prijavljenog korisnika
 *   __VNLH_SESSION_MASTER_ID_DUZNOSNIK__ id dužnosnika iz sesije (ili ?id_duznosnik_test za test alate)
 *   __VNLH_ID_KORISNIK__               id korisnika iz sesije
 */
require_once __DIR__ . '/require_login.php';
require_once __DIR__ . '/vnlh_paths.php';
require_once __DIR__ . '/vnlh_db_connect.php';

$page = isset($_GET['page']) ? $_GET['page'] : '';
$page = preg_replace('/[^A-Za-z0-9_\-]/', '', $page);

if ($page === '' || $page === 'html_router') {
    http_response_code(404);
    exit;
}

/* Provjera dopuštenja: traženi page.html mora biti u $_SESSION['vnlh_meni_dopustene']. */
$wantHtml = $page . '.html';
$allowed  = isset($_SESSION['vnlh_meni_dopustene']) && is_array($_SESSION['vnlh_meni_dopustene'])
    ? $_SESSION['vnlh_meni_dopustene'] : [];
$pageOk = false;
foreach ($allowed as $item) {
    if (!is_array($item)) continue;
    $hf = isset($item['html_fajl']) ? strtolower(trim((string) $item['html_fajl'])) : '';
    if ($hf !== '' && $hf === strtolower($wantHtml)) { $pageOk = true; break; }
}
if (!$pageOk) {
    header('Location: Meni.php', true, 302);
    exit;
}

$basename = $page . '.html';
$abs = __DIR__ . '/../html/' . $basename;

if (!is_readable($abs)) {
    http_response_code(404);
    exit;
}

$raw = file_get_contents($abs);
if ($raw === false) {
    http_response_code(500);
    echo 'HTML template read error.';
    exit;
}

/* --- Sesijski placeholderi --- */

$idKorisnik = (int) ($_SESSION['id_korisnik'] ?? 0);

/* id_duznosnik_test GET param: koriste Duznosnici_* i Alati_Meni_Test za testiranje s drugom dužnosti. */
$idDuznosnikTest   = isset($_GET['id_duznosnik_test']) ? (int) $_GET['id_duznosnik_test'] : 0;
$masterIdDuznosnik = ($idDuznosnikTest > 0) ? $idDuznosnikTest : (int) ($_SESSION['id_duznosnik'] ?? 0);

/* __VNLH_TEKUCI_KORISNIK__: DB upit samo kad stranica sadrži taj placeholder. */
$korisnikJson = 'null';
if (strpos($raw, '__VNLH_TEKUCI_KORISNIK__') !== false && $idKorisnik > 0) {
    $prezime = '';
    $ime     = '';
    $db = vnlh_db_connect();
    if ($db !== false) {
        $stmt = $db->prepare('SELECT prezime, ime FROM clanovi WHERE id = ? LIMIT 1');
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
    $korisnikJson = json_encode(
        ['id' => $idKorisnik, 'prezime' => $prezime, 'ime' => $ime,
         'razina' => (int)($_SESSION['id_duznosnik_razina'] ?? 0)],
        JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS
    );
}

/* __VNLH_RAZINA_CASNOG_MAJSTORA__: dohvat iz sustav_varijable.id=117. */
$razinaCasnogMajstora = 0;
if (strpos($raw, '__VNLH_RAZINA_CASNOG_MAJSTORA__') !== false) {
    $dbVar = vnlh_db_connect();
    if ($dbVar !== false) {
        $stmtVar = $dbVar->prepare('SELECT varijabla FROM sustav_varijable WHERE id = 117 LIMIT 1');
        if ($stmtVar) {
            $stmtVar->execute();
            $resVar = $stmtVar->get_result();
            if ($resVar && ($rowVar = $resVar->fetch_assoc())) {
                $razinaCasnogMajstora = (int)$rowVar['varijabla'];
            }
            $stmtVar->close();
        }
        $dbVar->close();
    }
}

$html = str_replace(
    ['__VNLH_TEKUCI_KORISNIK__', '__VNLH_SESSION_MASTER_ID_DUZNOSNIK__', '__VNLH_ID_KORISNIK__', '__VNLH_RAZINA_CASNOG_MAJSTORA__'],
    [$korisnikJson,              (string) $masterIdDuznosnik,             (string) $idKorisnik,   (string) $razinaCasnogMajstora],
    $raw
);

$html = vnlh_apply_asset_token_to_html($html);
$html = vnlh_inject_chat_flag_script($html);
$html = vnlh_inject_app_base_path_script($html);
echo vnlh_inject_sesija_pracenje_aktivnosti_script($html);

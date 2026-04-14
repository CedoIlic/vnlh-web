<?php
require_once __DIR__ . '/require_login.php';
require_once __DIR__ . '/vnlh_paths.php';
require_once __DIR__ . '/vnlh_db_connect.php';

/* Spriječi preglednikov keš HTML stranice — svaki zahtjev mora dobiti svjež sadržaj s diska. */
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

/** Za Meni.js: ne zovi meni_dohvat_stabla_menija ako id_duznosnik nije u tablici duznosnici. */
$meniDuznosnikValjan = false;
$mysqliMeni = vnlh_db_connect();
if ($mysqliMeni !== false) {
    $idD = (int) ($_SESSION['id_duznosnik'] ?? 0);
    if ($idD > 0) {
        $stmt = $mysqliMeni->prepare('SELECT 1 FROM duznosnici WHERE id = ? LIMIT 1');
        if ($stmt) {
            $stmt->bind_param('i', $idD);
            $stmt->execute();
            $res = $stmt->get_result();
            $meniDuznosnikValjan = $res && $res->num_rows > 0;
            $stmt->close();
        }
    }
    $mysqliMeni->close();
}

/** Dno forme: naziv dužnosti, prezime, ime iz baze za sesiju. */
$logirani_korisnik_tekst = '';
$mysqliMeniDbg = vnlh_db_connect();
if ($mysqliMeniDbg !== false) {
    $idKDbg = (int) ($_SESSION['id_korisnik'] ?? 0);
    if ($idKDbg > 0) {
        $stmtDbg = $mysqliMeniDbg->prepare(
            'SELECT d.naziv AS naziv_duznosti, c.prezime, c.ime
             FROM sustav_korisnici sk
             LEFT JOIN duznosnici d ON d.id = sk.id_duznosnik
             LEFT JOIN clanovi c ON c.id = sk.id_korisnik
             WHERE sk.id_korisnik = ? LIMIT 1'
        );
        if ($stmtDbg) {
            $stmtDbg->bind_param('i', $idKDbg);
            $stmtDbg->execute();
            $resDbg = $stmtDbg->get_result();
            if ($resDbg && ($rowDbg = $resDbg->fetch_assoc())) {
                $nd = isset($rowDbg['naziv_duznosti']) ? trim((string) $rowDbg['naziv_duznosti']) : '';
                $prezDbg = isset($rowDbg['prezime']) ? trim((string) $rowDbg['prezime']) : '';
                $imeDbg = isset($rowDbg['ime']) ? trim((string) $rowDbg['ime']) : '';
                $logirani_korisnik_tekst = $nd . ', ' . $prezDbg . ' ' . $imeDbg;
            }
            $stmtDbg->close();
        }
    }
    $mysqliMeniDbg->close();
}

$html = file_get_contents(__DIR__ . '/../html/Meni.html');
$html = vnlh_apply_asset_token_to_html($html);
/* Isti flag kao vnlh_emit_html_*: u <head> prije 0-Poruke.js (ikona chata čita window.VNLH_CHAT_DOZVOLJEN). */
$html = vnlh_inject_chat_flag_script($html);
$appBaseJs = vnlh_app_base_path_for_js();
$inject = '<script>window.__VNLH_MENU_DUZNOSNIK_OK__=' . ($meniDuznosnikValjan ? 'true' : 'false') . ';';
$inject .= 'window.__VNLH_APP_BASE_PATH__=' . json_encode($appBaseJs, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS) . ';</script>' . "\n";
$html = str_replace('<script src="../js/Meni.js"', $inject . '<script src="../js/Meni.js"', $html);
$logirani_korisnik_json = json_encode($logirani_korisnik_tekst, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS);
/* style u jednostrukim navodnicima da JSON dvostruki navodnik ne prekine atribut */
$html = str_replace(
    '<body class="meni-glavni">',
    '<body class="meni-glavni" style=\'--logirani_korisnik_text: ' . $logirani_korisnik_json . ';\'>',
    $html
);
echo $html;

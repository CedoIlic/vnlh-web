<?php
// =====================================================
// common_prava_crud.php
// Laki endpoint: vraća samo CRUD zastavice (upis_izmjena, brisanje_sloga)
// za prijavljenog dužnosnika i konkretan modul (html_fajl → meni.id),
// te ogr_bypass flag iz sustav_varijable id=102.
//
// Ne dohvaća države / regije / lože (za to postoji
// Duznosnici_Drzave_Regije_Loze_sve.php).
//
// Koristi $_SESSION['id_duznosnik'] (postavljeno pri loginu).
//
// Ulaz (GET):
//   html_fajl (obavezno) – npr. "Drzave_CRUD.html"; mapira se na
//                          meni.id radi dohvata tipova 4/5.
//   id_duznosnik_test (opcionalno) – override za testiranje iz
//                                    Alati_Meni_Test (koristi ograničenja
//                                    testiranog dužnosnika umjesto sesijskog).
//
// Izlaz (JSON):
//   upis_izmjena   – 1 | 0  (tip 4 u duznosnici_ogranicenja)
//   brisanje_sloga – 1 | 0  (tip 5 u duznosnici_ogranicenja)
//   ogr_bypass     – 1 | 0  (sustav_varijable id=102; 1 = Duznosnici_Ogranicenja_CRUD
//                             izuzeta od skrivanja tipki)
//
// Ako html_fajl nedostaje, meni red ne postoji ili nema zapisa tip 4/5
// za dužnosnika i modul → 0 za upis_izmjena / brisanje_sloga (restriktivno).
// =====================================================

require_once __DIR__ . '/require_login_api.php';

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

// --- ID sustav_varijable za ogr_bypass ---
define('SUSTAV_VAR_OGR_BYPASS', 102);

// --- id_duznosnik: sesija ili override iz Alati_Meni_Test ---
$idDuznosnikTest = isset($_GET['id_duznosnik_test']) ? (int) $_GET['id_duznosnik_test'] : 0;
$idDuznosnik = ($idDuznosnikTest > 0)
    ? $idDuznosnikTest
    : (isset($_SESSION['id_duznosnik']) ? (int) $_SESSION['id_duznosnik'] : 0);

// --- Prazan odgovor (default) ---
$upisIzmjena   = 0;
$brisanjeSloga = 0;
$ogrBypass     = 0;

if ($idDuznosnik <= 0) {
    echo json_encode([
        'upis_izmjena'    => $upisIzmjena,
        'brisanje_sloga'  => $brisanjeSloga,
        'ogr_bypass'      => $ogrBypass,
    ], JSON_UNESCAPED_UNICODE);
    $mysqli->close();
    exit;
}

// =====================================================
// 1) Dohvat upis_izmjena (tip 4) i brisanje_sloga (tip 5)
//    za modul određen GET parametrom html_fajl → meni.id.
// =====================================================
$htmlFajl = isset($_GET['html_fajl']) ? trim((string) $_GET['html_fajl']) : '';

if ($htmlFajl !== '') {
    // --- Pronađi meni.id po html_fajl ---
    $stmtMeni = $mysqli->prepare('SELECT id FROM meni WHERE html_fajl = ? LIMIT 1');
    if ($stmtMeni) {
        $stmtMeni->bind_param('s', $htmlFajl);
        if ($stmtMeni->execute()) {
            $resMeni = $stmtMeni->get_result();
            $rowMeni = $resMeni ? $resMeni->fetch_assoc() : null;
            if ($rowMeni && isset($rowMeni['id'])) {
                $meniId = (int) $rowMeni['id'];
                if ($meniId > 0) {
                    // --- Tip 4 (upis/izmjena) i tip 5 (brisanje) za taj meni.id ---
                    $stmtPr = $mysqli->prepare(
                        'SELECT id_tip_ogranicenja, vrijednost
                         FROM duznosnici_ogranicenja
                         WHERE id_duznosnik = ? AND id_tip_ogranicenja IN (4, 5)
                           AND id_tip_obred_funkcionalnost = ?'
                    );
                    if ($stmtPr) {
                        $stmtPr->bind_param('ii', $idDuznosnik, $meniId);
                        if ($stmtPr->execute()) {
                            $resPr = $stmtPr->get_result();
                            while ($r = $resPr->fetch_assoc()) {
                                $tip = (int) $r['id_tip_ogranicenja'];
                                $val = trim((string) ($r['vrijednost'] ?? ''));
                                $flag = ($val !== '' && $val !== '0' && (int) $val !== 0) ? 1 : 0;
                                if ($tip === 4) $upisIzmjena   = $flag;
                                if ($tip === 5) $brisanjeSloga = $flag;
                            }
                        }
                        $stmtPr->close();
                    }
                }
            }
        }
        $stmtMeni->close();
    }
}

// =====================================================
// 2) Dohvat ogr_bypass iz sustav_varijable id=102
//    Vrijednost '1' = bypass za Duznosnici_Ogranicenja_CRUD;
//    '0' ili nepostoji = bez bypass-a.
// =====================================================
$stmtVar = $mysqli->prepare('SELECT varijabla FROM sustav_varijable WHERE id = ? LIMIT 1');
if ($stmtVar) {
    $varId = SUSTAV_VAR_OGR_BYPASS;
    $stmtVar->bind_param('i', $varId);
    if ($stmtVar->execute()) {
        $resVar = $stmtVar->get_result();
        $rowVar = $resVar ? $resVar->fetch_assoc() : null;
        if ($rowVar && isset($rowVar['varijabla'])) {
            $ogrBypass = (trim((string) $rowVar['varijabla']) === '1') ? 1 : 0;
        }
    }
    $stmtVar->close();
}

$mysqli->close();

echo json_encode([
    'upis_izmjena'    => $upisIzmjena,
    'brisanje_sloga'  => $brisanjeSloga,
    'ogr_bypass'      => $ogrBypass,
], JSON_UNESCAPED_UNICODE);
exit;

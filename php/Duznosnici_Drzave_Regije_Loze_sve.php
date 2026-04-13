<?php
// =====================================================
// Duznosnici_Drzave_Regije_Loze_sve.php
// Dohvat dozvoljenih država, regija i loža za prijavljenog dužnosnika
// te upis_izmjena / brisanje_sloga zastavica za konkretan modul.
//
// Koristi $_SESSION['id_duznosnik'] (postavljeno pri loginu).
// Ne prima id_duznosnik izvana – korisnik vidi samo svoja ograničenja.
//
// Ulaz (GET):
//   html_fajl (opcionalno) – npr. "Clanovi_CRUD.html"; služi za mapiranje
//                            na meni.id radi upis_izmjena / brisanje_sloga.
//                            Bez ovog parametra geo se vraća normalno,
//                            a upis_izmjena i brisanje_sloga su 0.
//
// Izlaz (JSON):
//   drzave  – [{ id, naziv }]  dozvoljene države (sortirano po naziv)
//   regije  – [{ id, naziv, id_drzava }]  dozvoljene regije čija je
//             država u dozvoljenim državama (kaskada)
//   loze    – [{ id, naziv, id_regija, id_obred }]  dozvoljene lože
//             čija je regija u dozvoljenim regijama (kaskada)
//   upis_izmjena   – 1 | 0
//   brisanje_sloga – 1 | 0
//
// Prazni nizovi = dužnosnik nema nijednog prava za taj tip → potpuno ograničen.
// Kaskada: regija se vraća samo ako joj je država dozvoljena;
//          loža se vraća samo ako joj je regija dozvoljena.
//
// Tablica duznosnici_ogranicenja:
//   id_tip_ogranicenja 1 = država, 2 = regija, 3 = loža (vrijednost = ID entiteta)
//   id_tip_ogranicenja 4 = upis/izmjena per modul (id_tip_obred_funkcionalnost = meni.id, vrijednost = 0|1)
//   id_tip_ogranicenja 5 = brisanje per modul    (id_tip_obred_funkcionalnost = meni.id, vrijednost = 0|1)
// =====================================================

require_once __DIR__ . '/require_login_api.php';

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

// --- id_duznosnik: sesija ili override iz Alati_Meni_Test ---
// Kad se forma (Lista, Clanovi_CRUD, ...) otvori iz Alati_Meni_Test, URL sadrži
// id_duznosnik_test = ID dužnosnika odabranog u "Izbor dužnosnika" selectu.
// U tom slučaju koristimo njega umjesto sesijskog id_duznosnik, tako da forma
// prikazuje geo ograničenja testiranog dužnosnika, ne prijavljenog korisnika.
$idDuznosnikTest = isset($_GET['id_duznosnik_test']) ? (int) $_GET['id_duznosnik_test'] : 0;
$idDuznosnik = ($idDuznosnikTest > 0)
    ? $idDuznosnikTest
    : (isset($_SESSION['id_duznosnik']) ? (int) $_SESSION['id_duznosnik'] : 0);

$prazan = json_encode([
    'drzave'          => [],
    'regije'          => [],
    'loze'            => [],
    'upis_izmjena'    => 0,
    'brisanje_sloga'  => 0,
], JSON_UNESCAPED_UNICODE);

if ($idDuznosnik <= 0) {
    echo $prazan;
    $mysqli->close();
    exit;
}

// =====================================================
// 1) Dohvat dozvoljenih ID-jeva iz duznosnici_ogranicenja (tipovi 1, 2, 3)
// =====================================================
$dozvoljeneDrzaveIds = [];
$dozvoljeneRegijeIds = [];
$dozvoljeneLozeIds   = [];

$stmtGeo = $mysqli->prepare(
    'SELECT DISTINCT id_tip_ogranicenja, CAST(vrijednost AS UNSIGNED) AS vid
     FROM duznosnici_ogranicenja
     WHERE id_duznosnik = ? AND id_tip_ogranicenja IN (1, 2, 3)
       AND vrijednost IS NOT NULL AND vrijednost != 0
     ORDER BY id_tip_ogranicenja, vid'
);
if (!$stmtGeo) {
    echo $prazan;
    $mysqli->close();
    exit;
}
$stmtGeo->bind_param('i', $idDuznosnik);
if (!$stmtGeo->execute()) {
    $stmtGeo->close();
    echo $prazan;
    $mysqli->close();
    exit;
}
$resGeo = $stmtGeo->get_result();
while ($row = $resGeo->fetch_assoc()) {
    $tip = (int) $row['id_tip_ogranicenja'];
    $vid = (int) $row['vid'];
    if ($vid <= 0) continue;
    if ($tip === 1)      $dozvoljeneDrzaveIds[] = $vid;
    elseif ($tip === 2)  $dozvoljeneRegijeIds[] = $vid;
    elseif ($tip === 3)  $dozvoljeneLozeIds[] = $vid;
}
$stmtGeo->close();

// Nema nijedne dozvoljene države → potpuno ograničen, nema smisla tražiti regije/lože
if (empty($dozvoljeneDrzaveIds)) {
    // Ipak dohvati upis/brisanje (modul može postojati bez geo ograničenja)
    $upisIzmjena   = 0;
    $brisanjeSloga = 0;
    dohvatiUpisBrisanje($mysqli, $idDuznosnik, $upisIzmjena, $brisanjeSloga);
    echo json_encode([
        'drzave'          => [],
        'regije'          => [],
        'loze'            => [],
        'upis_izmjena'    => $upisIzmjena,
        'brisanje_sloga'  => $brisanjeSloga,
    ], JSON_UNESCAPED_UNICODE);
    $mysqli->close();
    exit;
}

// =====================================================
// 2) Države – JOIN s tablicom drzave za naziv
// =====================================================
$inDrzave = implode(',', array_map('intval', $dozvoljeneDrzaveIds));
$resDrzave = $mysqli->query(
    "SELECT id, naziv FROM drzave WHERE id IN ($inDrzave) ORDER BY naziv ASC"
);
$drzave = [];
$stvarneDrzaveIds = [];
if ($resDrzave) {
    while ($r = $resDrzave->fetch_assoc()) {
        $drzave[] = ['id' => (int) $r['id'], 'naziv' => $r['naziv']];
        $stvarneDrzaveIds[] = (int) $r['id'];
    }
    $resDrzave->free();
}

// =====================================================
// 3) Regije – samo one čija je država u dozvoljenim državama (kaskada)
// =====================================================
$regije = [];
$stvarneRegijeIds = [];
if (!empty($dozvoljeneRegijeIds) && !empty($stvarneDrzaveIds)) {
    $inRegije = implode(',', array_map('intval', $dozvoljeneRegijeIds));
    $inDrzaveStv = implode(',', array_map('intval', $stvarneDrzaveIds));
    $resRegije = $mysqli->query(
        "SELECT id, naziv, id_drzava FROM regije
         WHERE id IN ($inRegije) AND id_drzava IN ($inDrzaveStv)
         ORDER BY naziv ASC"
    );
    if ($resRegije) {
        while ($r = $resRegije->fetch_assoc()) {
            $regije[] = [
                'id'        => (int) $r['id'],
                'naziv'     => $r['naziv'],
                'id_drzava' => (int) $r['id_drzava'],
            ];
            $stvarneRegijeIds[] = (int) $r['id'];
        }
        $resRegije->free();
    }
}

// =====================================================
// 4) Lože – samo one čija je regija u dozvoljenim regijama (kaskada)
// =====================================================
$loze = [];
if (!empty($dozvoljeneLozeIds) && !empty($stvarneRegijeIds)) {
    $inLoze = implode(',', array_map('intval', $dozvoljeneLozeIds));
    $inRegijeStv = implode(',', array_map('intval', $stvarneRegijeIds));
    $resLoze = $mysqli->query(
        "SELECT id, naziv, id_regija, id_obred FROM loze
         WHERE id IN ($inLoze) AND id_regija IN ($inRegijeStv)
         ORDER BY naziv ASC"
    );
    if ($resLoze) {
        while ($r = $resLoze->fetch_assoc()) {
            $loze[] = [
                'id'        => (int) $r['id'],
                'naziv'     => $r['naziv'],
                'id_regija' => (int) $r['id_regija'],
                'id_obred'  => $r['id_obred'] !== null ? (int) $r['id_obred'] : null,
            ];
        }
        $resLoze->free();
    }
}

// =====================================================
// 5) Upis/izmjena i brisanje za konkretan modul
// =====================================================
$upisIzmjena   = 0;
$brisanjeSloga = 0;
dohvatiUpisBrisanje($mysqli, $idDuznosnik, $upisIzmjena, $brisanjeSloga);

$mysqli->close();

echo json_encode([
    'drzave'          => $drzave,
    'regije'          => $regije,
    'loze'            => $loze,
    'upis_izmjena'    => $upisIzmjena,
    'brisanje_sloga'  => $brisanjeSloga,
], JSON_UNESCAPED_UNICODE);
exit;

// =====================================================
// Pomoćna: dohvat upis_izmjena (tip 4) i brisanje_sloga (tip 5)
// za modul određen GET parametrom html_fajl → meni.id.
// Ako html_fajl nedostaje ili meni red ne postoji → 0 za oboje.
// Ako nema retka tip 4/5 za taj modul → 0 (nema pravo).
// =====================================================
function dohvatiUpisBrisanje(mysqli $mysqli, int $idDuznosnik, int &$upisIzmjena, int &$brisanjeSloga): void
{
    $upisIzmjena   = 0;
    $brisanjeSloga = 0;

    $htmlFajl = isset($_GET['html_fajl']) ? trim((string) $_GET['html_fajl']) : '';
    if ($htmlFajl === '') return;

    // Pronađi meni.id po html_fajl
    $stmtMeni = $mysqli->prepare('SELECT id FROM meni WHERE html_fajl = ? LIMIT 1');
    if (!$stmtMeni) return;
    $stmtMeni->bind_param('s', $htmlFajl);
    if (!$stmtMeni->execute()) { $stmtMeni->close(); return; }
    $resMeni = $stmtMeni->get_result();
    $rowMeni = $resMeni ? $resMeni->fetch_assoc() : null;
    $stmtMeni->close();
    if (!$rowMeni || !isset($rowMeni['id'])) return;
    $meniId = (int) $rowMeni['id'];
    if ($meniId <= 0) return;

    // Tip 4 (upis/izmjena) i tip 5 (brisanje) za taj meni.id
    $stmtPr = $mysqli->prepare(
        'SELECT id_tip_ogranicenja, vrijednost
         FROM duznosnici_ogranicenja
         WHERE id_duznosnik = ? AND id_tip_ogranicenja IN (4, 5)
           AND id_tip_obred_funkcionalnost = ?'
    );
    if (!$stmtPr) return;
    $stmtPr->bind_param('ii', $idDuznosnik, $meniId);
    if (!$stmtPr->execute()) { $stmtPr->close(); return; }
    $resPr = $stmtPr->get_result();
    while ($r = $resPr->fetch_assoc()) {
        $tip = (int) $r['id_tip_ogranicenja'];
        $val = trim((string) ($r['vrijednost'] ?? ''));
        $flag = ($val !== '' && $val !== '0' && (int) $val !== 0) ? 1 : 0;
        if ($tip === 4) $upisIzmjena   = $flag;
        if ($tip === 5) $brisanjeSloga = $flag;
    }
    $stmtPr->close();
}

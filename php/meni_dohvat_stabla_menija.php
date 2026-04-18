<?php
/**
 * =============================================================================
 * meni_dohvat_stabla_menija.php
 * =============================================================================
 * Dohvat stabla horizontalnog menija (JSON) – zajednički za glavni izbornik i alat Test menija.
 * Ranije ime datoteke: Alati_Meni_Test_Meni.php.
 *
 * Jedinstveni endpoint za:
 *   (A) Glavni horizontalni menij aplikacije (Meni.js) – GET from_meni=1
 *   (B) Alat „Test menija“ (Alati_Meni_Test.html / .js) – bez from_meni
 *
 * ----------------------------------------------------------------------------
 * Što radi skripta (kratko)
 * ----------------------------------------------------------------------------
 * - Čita sustav_varijable 103, 104, 105 → meni_tip_id za glavni meni, podmenije, izvršni meni.
 * - Dohvaća redove iz tablice `meni` (aktivno=1, odgovarajući tipovi, opcionalno device).
 * - Za izvršne stavke (tip = varijabla 105) može primijeniti filter: samo oni `meni.id` za koje
 *   u `duznosnici_prava` postoji zapis (duznost = odabrani dužnosnik, pravo = m.id).
 * - Gradi stablo za traku, uklanja grane bez izvršnog linka (pravila kao u postojećoj logici).
 * - Vraća i popis „nekorištenih“ stavki po tipu (nisu u prikazanom stablu) – bez filtera po pravima,
 *   da administrator u testu vidi što još nije u stablu.
 *
 * ----------------------------------------------------------------------------
 * Dužnosnik postoji, ali nema niti jednog retka u duznosnici_prava
 * ----------------------------------------------------------------------------
 * Ranije je u tom slučaju vraćen potpuno prazan JSON (tree + prazni nekoristeni), pa je alat Test menija
 * prikazivao „—“ za sve tri grupe nekoristeni – što nije istina (stablo je prazno jer nema dozvoljenih
 * izvršnih stavki, ali popis neiskorištenih treba odražavati cijelu aktivnu shemu u odnosu na prazno stablo).
 * Sada se nastavlja normalni tijek: SQL ne vraća izvršne redove za tog dužnosnika, stablo je prazno ili
 * reducirano, polje nekoristeni se puni kao i inače (npr. svi aktivni izvršni moduli ispadaju u
 * „ne korišteni“ jer niti jedan nije u stablu).
 *
 * ----------------------------------------------------------------------------
 * Parametar alati_meni_test_puno_stablo=1 (SAMO za slučaj B, alat Test menija)
 * ----------------------------------------------------------------------------
 * Problem koji rješava:
 *   U testu, ako korisnik ne odabere dužnosnika u selectu, ranije je vraćeno prazno stablo.
 *   Napomena „Ne korišteni moduli“ prikazivala je „—“ za prazne liste jer se uopće nije računalo
 *   puno stablo – korisnički dojam bio je konfuzan (prazna traka vs. poruka o modulima).
 *
 * Ponašanje:
 *   - Ako NIJE from_meni=1 I u GET-u je alati_meni_test_puno_stablo=1 I id_duznosnik nije zadan
 *     ili je ≤ 0:
 *       * NE provjerava se postojanje dužnosnika u `duznosnici` niti broj redova u `duznosnici_prava`.
 *       * U SQL-u za dohvat `meni` NE dodaje se uvjet EXISTS(... duznosnici_prava ...) za izvršni tip.
 *         Efekt: svi aktivni izvršni moduli ulaze u izbor, kao da odabrani dužnosnik ima sva prava.
 *   - Inače (glavni meni ILI odabran stvarni dužnosnik ILI nedostaje alati_meni_test_puno_stablo):
 *       * Ponašanje kao prije: obavezan valjan id_duznosnik (osim slučaja praznog bez bypassa – prazno).
 *
 * Sigurnosna granica:
 *   - Kad je from_meni=1, parametar alati_meni_test_puno_stablo se POTPUNO ZANEMAREN.
 *     Glavni meni uvijek koristi samo $_SESSION['id_duznosnik'] i filter po pravima.
 *   - Zahtjev i dalje prolazi kroz require_login_api.php – samo prijavljeni korisnik.
 *   - Ovaj bypass namijenjen isključivo internom alatu; ne koristiti s javnih stranica bez auth.
 *
 * ----------------------------------------------------------------------------
 * Ulaz (GET)
 * ----------------------------------------------------------------------------
 *   device (opcionalno)
 *       0 = svi uređaji (default), 1 = desktop, 2 = mobitel → filter (m.device = 0 OR m.device = ?)
 *
 *   from_meni (opcionalno)
 *       "1" = način glavnog izbornika: id_duznosnik se uzima ISKLJUČIVO iz $_SESSION['id_duznosnik'],
 *             GET id_duznosnik i alati_meni_test_puno_stablo se ignoriraju.
 *
 *   id_duznosnik (opcionalno)
 *       Samo kad NIJE from_meni: ID retka u `duznosnici` za filter duznosnici_prava.
 *       ≤ 0: bez alati_meni_test_puno_stablo=1 → prazan JSON (staro ponašanje).
 *             s alati_meni_test_puno_stablo=1 → puno stablo bez filtera po pravima (vidi gore).
 *
 *   alati_meni_test_puno_stablo (opcionalno)
 *       "1" = dopušten bypass dužnosnika i filtera pravih **samo** ako !from_meni i id_duznosnik ≤ 0.
 *       Šalje ga isključivo Alati_Meni_Test.js (forma Test menija).
 *
 * ----------------------------------------------------------------------------
 * Izlaz
 * ----------------------------------------------------------------------------
 *   Content-Type: application/json
 *   Objekt: tree, izvrsniTipId, podmenijiTipId, idsUMeniju, nekoristeni { main, izvrsni, podmeniji }
 *   Greška: JSON { "error": "200,errno" } ili raniji tekst iz 00_db.php
 *
 * Napomena: endpoint je isključivo meni_dohvat_stabla_menija.php (ne postoji .html).
 * U stablu polje html_fajl odgovara bazi (npr. Clanovi_CRUD.html). Izvršni URL u pregledniku
 * koristi .php (require_login); pretvorbu radi Meni.js / Alati_Meni_Test.js (vnlhHtmlToPhpUrl u 0-Common.js).
 *
 * =============================================================================
 */

require_once __DIR__ . '/require_login_api.php';

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$device = isset($_GET['device']) ? (int)$_GET['device'] : 0;
$fromMeni = isset($_GET['from_meni']) && (string)$_GET['from_meni'] === '1';
if ($fromMeni) {
    $id_duznosnik = (int)($_SESSION['id_duznosnik'] ?? 0);
} else {
    $id_duznosnik = isset($_GET['id_duznosnik']) ? (int)$_GET['id_duznosnik'] : 0;
}

/** Za from_meni=1: skup dužnosti za filter (unija pravih); inače null pa se koristi jedan $id_duznosnik. */
$duznostiZaFilterPrava = null;

/*
 * Bypass filtera po duznosnici_prava za alat „Test menija“ kad dužnosnik nije odabran.
 * NUŽNO: from_meni mora biti laž – inače se parametar zanemaruje (glavni meni).
 */
$alatiMeniTestPunoStablo = !$fromMeni
    && isset($_GET['alati_meni_test_puno_stablo'])
    && (string)$_GET['alati_meni_test_puno_stablo'] === '1';
$bypassDuznosnikZaTest = $alatiMeniTestPunoStablo && $id_duznosnik <= 0;

/** Prazan odgovor kao puni JSON (Meni.js / test očekuju isti oblik). */
function vnlh_meni_traka_send_empty($mysqli) {
    echo json_encode([
        'tree' => [],
        'izvrsniTipId' => null,
        'podmenijiTipId' => null,
        'idsUMeniju' => [],
        'nekoristeni' => ['main' => [], 'izvrsni' => [], 'podmeniji' => []],
    ], JSON_UNESCAPED_UNICODE);
    $mysqli->close();
    exit;
}

// --- Dužnosnik: provjera i filter samo kad nije bypass (test bez odabranog dužnosnika + flag) ---
if (!$bypassDuznosnikZaTest) {
    if ($id_duznosnik <= 0) {
        vnlh_meni_traka_send_empty($mysqli);
    }
    $stmtD = $mysqli->prepare('SELECT 1 FROM duznosnici WHERE id = ? LIMIT 1');
    if (!$stmtD) {
        echo json_encode(['error' => '200,' . $mysqli->errno]);
        $mysqli->close();
        exit;
    }
    $stmtD->bind_param('i', $id_duznosnik);
    $stmtD->execute();
    $resD = $stmtD->get_result();
    $duznosnikPostoji = $resD && $resD->num_rows > 0;
    $stmtD->close();
    if (!$duznosnikPostoji) {
        vnlh_meni_traka_send_empty($mysqli);
    }
    // Broj redova u duznosnici_prava se ne provjerava: 0 prava → nijedan izvršni modul ne prolazi EXISTS
    // u SQL-u ispod, stablo ostaje prazno, nekoristeni se i dalje računaju u odnosu na to stablo.
}

// --- Dohvat varijabli 103, 104, 105 ---
$ids = [103, 104, 105];
$tipIds = [];
foreach ($ids as $vid) {
    $stmt = $mysqli->prepare("SELECT varijabla FROM sustav_varijable WHERE id = ? LIMIT 1");
    if (!$stmt) {
        echo json_encode(['error' => '200,' . $mysqli->errno]);
        exit;
    }
    $stmt->bind_param('i', $vid);
    if (!$stmt->execute()) {
        echo json_encode(['error' => '200,' . $mysqli->errno]);
        exit;
    }
    $res = $stmt->get_result();
    if ($res->num_rows > 0) {
        $row = $res->fetch_assoc();
        $v = isset($row['varijabla']) ? trim((string)$row['varijabla']) : '';
        if ($v !== '' && $v !== '0') {
            $tipIds[] = (int)$v;
        }
    }
    $stmt->close();
}

if (empty($tipIds)) {
    echo json_encode(['tree' => [], 'izvrsniTipId' => null]);
    $mysqli->close();
    exit;
}

$placeholders = implode(',', array_fill(0, count($tipIds), '?'));
$types = str_repeat('i', count($tipIds));

// --- Izvršni tip (var 105) za filter po duznosnici_prava ---
$izvrsniTipIdForFilter = null;
$stmt105 = $mysqli->prepare("SELECT varijabla FROM sustav_varijable WHERE id = 105 LIMIT 1");
if ($stmt105) {
    $stmt105->execute();
    $res105 = $stmt105->get_result();
    if ($res105->num_rows > 0) {
        $row105 = $res105->fetch_assoc();
        $v105 = isset($row105['varijabla']) ? trim((string)$row105['varijabla']) : '';
        if ($v105 !== '' && $v105 !== '0') $izvrsniTipIdForFilter = (int)$v105;
    }
    $stmt105->close();
}

// --- Dohvat menija ---
$sql = "SELECT m.id, m.naziv, m.opis, m.html_fajl, m.putanja, m.ref, m.meni_tip_id, m.roditelj, m.redoslijed, m.device
        FROM meni m
        WHERE m.meni_tip_id IN ($placeholders) AND m.aktivno = 1";
$params = $tipIds;

/*
 * Filter izvršnih stavaka po pravima dužnosnika.
 * Za bypass testa (alati_meni_test_puno_stablo + bez id_duznosnika) uključuju se svi aktivni izvršni
 * redovi iz meni – isti skup kao da dužnosnik ima pravo na svaki m.id (bez EXISTS).
 */
if ($izvrsniTipIdForFilter !== null && !$bypassDuznosnikZaTest) {
    $sql .= " AND (m.meni_tip_id != ? OR EXISTS (SELECT 1 FROM duznosnici_prava dp WHERE dp.duznost = ? AND dp.pravo = m.id))";
    $params[] = $izvrsniTipIdForFilter;
    $params[] = $id_duznosnik;
}

if ($device > 0) {
    $sql .= " AND (m.device = 0 OR m.device = ?)";
    $params[] = $device;
}

$sql .= " ORDER BY m.redoslijed ASC, m.naziv ASC";

$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    echo json_encode(['error' => '200,' . $mysqli->errno]);
    exit;
}

$extraParams = count($params) - count($tipIds);
$stmt->bind_param($types . str_repeat('i', $extraParams), ...$params);

if (!$stmt->execute()) {
    echo json_encode(['error' => '200,' . $mysqli->errno]);
    exit;
}

$result = $stmt->get_result();
$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
$stmt->close();

// --- Main, podmeniji, izvršni tip = varijable 103, 104, 105 ---
$mainTipId = null;
$podmenijiTipId = null;
$izvrsniTipId = null;
foreach ([103 => 'mainTipId', 104 => 'podmenijiTipId', 105 => 'izvrsniTipId'] as $vid => $var) {
    $stmt = $mysqli->prepare("SELECT varijabla FROM sustav_varijable WHERE id = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param('i', $vid);
        if ($stmt->execute()) {
            $res = $stmt->get_result();
            if ($res->num_rows > 0) {
                $row = $res->fetch_assoc();
                $v = isset($row['varijabla']) ? trim((string)$row['varijabla']) : '';
                if ($v !== '' && $v !== '0') {
                    if ($vid === 103) $mainTipId = (int)$v;
                    elseif ($vid === 104) $podmenijiTipId = (int)$v;
                    else $izvrsniTipId = (int)$v;
                }
            }
        }
        $stmt->close();
    }
}

// --- Gradnja stabla i rezanje grana bez izvršnog ---
$byParent = [];
foreach ($rows as $r) {
    $pid = isset($r['roditelj']) ? (int)$r['roditelj'] : 0;
    if (!isset($byParent[$pid])) $byParent[$pid] = [];
    $byParent[$pid][] = $r;
}

// ID-evi koji su roditelji main stavki – izvršni s takvom djecom ne smije u traci s main
$idsRoditeljMain = [];
if ($mainTipId !== null) {
    foreach ($byParent as $pid => $children) {
        foreach ($children as $c) {
            if ((isset($c['meni_tip_id']) ? (int)$c['meni_tip_id'] : 0) == $mainTipId) {
                $idsRoditeljMain[$pid] = true;
                break;
            }
        }
    }
}

function hasIzvrsniInTree($id, $byParent, $izvrsniTipId) {
    if (!isset($byParent[$id])) return false;
    foreach ($byParent[$id] as $child) {
        $tid = isset($child['meni_tip_id']) ? (int)$child['meni_tip_id'] : 0;
        $html = isset($child['html_fajl']) ? trim((string)$child['html_fajl']) : '';
        if ($tid == $izvrsniTipId && $html !== '') return true;
        if (hasIzvrsniInTree((int)$child['id'], $byParent, $izvrsniTipId)) return true;
    }
    return false;
}

function buildTree($parentId, $byParent, $izvrsniTipId, $mainTipId = null, $idsRoditeljMain = []) {
    $out = [];
    if (!isset($byParent[$parentId])) return $out;
    foreach ($byParent[$parentId] as $r) {
        $id = (int)$r['id'];
        $tid = isset($r['meni_tip_id']) ? (int)$r['meni_tip_id'] : 0;
        $html = isset($r['html_fajl']) ? trim((string)$r['html_fajl']) : '';
        $isIzvrsni = ($tid == $izvrsniTipId && $html !== '');
        $hasChildren = isset($byParent[$id]) && count($byParent[$id]) > 0;
        if ($parentId === 0 && $mainTipId !== null && $tid != $mainTipId && !$isIzvrsni) continue;
        if ($parentId === 0 && isset($idsRoditeljMain[$id])) {
            $out = array_merge($out, buildTree($id, $byParent, $izvrsniTipId, $mainTipId, $idsRoditeljMain));
            continue;
        }
        if ($isIzvrsni) {
            $r['children'] = [];
            $out[] = $r;
        } elseif ($hasChildren && hasIzvrsniInTree($id, $byParent, $izvrsniTipId)) {
            $r['children'] = buildTree($id, $byParent, $izvrsniTipId, null);
            $out[] = $r;
        }
    }
    return $out;
}

$tree = buildTree(0, $byParent, $izvrsniTipId, $mainTipId, $idsRoditeljMain);

if (empty($tree) && $mainTipId !== null && !empty($byParent[0])) {
    $tree = buildTree(0, $byParent, $izvrsniTipId, $mainTipId, $idsRoditeljMain);
}

// Korijenska razina = samo main. Izvršni nikad u traci s main – ako ima main djecu, flatten; inače ukloni
if ($mainTipId !== null && $izvrsniTipId !== null) {
    $flat = [];
    foreach ($tree as $n) {
        $nid = isset($n['id']) ? (int)$n['id'] : 0;
        $ntid = isset($n['meni_tip_id']) ? (int)$n['meni_tip_id'] : 0;
        $nhtml = isset($n['html_fajl']) ? trim((string)$n['html_fajl']) : '';
        $nIzvrsni = ($ntid == $izvrsniTipId && $nhtml !== '');
        if ($nIzvrsni) {
            if (isset($idsRoditeljMain[$nid]) && isset($byParent[$nid])) {
                foreach (buildTree($nid, $byParent, $izvrsniTipId, $mainTipId, $idsRoditeljMain) as $child) {
                    $flat[] = $child;
                }
            }
        } else {
            $flat[] = $n;
        }
    }
    $tree = $flat;
}

// Sortiranje: redoslijed, pa naziv
function sortTree(&$arr) {
    usort($arr, function ($a, $b) {
        $ra = isset($a['redoslijed']) ? (int)$a['redoslijed'] : 0;
        $rb = isset($b['redoslijed']) ? (int)$b['redoslijed'] : 0;
        if ($ra !== $rb) return $ra - $rb;
        return strcmp($a['naziv'] ?? '', $b['naziv'] ?? '');
    });
    foreach ($arr as &$n) {
        if (!empty($n['children'])) sortTree($n['children']);
    }
}
sortTree($tree);

// --- Sakupi sve ID-ove iz stabla (isti popis kao za iscrtavanje) ---
function collectTreeIds($arr) {
    $ids = [];
    foreach ($arr as $n) {
        $id = isset($n['id']) ? (int)$n['id'] : 0;
        if ($id > 0) $ids[] = $id;
        if (!empty($n['children'])) {
            $ids = array_merge($ids, collectTreeIds($n['children']));
        }
    }
    return $ids;
}
$idsUMeniju = array_values(array_unique(collectTreeIds($tree)));

// --- Map id -> naziv, roditelj za gradnju putanje stabla ---
$idToNode = [];
$mapRes = $mysqli->query("SELECT id, naziv, roditelj FROM meni");
if ($mapRes) {
    while ($r = $mapRes->fetch_assoc()) {
        $id = (int)$r['id'];
        $idToNode[$id] = ['naziv' => $r['naziv'] ?? '', 'roditelj' => isset($r['roditelj']) ? (int)$r['roditelj'] : 0];
    }
    $mapRes->free();
}

// Proširi idsUMeniju s precima – main u hijerarhiji prikazanih stavki ne smije biti u nekorištenima
$idsZaNekoristene = $idsUMeniju;
foreach ($idsUMeniju as $nid) {
    $cur = isset($idToNode[$nid]) ? $idToNode[$nid]['roditelj'] : 0;
    while ($cur > 0 && isset($idToNode[$cur])) {
        $idsZaNekoristene[] = $cur;
        $cur = $idToNode[$cur]['roditelj'];
    }
}
// Roditelji main stavki (npr. Glavni izbornik) – iz baze, uvijek isključeni iz nekorištenih
if ($mainTipId !== null) {
    $stmtRp = $mysqli->prepare("SELECT DISTINCT roditelj FROM meni WHERE meni_tip_id = ? AND roditelj > 0 AND aktivno = 1");
    if ($stmtRp) {
        $stmtRp->bind_param('i', $mainTipId);
        if ($stmtRp->execute()) {
            $resRp = $stmtRp->get_result();
            while ($rowRp = $resRp->fetch_assoc()) {
                $rid = (int)($rowRp['roditelj'] ?? 0);
                if ($rid > 0) $idsZaNekoristene[] = $rid;
            }
        }
        $stmtRp->close();
    }
}
// Izvršni na korijenu (roditelj=0) – dio strukture, nikad nekorišteni
if ($izvrsniTipId !== null) {
    $stmtRoot = $mysqli->prepare("SELECT id FROM meni WHERE meni_tip_id = ? AND (roditelj = 0 OR roditelj IS NULL) AND aktivno = 1");
    if ($stmtRoot) {
        $stmtRoot->bind_param('i', $izvrsniTipId);
        if ($stmtRoot->execute()) {
            $resRoot = $stmtRoot->get_result();
            while ($rowRoot = $resRoot->fetch_assoc()) {
                $idsZaNekoristene[] = (int)$rowRoot['id'];
            }
        }
        $stmtRoot->close();
    }
}
$idsZaNekoristene = array_values(array_unique($idsZaNekoristene));

$buildPutanjaStabla = function ($id) use (&$idToNode) {
    $parts = [];
    $cur = $id;
    $seen = [];
    while ($cur > 0 && isset($idToNode[$cur]) && !isset($seen[$cur])) {
        $seen[$cur] = true;
        $parts[] = $idToNode[$cur]['naziv'] ?: "(id $cur)";
        $cur = $idToNode[$cur]['roditelj'];
    }
    return implode(' ⟶ ', array_reverse($parts));
};

// --- Nekorišteni: main, izvršni i podmeniji u bazi koji nisu u stablu (isti device filter kao meni) ---
// Nekorišteni = nisu u prikazanom stablu; NEMA filtera po duznosnici_prava (admin vidi sve neiskorištene).
// Kad je bypass (puno stablo bez dužnosnika), $idsZaNekoristene dolazi iz punog stabla – lista je smislena.
// putanja_stabla = cijela putanja od korijena do stavke, odvojeno sa ⟶
$nekoristeniMain = [];
$nekoristeniIzvrsni = [];
$nekoristeniPodmeniji = [];

$buildNekoristeniParams = function ($tipId, $idsUMeniju, $device) {
    $params = [$tipId];
    $ph = count($idsUMeniju) > 0 ? implode(',', array_fill(0, count($idsUMeniju), '?')) : null;
    if ($ph !== null) $params = array_merge($params, $idsUMeniju);
    if ($device > 0) $params[] = $device;
    $types = 'i' . (count($idsUMeniju) > 0 ? str_repeat('i', count($idsUMeniju)) : '') . ($device > 0 ? 'i' : '');
    return [$params, $types, $ph];
};

if ($mainTipId !== null) {
    list($params, $types, $ph) = $buildNekoristeniParams($mainTipId, $idsZaNekoristene, $device);
    $sql = "SELECT id, naziv FROM meni WHERE meni_tip_id = ? AND aktivno = 1";
    if ($ph !== null) $sql .= " AND id NOT IN ($ph)";
    if ($device > 0) $sql .= " AND (device = 0 OR device = ?)";
    $sql .= " ORDER BY naziv ASC";
    $stmt = $mysqli->prepare($sql);
    if ($stmt) {
        $stmt->bind_param($types, ...$params);
        if ($stmt->execute()) {
            $res = $stmt->get_result();
            while ($row = $res->fetch_assoc()) {
                $id = (int)$row['id'];
                $nekoristeniMain[] = ['id' => $id, 'naziv' => $row['naziv'] ?? '', 'putanja_stabla' => $buildPutanjaStabla($id)];
            }
        }
        $stmt->close();
    }
}
if ($izvrsniTipId !== null) {
    list($params, $types, $ph) = $buildNekoristeniParams($izvrsniTipId, $idsZaNekoristene, $device);
    $sql = "SELECT id, naziv FROM meni WHERE meni_tip_id = ? AND aktivno = 1";
    if ($ph !== null) $sql .= " AND id NOT IN ($ph)";
    if ($device > 0) $sql .= " AND (device = 0 OR device = ?)";
    $sql .= " ORDER BY naziv ASC";
    $stmt = $mysqli->prepare($sql);
    if ($stmt) {
        $stmt->bind_param($types, ...$params);
        if ($stmt->execute()) {
            $res = $stmt->get_result();
            while ($row = $res->fetch_assoc()) {
                $id = (int)$row['id'];
                $nekoristeniIzvrsni[] = ['id' => $id, 'naziv' => $row['naziv'] ?? '', 'putanja_stabla' => $buildPutanjaStabla($id)];
            }
        }
        $stmt->close();
    }
}
if ($podmenijiTipId !== null) {
    list($params, $types, $ph) = $buildNekoristeniParams($podmenijiTipId, $idsZaNekoristene, $device);
    $sql = "SELECT id, naziv FROM meni WHERE meni_tip_id = ? AND aktivno = 1";
    if ($ph !== null) $sql .= " AND id NOT IN ($ph)";
    if ($device > 0) $sql .= " AND (device = 0 OR device = ?)";
    $sql .= " ORDER BY naziv ASC";
    $stmt = $mysqli->prepare($sql);
    if ($stmt) {
        $stmt->bind_param($types, ...$params);
        if ($stmt->execute()) {
            $res = $stmt->get_result();
            while ($row = $res->fetch_assoc()) {
                $id = (int)$row['id'];
                $nekoristeniPodmeniji[] = ['id' => $id, 'naziv' => $row['naziv'] ?? '', 'putanja_stabla' => $buildPutanjaStabla($id)];
            }
        }
        $stmt->close();
    }
}

$out = [
    'tree' => $tree,
    'izvrsniTipId' => $izvrsniTipId,
    'podmenijiTipId' => $podmenijiTipId,
    'idsUMeniju' => $idsUMeniju,
    'nekoristeni' => ['main' => $nekoristeniMain, 'izvrsni' => $nekoristeniIzvrsni, 'podmeniji' => $nekoristeniPodmeniji]
];
echo json_encode($out);
$mysqli->close();

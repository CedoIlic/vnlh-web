<?php
// =====================================================
// 0-Poruke_posalji.php
// API: slanje odgovora na poruku (INSERT u sustav_sesije_poruke).
//
// Ulaz (POST):
//   poruka        (obavezno) – tekst poruke
//   id_razgovor   (opcionalno) – ID razgovora za nastavak niti; 0 = novi razgovor
//   id_primatelj  (obavezno osim načina razvoj) – ID korisnika koji prima poruku
//   slanje_razvoj   (opcionalno) – ako je "1": primatelji iz sustav_varijable.id = 1002
//                                  (varijabla: jedan ili više id_korisnika odvojenih zarezom); tip = 'Poruka razvoju'
//   kontekst_razvoj (opcionalno) – ako je "1" i slanje_razvoj nije 1: jedan primatelj iz POST-a; tip = 'Poruka razvoju'
//                                  (samo ako je sesijski korisnik u listi varijable 1002 – isto kao toggle „Razvoj”)
//
// Izlaz:
//   (TEXT) Uspjeh: -1
//   (TEXT) Greška konekcije: 100
//   (TEXT) Nedostaje parametar: 105
//   (TEXT) SQL greška: 200,<sql_errno>
// =====================================================

require_once __DIR__ . '/require_login_api.php';
require_once __DIR__ . '/poruke_razvoj_var_1002.php';

// --- Blok: Konekcija na bazu ---
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: text/plain; charset=utf-8');

// Jednokratno učitavanje ID-jeva iz varijable 1002 (slanje_razvoj + validacija kontekst_razvoj na serveru).
$idsRazvojVar = poruke_razvoj_ids_var_1002($mysqli);

// --- Blok: Parametri (POST) ---
$idPrimatelj = isset($_POST['id_primatelj']) ? (int) $_POST['id_primatelj'] : 0;
$poruka      = isset($_POST['poruka']) ? trim($_POST['poruka']) : '';
$idRazgovor  = isset($_POST['id_razgovor']) ? (int) $_POST['id_razgovor'] : 0;

$slanjeRazvoj = isset($_POST['slanje_razvoj']) && (string) $_POST['slanje_razvoj'] === '1';
// kontekst_razvoj: samo član tima iz varijable 1002 (isti uvjet kao vidljivost togglea „Razvoj” u UI).
$kontekstRazvoj = !$slanjeRazvoj
    && isset($_POST['kontekst_razvoj'])
    && (string) $_POST['kontekst_razvoj'] === '1'
    && poruke_razvoj_sesija_je_clan_tima($mysqli);
/** ENUM tip u sustav_sesije_poruke: običan razgovor 'Poruka' | način razvoj 'Poruka razvoju'. */
$tipPoruke = ($slanjeRazvoj || $kontekstRazvoj) ? 'Poruka razvoju' : 'Poruka';

/** @var int[]|null */
$listaPrimateljaRazvoj = null;

if ($slanjeRazvoj) {
    $listaPrimateljaRazvoj = $idsRazvojVar;
    if ($listaPrimateljaRazvoj === [] || $poruka === '') {
        echo '105';
        exit;
    }
} else {
    if ($idPrimatelj <= 0 || $poruka === '') {
        echo '105';
        exit;
    }
}

$idPosiljatelj = (int) $_SESSION['id_korisnik'];
$sessionId     = session_id();

// --- Blok: Ako id_razgovor=0, sljedeći id_razgovor unutar istog tipa (Poruka / Poruka razvoju ne dijele niz) ---
if ($idRazgovor <= 0) {
    $stmtMax = $mysqli->prepare('SELECT COALESCE(MAX(id_razgovor), 0) + 1 AS novi FROM sustav_sesije_poruke WHERE tip = ?');
    if ($stmtMax) {
        $stmtMax->bind_param('s', $tipPoruke);
        if ($stmtMax->execute()) {
            $resMax = $stmtMax->get_result();
            if ($resMax) {
                $rowMax = $resMax->fetch_assoc();
                $idRazgovor = $rowMax ? (int) $rowMax['novi'] : 1;
            } else {
                $idRazgovor = 1;
            }
        } else {
            $idRazgovor = 1;
        }
        $stmtMax->close();
    } else {
        $idRazgovor = 1;
    }
}

// --- Blok: INSERT poruke (brisano=0 – aktivna poruka; logičko brisanje: 0-Poruke_brisi) ---
$sql = "
    INSERT INTO sustav_sesije_poruke
        (id_razgovor, id_posiljatelj, id_primatelj, session_id_posiljatelj, poruka, vrijeme_slanja, status, tip, brisano)
    VALUES
        (?, ?, ?, ?, ?, NOW(), 'Novo', ?, 0)
";

$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}

if ($listaPrimateljaRazvoj !== null) {
    /*
     * Jedan klik „Pošalji”: isti id_razgovor i tekst za svakog primatelja iz liste (više INSERT redova).
     * bind_param drži reference; $idPrimateljBind se mijenja u petlji prije svakog execute().
     */
    $idPrimateljBind = 0;
    $stmt->bind_param('iiisss', $idRazgovor, $idPosiljatelj, $idPrimateljBind, $sessionId, $poruka, $tipPoruke);
    foreach ($listaPrimateljaRazvoj as $idPrimateljBind) {
        if (!$stmt->execute()) {
            echo '200,' . $stmt->errno;
            $stmt->close();
            $mysqli->close();
            exit;
        }
    }
} else {
    $stmt->bind_param('iiisss', $idRazgovor, $idPosiljatelj, $idPrimatelj, $sessionId, $poruka, $tipPoruke);
    if (!$stmt->execute()) {
        echo '200,' . $stmt->errno;
        $stmt->close();
        $mysqli->close();
        exit;
    }
}

$stmt->close();

// Koverica: za 'Poruka razvoju' trigger ne postavlja ima_neprocitanih — radimo to ručno.
if ($listaPrimateljaRazvoj !== null && $listaPrimateljaRazvoj !== []) {
    $primateljiOsimMene = array_values(array_filter($listaPrimateljaRazvoj, function ($id) use ($idPosiljatelj) {
        return $id !== $idPosiljatelj;
    }));
    if ($primateljiOsimMene !== []) {
        $ph = implode(',', array_fill(0, count($primateljiOsimMene), '?'));
        $tp = str_repeat('i', count($primateljiOsimMene));
        $stmtF = $mysqli->prepare("UPDATE sustav_sesije_aktivne SET ima_neprocitanih = 1 WHERE id_korisnik IN ($ph) AND status = 'aktivna'");
        if ($stmtF) {
            $stmtF->bind_param($tp, ...$primateljiOsimMene);
            $stmtF->execute();
            $stmtF->close();
        }
    }
}

$mysqli->close();

// Uspjeh – VNLH konvencija
echo '-1';

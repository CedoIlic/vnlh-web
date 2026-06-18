<?php
require_once __DIR__ . '/require_login_api.php';
// Spremanje cijelog dokumenta (zaglavlje + stavke) u transakciji.
// Ulaz: POST JSON { id?, naziv, template_id, opis, aktivan, napomena, stavke:[ {zona,vrsta,izvor_id,izvor_tip,...,paragraf_id|slika_stil_id,naziv_stavke}, ... ] }
// Stavke se REPLACE-aju (delete + insert po redoslijedu). FK + CHECK u bazi čuvaju integritet.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}

$raw = file_get_contents('php://input');
$u = json_decode($raw, true);
if (!is_array($u)) {
    echo '105';
    exit;
}

$id = isset($u['id']) ? (int) $u['id'] : 0;
$naziv = trim((string) ($u['naziv'] ?? ''));
$template_id = isset($u['template_id']) ? (int) $u['template_id'] : 0;
$opis = trim((string) ($u['opis'] ?? ''));
$aktivan = !empty($u['aktivan']) ? 1 : 0;
$napomena = trim((string) ($u['napomena'] ?? ''));
$stavke = (isset($u['stavke']) && is_array($u['stavke'])) ? $u['stavke'] : [];

if ($naziv === '' || mb_strlen($naziv, 'UTF-8') > 100 || $template_id <= 0) {
    echo '105';
    exit;
}
$opisV = ($opis === '') ? null : $opis;
$napV = ($napomena === '') ? null : $napomena;
$brojPar = isset($u['broj_stranice_paragraf_id']) ? (int) $u['broj_stranice_paragraf_id'] : 0;
$brojParV = ($brojPar > 0) ? $brojPar : null;   // stil brojača (dokument-razina); NULL = zadani font

$zadnjiRed = 0;   // redoslijed stavke koja se trenutno ubacuje (za dijagnostiku SQL greške)
try {
    $mysqli->begin_transaction();

    if ($id > 0) {
        $stmt = $mysqli->prepare('UPDATE pdf_dokument SET naziv = ?, template_id = ?, opis = ?, aktivan = ?, napomena = ?, broj_stranice_paragraf_id = ? WHERE id = ?');
        $stmt->bind_param('sisisii', $naziv, $template_id, $opisV, $aktivan, $napV, $brojParV, $id);
        $stmt->execute();
        $stmt->close();
    } else {
        $stmt = $mysqli->prepare('INSERT INTO pdf_dokument (naziv, template_id, opis, aktivan, napomena, broj_stranice_paragraf_id) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->bind_param('sisisi', $naziv, $template_id, $opisV, $aktivan, $napV, $brojParV);
        $stmt->execute();
        $id = (int) $mysqli->insert_id;
        $stmt->close();
    }

    // Zamjena stavki
    $del = $mysqli->prepare('DELETE FROM pdf_dokument_stavke WHERE dokument_id = ?');
    $del->bind_param('i', $id);
    $del->execute();
    $del->close();

    if (!empty($stavke)) {
        $dok = 0; $red = 0; $zona = ''; $vrsta = ''; $izParam = null; $izTip = '';
        $izRed = null; $kkljuc = null; $tid = null; $tkol = null; $tvrij = null; $lit = null;
        $parId = null; $sslik = null; $bezkraj = 0; $nap = null; $prekoId = null; $mapa = null;
        $ins = $mysqli->prepare(
            'INSERT INTO pdf_dokument_stavke
             (dokument_id, redoslijed, zona, vrsta, izvor_id, izvor_tip, izvor_red_id, kontekst_kljuc, test_id, trazi_kolona, trazi_vrijednost, literal_tekst, paragraf_id, slika_stil_id, bez_kraja_odlomka, naziv_stavke, preko_izvor_id, mapa_vrijednosti)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $ins->bind_param('iissisisisssiiisis', $dok, $red, $zona, $vrsta, $izParam, $izTip, $izRed, $kkljuc, $tid, $tkol, $tvrij, $lit, $parId, $sslik, $bezkraj, $nap, $prekoId, $mapa);
        $dok = $id;
        $i = 0;
        foreach ($stavke as $s) {
            $i++;
            $red = isset($s['redoslijed']) ? (int) $s['redoslijed'] : $i;
            $zona = in_array(($s['zona'] ?? ''), ['tijelo', 'zaglavlje', 'podnozje', 'naslovna'], true) ? $s['zona'] : 'tijelo';
            $vrsta = in_array(($s['vrsta'] ?? ''), ['tekst', 'slika'], true) ? $s['vrsta'] : '';
            $izTip = in_array(($s['izvor_tip'] ?? ''), ['staticki', 'dinamicki', 'po_vrijednosti', 'korisnicki'], true) ? $s['izvor_tip'] : '';
            if ($vrsta === '' || $izTip === '') {
                throw new RuntimeException('stavka_nevaljana');
            }
            if ($izTip === 'korisnicki') {
                // Upisani tekst — samo za tekst stavke; bez izvora (izvor_id NULL), ostala izvor-polja NULL.
                if ($vrsta !== 'tekst') {
                    throw new RuntimeException('stavka_nevaljana');
                }
                $izParam = null;
                $lit = trim((string) ($s['literal_tekst'] ?? ''));   // trima se; rubni razmaci preko '^'
                $izRed = null; $kkljuc = null; $tkol = null; $tvrij = null;
            } else {
                $izvorId = (int) ($s['izvor_id'] ?? 0);
                if ($izvorId <= 0) {
                    throw new RuntimeException('stavka_nevaljana');
                }
                $izParam = $izvorId;
                $lit = null;
                // Parametri po načinu dohvata (ostali NULL → zadovolji chk_izvor_po_tipu)
                $izRed = ($izTip === 'staticki' && (int) ($s['izvor_red_id'] ?? 0) > 0) ? (int) $s['izvor_red_id'] : null;
                $kkljuc = ($izTip === 'dinamicki' && trim((string) ($s['kontekst_kljuc'] ?? '')) !== '') ? trim((string) $s['kontekst_kljuc']) : null;
                $tkol = ($izTip === 'po_vrijednosti' && trim((string) ($s['trazi_kolona'] ?? '')) !== '') ? trim((string) $s['trazi_kolona']) : null;
                $tvrij = ($izTip === 'po_vrijednosti') ? (string) ($s['trazi_vrijednost'] ?? '') : null;
            }
            // Testni id retka — samo za dinamicki (pregled bez konteksta); inace NULL.
            $tid = ($izTip === 'dinamicki' && (int) ($s['test_id'] ?? 0) > 0) ? (int) $s['test_id'] : null;
            // Stil po vrsti (drugi NULL → zadovolji chk_prikaz_po_vrsti)
            $parId = ($vrsta === 'tekst' && (int) ($s['paragraf_id'] ?? 0) > 0) ? (int) $s['paragraf_id'] : null;
            $sslik = ($vrsta === 'slika' && (int) ($s['slika_stil_id'] ?? 0) > 0) ? (int) $s['slika_stil_id'] : null;
            $bv = (int) ($s['bez_kraja_odlomka'] ?? 0);   // 1=isti red (inline); 2=novi red, isti odlomak
            $bezkraj = ($vrsta === 'tekst' && in_array($bv, [1, 2], true)) ? $bv : 0;
            $n = trim((string) ($s['naziv_stavke'] ?? ''));
            $nap = ($n === '') ? null : $n;
            // Indirektni ključ (samo dinamicki) + mapiranje (svi osim korisnicki)
            $prekoId = ($izTip === 'dinamicki' && (int) ($s['preko_izvor_id'] ?? 0) > 0) ? (int) $s['preko_izvor_id'] : null;
            $mv = ($izTip !== 'korisnicki') ? trim((string) ($s['mapa_vrijednosti'] ?? '')) : '';
            $mapa = ($mv === '') ? null : $mv;
            $zadnjiRed = $red;
            $ins->execute();
        }
        $ins->close();
    }

    $mysqli->commit();
    echo 'OK,' . $id;
} catch (mysqli_sql_exception $e) {
    $mysqli->rollback();
    $info = $e->getCode();
    if ($zadnjiRed > 0) $info .= ' (stavka redoslijed ' . $zadnjiRed . ')';
    echo '200,' . $info;
} catch (RuntimeException $e) {
    $mysqli->rollback();
    echo '105';
}
$mysqli->close();

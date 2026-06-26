<?php
require_once __DIR__ . '/require_login_api.php';
// Spremanje cijelog dokumenta (zaglavlje + stavke) u transakciji.
// Ulaz: POST JSON { id?, naziv, template_id, opis, aktivan, napomena, broj_stranice_paragraf_id?, dokument_prored_default_stil?,
//                   razvoj_aktivan?, razvoj_tablica?, razvoj_kolona?, razvoj_izabrani_id?, stavke:[ {zona,vrsta,izvor_id,izvor_tip,...,paragraf_id|slika_stil_id,naziv_stavke}, ... ] }
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
$proredStil = isset($u['dokument_prored_default_stil']) ? (int) $u['dokument_prored_default_stil'] : 0;
$proredStilV = ($proredStil > 0) ? $proredStil : null;   // stil na koji se primjenjuje extra prored; NULL = nije izabran
// Razvojni/testni kontekst (desni stupac forme)
$razvojAktivan = !empty($u['razvoj_aktivan']) ? 1 : 0;
$razvojTablica = trim((string) ($u['razvoj_tablica'] ?? ''));
$razvojTablicaV = ($razvojTablica === '') ? null : $razvojTablica;
$razvojKolona = trim((string) ($u['razvoj_kolona'] ?? ''));
$razvojKolonaV = ($razvojKolona === '') ? null : $razvojKolona;
$razvojIzId = isset($u['razvoj_izabrani_id']) ? (int) $u['razvoj_izabrani_id'] : 0;
$razvojIzIdV = ($razvojIzId > 0) ? $razvojIzId : null;

$zadnjiRed = 0;   // redoslijed stavke koja se trenutno ubacuje (za dijagnostiku SQL greške)
try {
    $mysqli->begin_transaction();

    if ($id > 0) {
        $stmt = $mysqli->prepare('UPDATE pdf_dokument SET naziv = ?, template_id = ?, opis = ?, aktivan = ?, napomena = ?, broj_stranice_paragraf_id = ?, dokument_prored_default_stil = ?, razvoj_aktivan = ?, razvoj_tablica = ?, razvoj_kolona = ?, razvoj_izabrani_id = ? WHERE id = ?');
        $stmt->bind_param('sisisiiissii', $naziv, $template_id, $opisV, $aktivan, $napV, $brojParV, $proredStilV, $razvojAktivan, $razvojTablicaV, $razvojKolonaV, $razvojIzIdV, $id);
        $stmt->execute();
        $stmt->close();
    } else {
        $stmt = $mysqli->prepare('INSERT INTO pdf_dokument (naziv, template_id, opis, aktivan, napomena, broj_stranice_paragraf_id, dokument_prored_default_stil, razvoj_aktivan, razvoj_tablica, razvoj_kolona, razvoj_izabrani_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->bind_param('sisisiiissi', $naziv, $template_id, $opisV, $aktivan, $napV, $brojParV, $proredStilV, $razvojAktivan, $razvojTablicaV, $razvojKolonaV, $razvojIzIdV);
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
        $parId = null; $sslik = null; $bezkraj = 0; $nap = null; $prekoId = null; $mapa = null; $fmt = null; $fiks = null; $sakrij = 0;
        $relId = null; $listaNacin = null; $listaSep = null; $redakPred = null; $labelaBold = 0;   // relacija_*
        $ins = $mysqli->prepare(
            'INSERT INTO pdf_dokument_stavke
             (dokument_id, redoslijed, zona, vrsta, izvor_id, izvor_tip, izvor_red_id, kontekst_kljuc, test_id, trazi_kolona, trazi_vrijednost, literal_tekst, paragraf_id, slika_stil_id, bez_kraja_odlomka, naziv_stavke, preko_izvor_id, mapa_vrijednosti, format_datuma, fiksna_pozicija, sakrij_ako_prazno, relacija_id, lista_nacin, lista_separator, redak_predlozak, labela_bold)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $ins->bind_param('iissisisisssiiisissdiisssi', $dok, $red, $zona, $vrsta, $izParam, $izTip, $izRed, $kkljuc, $tid, $tkol, $tvrij, $lit, $parId, $sslik, $bezkraj, $nap, $prekoId, $mapa, $fmt, $fiks, $sakrij, $relId, $listaNacin, $listaSep, $redakPred, $labelaBold);
        $dok = $id;
        $i = 0;
        foreach ($stavke as $s) {
            $i++;
            $red = isset($s['redoslijed']) ? (int) $s['redoslijed'] : $i;
            $zona = in_array(($s['zona'] ?? ''), ['tijelo', 'zaglavlje', 'podnozje', 'naslovna'], true) ? $s['zona'] : 'tijelo';
            $vrsta = in_array(($s['vrsta'] ?? ''), ['tekst', 'slika'], true) ? $s['vrsta'] : '';
            $izTip = in_array(($s['izvor_tip'] ?? ''), ['staticki', 'dinamicki', 'po_vrijednosti', 'korisnicki', 'relacija_broj', 'relacija_lista', 'relacija_redak', 'relacija_grupe'], true) ? $s['izvor_tip'] : '';
            if ($vrsta === '' || $izTip === '') {
                throw new RuntimeException('stavka_nevaljana');
            }
            $relId = null; $listaNacin = null; $listaSep = null; $redakPred = null; $labelaBold = 0;   // reset po stavci (relacija_*)
            if ($izTip === 'korisnicki') {
                // Upisani tekst — samo za tekst stavke; bez izvora (izvor_id NULL), ostala izvor-polja NULL.
                if ($vrsta !== 'tekst') {
                    throw new RuntimeException('stavka_nevaljana');
                }
                $izParam = null;
                $lit = trim((string) ($s['literal_tekst'] ?? ''));   // trima se; rubni razmaci preko '^'
                $izRed = null; $kkljuc = null; $tkol = null; $tvrij = null;
            } elseif ($izTip === 'relacija_broj' || $izTip === 'relacija_lista' || $izTip === 'relacija_redak' || $izTip === 'relacija_grupe') {
                // 1-na-više veza: bez whitelist izvora (izvor_id NULL), relacija_id obavezan, bazni id iz konteksta.
                if ($vrsta !== 'tekst') {
                    throw new RuntimeException('stavka_nevaljana');
                }
                $relacijaId = (int) ($s['relacija_id'] ?? 0);
                $kk = trim((string) ($s['kontekst_kljuc'] ?? ''));
                if ($relacijaId <= 0 || $kk === '') {
                    throw new RuntimeException('stavka_nevaljana');
                }
                $relId = $relacijaId;
                $izParam = null; $lit = null; $izRed = null; $kkljuc = $kk; $tkol = null; $tvrij = null;
                if ($izTip === 'relacija_lista') {
                    $ln = (string) ($s['lista_nacin'] ?? 'zarez');
                    $listaNacin = in_array($ln, ['zarez', 'novi_red', 'novi_odlomak'], true) ? $ln : 'zarez';
                    $lsRaw = trim((string) ($s['lista_separator'] ?? ''));
                    $listaSep = ($lsRaw === '') ? null : $lsRaw;
                } elseif ($izTip === 'relacija_redak' || $izTip === 'relacija_grupe') {
                    $rp = trim((string) ($s['redak_predlozak'] ?? ''));
                    if ($rp === '') {
                        throw new RuntimeException('stavka_nevaljana');
                    }
                    $redakPred = $rp;
                    if ($izTip === 'relacija_grupe') $labelaBold = !empty($s['labela_bold']) ? 1 : 0;
                }
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
            // Testni id retka — za dinamicki i relacija_* (pregled bez konteksta); inace NULL.
            $tid = (in_array($izTip, ['dinamicki', 'relacija_broj', 'relacija_lista', 'relacija_redak', 'relacija_grupe'], true) && (int) ($s['test_id'] ?? 0) > 0) ? (int) $s['test_id'] : null;
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
            $fv = ($vrsta === 'tekst') ? trim((string) ($s['format_datuma'] ?? '')) : '';   // format datuma (samo tekst)
            $fmt = ($fv === '') ? null : $fv;
            $fp = ($vrsta === 'tekst' && isset($s['fiksna_pozicija']) && (float) $s['fiksna_pozicija'] > 0) ? (float) $s['fiksna_pozicija'] : null;
            $fiks = $fp;   // fiksna pozicija (mm); NULL = bez
            $sakrij = !empty($s['sakrij_ako_prazno']) ? 1 : 0;   // sakrij cijeli red ako je vrijednost prazna
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

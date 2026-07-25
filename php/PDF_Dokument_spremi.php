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
        $okvirId = null;   // vezani tekst blok (pdf_template_okvir); NULL = obična zona
        $zss = 0;          // zadrzi_svoj_stil (u spojenom redu segment nosi vlastiti znakovni stil)
        $prelom = 0;       // prijelom_prije (prijelom stranice prije stavke; tok, zona tijelo)
        $prelomPosl = 0;   // prijelom_poslije (prijelom stranice poslije stavke; tok, zona tijelo)
        $praznoNacin = 'placeholder';   // ponašanje na prazno (placeholder/crtica/izostavi)
        $skupina = null;   // povezane stavke (nestaju zajedno ako su svi podaci u skupini prazni)
        $prefiks = null;   // literal ispred vrijednosti samo kad postoji
        $sufiks = null;    // literal iza vrijednosti samo kad postoji
        $brojLinija = null; $stilLinije = null; $linDebljina = null; $labelaIstiRed = 0; $prvaNacin = null; $prvaMm = null; $pomakY = null;   // vrsta=linije
        $ins = $mysqli->prepare(
            'INSERT INTO pdf_dokument_stavke
             (dokument_id, redoslijed, zona, vrsta, izvor_id, izvor_tip, izvor_red_id, kontekst_kljuc, test_id, trazi_kolona, trazi_vrijednost, literal_tekst, paragraf_id, slika_stil_id, bez_kraja_odlomka, naziv_stavke, preko_izvor_id, mapa_vrijednosti, format_datuma, fiksna_pozicija, sakrij_ako_prazno, relacija_id, lista_nacin, lista_separator, redak_predlozak, labela_bold, okvir_id, fiksna_pozicija_y, zadrzi_svoj_stil, prijelom_prije, prijelom_poslije, prazno_nacin, prazno_linija_mm, uvjet_izvor_id, uvjet_kontekst_kljuc, uvjet_operator, uvjet_vrijednost, skupina, prefiks, sufiks, podatak_paragraf_id, tablica_stil_id, broj_linija, stil_linije, linija_debljina_mm, labela_u_istom_redu, prva_linija_nacin, prva_linija_mm, pomak_y_mm)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $ins->bind_param('iissisisisssiiisissdiisssiidiiisdisssissiiisdisdd', $dok, $red, $zona, $vrsta, $izParam, $izTip, $izRed, $kkljuc, $tid, $tkol, $tvrij, $lit, $parId, $sslik, $bezkraj, $nap, $prekoId, $mapa, $fmt, $fiks, $sakrij, $relId, $listaNacin, $listaSep, $redakPred, $labelaBold, $okvirId, $fiksy, $zss, $prelom, $prelomPosl, $praznoNacin, $praznoLinijaMm, $uvjetIzvorId, $uvjetKljuc, $uvjetOp, $uvjetVrij, $skupina, $prefiks, $sufiks, $podParId, $tablicaStilId, $brojLinija, $stilLinije, $linDebljina, $labelaIstiRed, $prvaNacin, $prvaMm, $pomakY);
        $dok = $id;
        $i = 0;
        foreach ($stavke as $s) {
            $i++;
            $red = isset($s['redoslijed']) ? (int) $s['redoslijed'] : $i;
            $zona = in_array(($s['zona'] ?? ''), ['tijelo', 'zaglavlje', 'podnozje', 'naslovna'], true) ? $s['zona'] : 'tijelo';
            $vrsta = in_array(($s['vrsta'] ?? ''), ['tekst', 'slika', 'tablica', 'linije'], true) ? $s['vrsta'] : '';
            $izTip = in_array(($s['izvor_tip'] ?? ''), ['staticki', 'dinamicki', 'po_vrijednosti', 'korisnicki', 'relacija_broj', 'relacija_lista', 'relacija_redak', 'relacija_grupe', 'relacija_csv', 'tablica_glasanja', 'linije'], true) ? $s['izvor_tip'] : '';
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
            } elseif ($izTip === 'relacija_broj' || $izTip === 'relacija_lista' || $izTip === 'relacija_redak' || $izTip === 'relacija_grupe' || $izTip === 'relacija_csv') {
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
                } elseif ($izTip === 'relacija_redak' || $izTip === 'relacija_grupe' || $izTip === 'relacija_csv') {
                    $rp = trim((string) ($s['redak_predlozak'] ?? ''));
                    if ($rp === '') {
                        throw new RuntimeException('stavka_nevaljana');
                    }
                    $redakPred = $rp;
                    if ($izTip === 'relacija_grupe') $labelaBold = !empty($s['labela_bold']) ? 1 : 0;
                }
            } elseif ($izTip === 'tablica_glasanja') {
                // Tablica glasanja: bez whitelist izvora; bazni id iz konteksta; tablica_stil_id obavezan (niže).
                if ($vrsta !== 'tablica') { throw new RuntimeException('stavka_nevaljana'); }
                $kk = trim((string) ($s['kontekst_kljuc'] ?? ''));
                if ($kk === '') { throw new RuntimeException('stavka_nevaljana'); }
                $izParam = null; $lit = null; $izRed = null; $kkljuc = $kk; $tkol = null; $tvrij = null;
            } elseif ($izTip === 'linije') {
                // Linije (ručno popunjavanje): bez dohvata; labela (opcionalno) u literal_tekst; paragraf_id obavezan (niže).
                if ($vrsta !== 'linije') { throw new RuntimeException('stavka_nevaljana'); }
                $izParam = null;
                $litRaw = trim((string) ($s['literal_tekst'] ?? ''));   // labela; prazno = bez labele
                $lit = ($litRaw === '') ? null : $litRaw;
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
            // Testni id retka — za dinamicki i relacija_* (pregled bez konteksta); inace NULL.
            $tid = (in_array($izTip, ['dinamicki', 'relacija_broj', 'relacija_lista', 'relacija_redak', 'relacija_grupe', 'relacija_csv', 'tablica_glasanja'], true) && (int) ($s['test_id'] ?? 0) > 0) ? (int) $s['test_id'] : null;
            // Stil po vrsti (drugi NULL → zadovolji chk_prikaz_po_vrsti)
            $parId = (($vrsta === 'tekst' || $vrsta === 'linije') && (int) ($s['paragraf_id'] ?? 0) > 0) ? (int) $s['paragraf_id'] : null;
            $sslik = ($vrsta === 'slika' && (int) ($s['slika_stil_id'] ?? 0) > 0) ? (int) $s['slika_stil_id'] : null;
            $tablicaStilId = ($vrsta === 'tablica' && (int) ($s['tablica_stil_id'] ?? 0) > 0) ? (int) $s['tablica_stil_id'] : null;
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
            $fiks = $fp;   // fiksna pozicija X (mm); NULL = bez
            // Apsolutna Y: -1/prazno = tok (NULL); druga vrijednost = apsolutno (može biti i negativna). Samo tekst.
            $fiksy = ($vrsta === 'tekst' && isset($s['fiksna_pozicija_y']) && $s['fiksna_pozicija_y'] !== '' && $s['fiksna_pozicija_y'] !== null) ? (float) $s['fiksna_pozicija_y'] : null;
            $sakrij = !empty($s['sakrij_ako_prazno']) ? 1 : 0;   // sakrij cijeli red ako je vrijednost prazna
            $okvirId = ((int) ($s['okvir_id'] ?? 0) > 0) ? (int) $s['okvir_id'] : null;   // vezani tekst blok
            // Vlastiti znakovni stil u spojenom redu — samo tekst (za sliku nema smisla).
            $zss = ($vrsta === 'tekst' && !empty($s['zadrzi_svoj_stil'])) ? 1 : 0;
            // Prijelom stranice prije — samo tok u zoni tijelo (apsolutne/okvir/zaglavlje/podnožje ignoriraju).
            $prelom = ($zona === 'tijelo' && $okvirId === null && !empty($s['prijelom_prije'])) ? 1 : 0;
            // Prijelom stranice poslije — isto ograničenje kao prije (samo tok u zoni tijelo).
            $prelomPosl = ($zona === 'tijelo' && $okvirId === null && !empty($s['prijelom_poslije'])) ? 1 : 0;
            // Ponašanje na prazno + sufiks — samo tekst.
            $pn = (string) ($s['prazno_nacin'] ?? 'placeholder');
            $praznoNacin = ($vrsta === 'tekst' && in_array($pn, ['placeholder', 'crtica', 'izostavi', 'linija'], true)) ? $pn : 'placeholder';
            // Dužina crte za ručni upis — samo kad je ponašanje na prazno „linija".
            $plm = isset($s['prazno_linija_mm']) && $s['prazno_linija_mm'] !== '' ? (float) $s['prazno_linija_mm'] : 0;
            $praznoLinijaMm = ($praznoNacin === 'linija' && $plm > 0) ? $plm : null;
            // Uvjetni ispis stavke: bez izvora nema uvjeta (ostala polja se tada ne pamte).
            $uid = (int) ($s['uvjet_izvor_id'] ?? 0);
            $uvjetIzvorId = ($uid > 0) ? $uid : null;
            $ukRaw = trim((string) ($s['uvjet_kontekst_kljuc'] ?? ''));
            $uvjetKljuc = ($uvjetIzvorId && $ukRaw !== '') ? $ukRaw : null;
            $uvjetOp = ($uvjetIzvorId && (string) ($s['uvjet_operator'] ?? '=') === '<>') ? '<>' : '=';
            $uvRaw = trim((string) ($s['uvjet_vrijednost'] ?? ''));
            $uvjetVrij = ($uvjetIzvorId && $uvRaw !== '') ? $uvRaw : null;
            $sk = (int) ($s['skupina'] ?? 0);
            $skupina = ($vrsta === 'tekst' && $sk > 0) ? $sk : null;
            $preRaw = ($vrsta === 'tekst') ? trim((string) ($s['prefiks'] ?? '')) : '';
            $prefiks = ($preRaw === '') ? null : $preRaw;
            $sufRaw = ($vrsta === 'tekst') ? trim((string) ($s['sufiks'] ?? '')) : '';
            $sufiks = ($sufRaw === '') ? null : $sufRaw;
            // Stil PODATKA (relacija_csv): vrijednosti iz predloška u tom stilu; samo tekst.
            $podParId = ($vrsta === 'tekst' && (int) ($s['podatak_paragraf_id'] ?? 0) > 0) ? (int) $s['podatak_paragraf_id'] : null;
            // Parametri linija — samo vrsta=linije (inače NULL / 0 za labela_u_istom_redu).
            $brojLinija = ($vrsta === 'linije') ? max(1, (int) ($s['broj_linija'] ?? 1)) : null;
            $stilLinije = ($vrsta === 'linije') ? (in_array(($s['stil_linije'] ?? ''), ['puno', 'crtkano', 'tockasto'], true) ? $s['stil_linije'] : 'crtkano') : null;
            $linDebljina = ($vrsta === 'linije' && isset($s['linija_debljina_mm']) && (float) $s['linija_debljina_mm'] > 0) ? (float) $s['linija_debljina_mm'] : null;
            $labelaIstiRed = ($vrsta === 'linije' && !empty($s['labela_u_istom_redu'])) ? 1 : 0;
            $prvaNacin = ($vrsta === 'linije') ? (in_array(($s['prva_linija_nacin'] ?? ''), ['margina', 'duzina', 'fiksni_x'], true) ? $s['prva_linija_nacin'] : 'margina') : null;
            $prvaMm = ($vrsta === 'linije' && isset($s['prva_linija_mm']) && $s['prva_linija_mm'] !== '' && $s['prva_linija_mm'] !== null) ? (float) $s['prva_linija_mm'] : null;
            $pomakY = ($vrsta === 'linije' && isset($s['pomak_y_mm']) && $s['pomak_y_mm'] !== '' && $s['pomak_y_mm'] !== null) ? (float) $s['pomak_y_mm'] : null;
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

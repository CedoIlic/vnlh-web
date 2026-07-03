<?php
/**
 * Validacija privremenog otpusta (dijeljeno: _upis.php i _izmjena.php).
 * Vraća kod greške za modal ('035' | '036|<mjeseci>' | '037') ili '' ako je sve u redu.
 *   037 = datum_do u prošlosti (< danas)
 *   036 = dulji od maksimuma (sustav_varijable 126, kalkulativno 30 dana = 1 mjesec)
 *   035 = preklapanje s postojećim otpustom istog člana
 * $excludeId > 0 → izostavi taj zapis iz provjere preklapanja (kod izmjene = sam zapis).
 */
function clanovi_privremeni_otpust_validacija($mysqli, $id_clan, $datum_od, $datum_do, $excludeId) {
    // 037: datum završetka manji od današnjeg (otpust unatrag)
    if ($datum_do < date('Y-m-d')) {
        return '037';
    }

    // 036: dulji od maksimuma (broj mjeseci; mjesec = 30 dana, ostatak ≤15 dolje / ≥16 gore → floor((dani+14)/30))
    $maxMj = 12;
    if ($rsV = $mysqli->query("SELECT varijabla FROM sustav_varijable WHERE id = 126 LIMIT 1")) {
        if ($rowV = $rsV->fetch_assoc()) {
            $vv = (int) $rowV['varijabla'];
            if ($vv > 0) $maxMj = $vv;
        }
        $rsV->free();
    }
    $dani = (int) round((strtotime($datum_do) - strtotime($datum_od)) / 86400);
    if ($dani < 0) $dani = 0;
    $mjeseci = (int) floor(($dani + 14) / 30);
    if ($mjeseci > $maxMj) {
        return '036|' . $maxMj;
    }

    // 035: preklapanje razdoblja za istog člana (postojeći.od ≤ novi.do I postojeći.do ≥ novi.od)
    if ($excludeId > 0) {
        $st = $mysqli->prepare("SELECT COUNT(*) AS n FROM clanovi_privremeni_otpust
            WHERE id_clan = ? AND id <> ? AND datum_od <= ? AND datum_do >= ?");
        if ($st) $st->bind_param('iiss', $id_clan, $excludeId, $datum_do, $datum_od);
    } else {
        $st = $mysqli->prepare("SELECT COUNT(*) AS n FROM clanovi_privremeni_otpust
            WHERE id_clan = ? AND datum_od <= ? AND datum_do >= ?");
        if ($st) $st->bind_param('iss', $id_clan, $datum_do, $datum_od);
    }
    if ($st) {
        $st->execute();
        $r = $st->get_result()->fetch_assoc();
        $st->close();
        if ($r && (int) $r['n'] > 0) {
            return '035';
        }
    }

    return '';
}

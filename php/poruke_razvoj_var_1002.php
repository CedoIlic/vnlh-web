<?php
/**
 * Zajednički pristup sustav_varijable.id = 1002 (primatelji / tim za „Poruka razvoju”).
 * Uključuje: 0-Poruke_posalji.php, 0-Poruke_lista.php, 0-Poruke_poruke.php, 0-Poruke_brisi.php, 0-Poruke_razvoj_toggle_prikazi.php.
 */
if (!function_exists('poruke_razvoj_ids_var_1002')) {
    /**
     * Parsira kolonu varijabla (brojevi odvojeni zarezom/razmacima), bez duplikata, redoslijed kao u stringu.
     *
     * @return int[]
     */
    function poruke_razvoj_ids_var_1002(mysqli $mysqli): array
    {
        $resV = $mysqli->query('SELECT varijabla FROM sustav_varijable WHERE id = 1002 LIMIT 1');
        if (!$resV) {
            return [];
        }
        $rowV = $resV->fetch_assoc();
        $resV->free();
        if (!$rowV) {
            return [];
        }
        $rawV = trim((string) ($rowV['varijabla'] ?? ''));
        if ($rawV === '' || !preg_match_all('/\d+/', $rawV, $mAll)) {
            return [];
        }
        $seen = [];
        $lista = [];
        foreach ($mAll[0] as $s) {
            $n = (int) $s;
            if ($n <= 0) {
                continue;
            }
            if (!isset($seen[$n])) {
                $seen[$n] = true;
                $lista[] = $n;
            }
        }

        return $lista;
    }
}

if (!function_exists('poruke_razvoj_sesija_je_clan_tima')) {
    /**
     * Je li id_korisnik iz sesije u listi ID-jeva iz varijable 1002 (toggle „Razvoj”, GET samo_razvoj, POST kontekst_razvoj).
     *
     * @param mysqli $mysqli otvorena konekcija (ista sesija kao require_login_api)
     */
    function poruke_razvoj_sesija_je_clan_tima(mysqli $mysqli): bool
    {
        if (!isset($_SESSION['id_korisnik'])) {
            return false;
        }
        $me = (int) $_SESSION['id_korisnik'];
        if ($me <= 0) {
            return false;
        }
        $ids = poruke_razvoj_ids_var_1002($mysqli);

        return count($ids) > 0 && in_array($me, $ids, true);
    }
}

<?php
/**
 * Pravila za lozinku pri obveznom mijenjanju nakon prijave (pass_status = 1).
 * Mora biti usklađeno s validacijom u js/Login.js (vnlhPasswordMeetsPolicy).
 */

/** Dozvoljeni specijalni znakovi u lozinci (eksplicitan skup). */
function vnlh_password_special_chars(): string {
    return '!@#$%^&*-_';
}

/**
 * Tekst uputa za kontrolu napomene na login formi.
 */
function vnlh_password_policy_hint_text(): string {
    $s = vnlh_password_special_chars();
    $parts = [];
    for ($i = 0, $len = strlen($s); $i < $len; $i++) {
        $parts[] = $s[$i];
    }
    $popis = implode(' ', $parts);
    return 'Lozinka mora sadržavati bar osam znakova od kojih bar jedno veliko slovo (A–Z), bar jednu numeričku cifru i bar jedan specijalni znak: '
        . $popis . ', ne koristiti čćđšž znakove.';
}

/**
 * Dopušteni znakovi: [a-z], [A–Z], [0-9], te znakovi iz vnlh_password_special_chars().
 */
function vnlh_password_meets_policy(string $pass): bool {
    if (strlen($pass) < 8) {
        return false;
    }
    if (preg_match('/[čćđšžČĆĐŠŽ]/u', $pass)) {
        return false;
    }
    if (!preg_match('/[A-Z]/', $pass)) {
        return false;
    }
    if (!preg_match('/[0-9]/', $pass)) {
        return false;
    }
    $specials = vnlh_password_special_chars();
    $hasSpecial = false;
    for ($i = 0, $len = strlen($specials); $i < $len; $i++) {
        if (strpos($pass, $specials[$i]) !== false) {
            $hasSpecial = true;
            break;
        }
    }
    if (!$hasSpecial) {
        return false;
    }
    $lenP = strlen($pass);
    for ($i = 0; $i < $lenP; $i++) {
        $ch = $pass[$i];
        $o = ord($ch);
        $isAsciiLetter = ($o >= 65 && $o <= 90) || ($o >= 97 && $o <= 122);
        $isDigit = ($o >= 48 && $o <= 57);
        if ($isAsciiLetter || $isDigit) {
            continue;
        }
        if (strpos($specials, $ch) !== false) {
            continue;
        }
        return false;
    }
    return true;
}

<?php
/**
 * Parsiranje sufiksa odgovora razvoja na kraju polja sustav_sesije_poruke.poruka.
 *
 * Kanonski blok (jedan ili više uzastopnih na kraju niza): #<kod>*<tekst>#
 * - kod: cijeli broj (polje kod u sustav_odgovori_razvoja_poruke).
 * - tekst: ne smije sadržavati '#' (inače je potreban drugačiji format).
 *
 * Baza poruke = sve što ostane nakon uklanjanja svih blokova s kraja (prefiks).
 */
declare(strict_types=1);

/**
 * Iz stringa poruke skida uzastopne blokove #kod*tekst# s kraja i vraća prefiks (tekst bez odgovora).
 */
function razvoj_ukloni_sve_odgovore(string $poruka): string
{
    $p = razvoj_razlozi_bazu_i_blokove_s_kraja($poruka);

    return $p['baza'];
}

/**
 * @return array{baza: string, blokovi: list<array{kod: int, tekst: string}>}
 *         blokovi su u kronološkom redoslijedu (prvi odgovor prvi u nizu).
 */
function razvoj_razlozi_bazu_i_blokove_s_kraja(string $poruka): array
{
    $blokovi = [];
    $s = $poruka;
    while (preg_match('/^(.*)#(\d+)\*([^#]*)#$/us', $s, $m)) {
        array_unshift($blokovi, ['kod' => (int) $m[2], 'tekst' => $m[3]]);
        $s = $m[1];
    }

    return ['baza' => $s, 'blokovi' => $blokovi];
}

/** Samo baza (bez sufiksnih odgovora) — alias za čitljivost. */
function razvoj_izdvoji_bazu_poruke(string $poruka): string
{
    return razvoj_ukloni_sve_odgovore($poruka);
}

/**
 * @return list<array{kod: int, tekst: string}>
 */
function razvoj_izdvoji_blokove(string $poruka): array
{
    return razvoj_razlozi_bazu_i_blokove_s_kraja($poruka)['blokovi'];
}

/** Zadnji kod u nizu blokova ili null ako nema blokova. */
function razvoj_zadnji_kod(string $poruka): ?int
{
    $blokovi = razvoj_izdvoji_blokove($poruka);
    if ($blokovi === []) {
        return null;
    }
    $zadnji = $blokovi[count($blokovi) - 1];

    return $zadnji['kod'];
}

/**
 * Dodaje jedan blok na kraj baze (baza ne smije već sadržavati stare sufiksne blokove ako želite čist lanac —
 * pozivatelj prvo koristi razvoj_ukloni_sve_odgovore ako treba).
 */
function razvoj_dodaj_odgovor(string $baza, int $kod, string $tekst): string
{
    return $baza . '#' . $kod . '*' . $tekst . '#';
}

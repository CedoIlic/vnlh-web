-- Jednokratno: prag (broj) neuspjelih prijava / promjene lozinke prije blokade (pass_status = 2).
-- Čita php/vnlh_login_failures.php (VNLH_SUSTAV_VAR_MAX_LOGIN_NEUSPJEH = 107).
-- Ako red već postoji, samo ažurira varijabla (npr. 5).

INSERT INTO sustav_varijable (id, varijabla, Naziv, opis)
VALUES (
    107,
    '5',
    'Maks. neuspjelih prijava',
    'Broj dozvoljenih pogrešnih prijava ili promjena lozinke prije blokade računa; nakon uspješne prijave brojač se poništava.'
)
ON DUPLICATE KEY UPDATE
    varijabla = VALUES(varijabla),
    Naziv = VALUES(Naziv),
    opis = VALUES(opis);

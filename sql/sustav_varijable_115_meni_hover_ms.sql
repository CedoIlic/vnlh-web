-- Jednokratno: kašnjenje (ms) prije proširenja podmenija / ugniježđenog dropdowna pri hoveru (Meni.js, Alati_Meni_Test.js).
-- Čita js/0-Common.js (vnlhLoadMeniHoverDelaysFromVar116And115 → common_sustav_varijable.php?id=115).
-- Napomena: id 114 koristi se za stanku polja Traži (debounce), ne za meni.
-- Vrijednost 0 ili nedostatak retka: zadano 500 ms za podmeni.

INSERT INTO sustav_varijable (id, varijabla, Naziv, opis)
VALUES (
    115,
    '500',
    'Kašnjenje hover podmenija (ms)',
    'Milisekunde čekanja prije prikaza ugniježđenog dropdowna (podmeni) pri hoveru. 0 = zadano 500 ms.'
)
ON DUPLICATE KEY UPDATE
    varijabla = VALUES(varijabla),
    Naziv = VALUES(Naziv),
    opis = VALUES(opis);

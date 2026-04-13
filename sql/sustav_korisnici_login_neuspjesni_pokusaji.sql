-- Jednokratno: broj neuspjelih prijava / promjene lozinke; nakon 5 -> pass_status = 2 (blokada).
-- Pokreni na bazi vnlh kad budeš spreman.

ALTER TABLE sustav_korisnici
    ADD COLUMN login_neuspjesni_pokusaji TINYINT UNSIGNED NOT NULL DEFAULT 0
    COMMENT 'Neuspjeli pokušaji prijave/promjene lozinke; reset pri uspjehu; 5+ -> pass_status=2'
    AFTER pass_status;

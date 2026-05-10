# -*- coding: utf-8 -*-
pairs = [
    ("adrese", "id"),
    ("adrese", "id_clanovi"),
    ("adrese", "id_adrese_tip"),
    ("adrese", "id_drzave_adrese"),
    ("adrese_tip", "id"),
    ("clanovi", "id"),
    ("clanovi", "loza"),
    ("clanovi", "drzava"),
    ("clanovi", "porijeklo"),
    ("clanovi", "stupanj"),
    ("clanovi", "telefon"),
    ("clanovi", "e_mail"),
    ("clanovi", "adresa"),
    ("clanovi", "na_prijedlog"),
    ("clanovi_porijeklo", "id"),
    ("drzave", "id"),
    ("drzave_adresa", "id"),
    ("duznosnici", "id"),
    ("duznosnici", "id_nadredjeni"),
    ("duznosnici_ogranicenja", "id"),
    ("duznosnici_prava", "id"),
    ("duznosnici_prava", "duznost"),
    ("duznosnici_prava", "pravo"),
    ("duznosnici_tip", "id"),
    ("email_tip", "id"),
    ("e_maili", "id"),
    ("e_maili", "id_clanovi"),
    ("e_maili", "id_email_tip"),
    ("jezici", "id"),
    ("loze", "id"),
    ("loze", "id_regija"),
    ("loze", "id_obred"),
    ("loze", "id_drzava"),
    ("loze", "id_drzava_adrese"),
    ("loze_tip", "id"),
    ("loze_tip", "id_obred"),
    ("meni", "id"),
    ("meni", "meni_tip_id"),
    ("meni_tip", "id"),
    ("napredovanja", "id"),
    ("napredovanja", "id_clanovi"),
    ("napredovanja", "id_stupanj"),
    ("napredovanja", "id_tip_napredovanja"),
    ("napredovanja", "id_loza_napredovanja"),
    ("napredovanja_tip", "id"),
    ("obredi", "id"),
    ("radovi_drzave_gostiju", "id"),
    ("radovi_prisustvo_tip", "id"),
    ("radovi_tip", "id"),
    ("regije", "id"),
    ("regije", "id_drzava"),
    ("stupnjevi", "id"),
    ("stupnjevi", "id_obred"),
    ("sustav_korisnici", "id_korisnik"),
    ("sustav_korisnici", "id_duznosnik"),
    ("sustav_korisnici_login", "id_korisnik"),
    ("sustav_odgovori_razvoja_boje", "id"),
    ("sustav_odgovori_razvoja_poruke", "id"),
    ("sustav_odgovori_razvoja_poruke", "boja"),
    ("sustav_sesije_aktivne", "id"),
    ("sustav_sesije_aktivne", "id_korisnik"),
    ("sustav_sesije_aktivne", "chat_modal_sugovornik_id"),
    ("sustav_sesije_poruke", "id"),
    ("sustav_sesije_poruke", "id_razgovor"),
    ("sustav_sesije_poruke", "id_posiljatelj"),
    ("sustav_sesije_poruke", "id_primatelj"),
    ("sustav_varijable", "id"),
    ("telefoni", "id"),
    ("telefoni", "id_clanovi"),
    ("telefoni", "id_telefoni_tip"),
    ("telefoni_tip", "id"),
]


def block(t, c):
    return f"""SELECT
    '{t}' AS tablica,
    '{c}' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{t}' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{t}' AND COLUMN_NAME = '{c}') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{t}' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{t}' AND COLUMN_NAME = '{c}') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `{t}` WHERE `{c}` IS NOT NULL AND `{c}` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{t}' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{t}' AND COLUMN_NAME = '{c}') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena"""


def main():
    # Blokovi odvojeni s razmacima OKO UNION ALL: ako GUI/kopiranje "spljošti" retke
    # između bloka (# napomena) i UNION, bez razmaka bi nastalo 'napomenaUNION ALLSELECT'.
    blocks = [block(t, c).strip() for t, c in pairs]
    union_body = "\n UNION ALL \n".join(blocks)

    hdr = """-- =========================================================
-- Provjera negativnih (bez DELIMITERA / bez procedura) — HeidiSQL, phpMyAdmin
--
-- Isti stupci kao u sql/vnlh_migracija_unsigned_provjera_negativnih.sql
--
-- Zašto: neki GUI dijeli skriptu na više upita nakon točka-zareza i ne poštuje
-- 'DELIMITER $$', pa PROCEDURE pukne (1064 oko '$$').
--
-- Ova datoteka ima tri obična SELECT-a razdvojena točka-zarezom — pokreni sve odjednom.
--
-- Oslanja se na CASE WHEN (ne IF): IF na nekim serverima računa obje grane pa COUNT
-- nad nepostojećom tablicom baci 1146, CASE skoči na prvom WHEN.
--
-- Kad mijenjaš MODIFY u migraciji, uskadi ovaj UNION ili pokreni Python gen skriptu.
--
-- Za ručno lijepljenje čuvaj razmak između * i FROM te između napomena i FROM.
-- U phpMyAdminu koristi Uvezi datoteku — ne kopiraj cijeli UNION u tekst polje.
--
-- =========================================================

SET NAMES utf8mb4;

"""

    q1 = "SELECT DATABASE() AS baza_pregledana, NOW() AS vrijeme_pregleda;\n\n"
    # Razmak prije ORDER/WHERE nakon pseudonima: spljošteni tekst bez \n ostaje parseabilan.
    # * i FROM uvijek odvojeni razmakom (\n sam ne preživi sve normalizacije u GUI-ju → *FROM).
    q2 = (
        "SELECT * FROM (\n" + union_body + "\n) AS vnlh_neg_union ORDER BY tablica, stupac;\n\n"
    )
    q3 = (
        "SELECT tablica, stupac, tablica_postoji, stupac_postoji, negativnih_redaka, napomena FROM (\n"
        + union_body
        + "\n) AS vnlh_only_problems "
        "WHERE negativnih_redaka > 0 ORDER BY negativnih_redaka DESC, tablica, stupac;\n"
    )

    path = r"d:\vnlh-web\sql\vnlh_migracija_unsigned_provjera_negativnih_gui.sql"
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(hdr + q1 + q2 + q3)
    print("Wrote", path, "rows", len(pairs))


if __name__ == "__main__":
    main()

-- =========================================================
-- sustav_sesije_poruke.brisano – logičko brisanje niti poruka
--
-- Rezime: brisanje u aplikaciji postavlja brisano=1 i ne uklanja red iz baze.
-- U povijesti (API lista/dohvat) prikazuju se samo poruke s brisano=0.
-- Poruke s brisano=1 nigdje se ne prikazuju – ponašaju se kao da ne postoje.
--
-- Idempotentno: ADD COLUMN IF NOT EXISTS.
-- Ako triggeri još nemaju uvjet brisano (stara instalacija), nakon ovoga
-- ponovo pokreni cijeli sql/sustav_sesije_aktivne_ima_neprocitanih.sql
-- (DROP/CREATE triggera + kolona ima_neprocitanih idempotentno).
--
-- Aplikacija: 0-Poruke_brisi.php postavlja brisano=1 umjesto DELETE.
-- =========================================================

ALTER TABLE sustav_sesije_poruke
  ADD COLUMN IF NOT EXISTS brisano TINYINT(1) NOT NULL DEFAULT 0
  COMMENT 'Brisanje postavlja 1 i ne briše red. Povijest/API: samo brisano=0. S brisano=1 poruke se ne prikazuju – kao da ne postoje. 0-Poruke_brisi; triggeri broje nepročitano samo uz 0.';

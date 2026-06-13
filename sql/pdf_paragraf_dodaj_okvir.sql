-- pdf_paragraf: dodaj okvir (border) oko paragrafa — 13 okvir_* stupaca.
-- Okvir = jedna-celija tablica u pdfmake; debljina 0 = strana bez linije;
-- podloga okvira dominira nad boja_pozadine/traka; sirina po stranama (do margine / po sadrzaju).
ALTER TABLE `pdf_paragraf`
  ADD COLUMN `okvir_debljina_gore_mm`   decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Debljina gornje linije okvira u mm; 0=nema linije' AFTER `uvlaka_prvi_red_mm`,
  ADD COLUMN `okvir_debljina_dolje_mm`  decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Debljina donje linije okvira u mm; 0=nema linije' AFTER `okvir_debljina_gore_mm`,
  ADD COLUMN `okvir_debljina_lijevo_mm` decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Debljina lijeve linije okvira u mm; 0=nema linije' AFTER `okvir_debljina_dolje_mm`,
  ADD COLUMN `okvir_debljina_desno_mm`  decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Debljina desne linije okvira u mm; 0=nema linije' AFTER `okvir_debljina_lijevo_mm`,
  ADD COLUMN `okvir_padding_gore_mm`    decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Unutarnji razmak teksta od gornje linije okvira u mm' AFTER `okvir_debljina_desno_mm`,
  ADD COLUMN `okvir_padding_dolje_mm`   decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Unutarnji razmak teksta od donje linije okvira u mm' AFTER `okvir_padding_gore_mm`,
  ADD COLUMN `okvir_padding_lijevo_mm`  decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Unutarnji razmak teksta od lijeve linije okvira u mm' AFTER `okvir_padding_dolje_mm`,
  ADD COLUMN `okvir_padding_desno_mm`   decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Unutarnji razmak teksta od desne linije okvira u mm' AFTER `okvir_padding_lijevo_mm`,
  ADD COLUMN `okvir_boja`               varchar(7) NOT NULL DEFAULT '#000000' COMMENT 'Boja linija okvira, hex; jedna za sve 4 strane' AFTER `okvir_padding_desno_mm`,
  ADD COLUMN `okvir_boja_podloge`       varchar(7) DEFAULT NULL COMMENT 'Boja podloge (ispune) okvira, hex; NULL=bez ispune. Kad okvir postoji, dominira nad boja_pozadine/traka' AFTER `okvir_boja`,
  ADD COLUMN `okvir_do_lijeve_margine`  tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Lijevi rub okvira ide do lijeve margine (1) ili po sadrzaju teksta (0)' AFTER `okvir_boja_podloge`,
  ADD COLUMN `okvir_do_desne_margine`   tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Desni rub okvira ide do desne margine (1) ili po sadrzaju teksta (0)' AFTER `okvir_do_lijeve_margine`,
  ADD COLUMN `okvir_postuj_uvlaku`      tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Kad strana ide do margine, a ovo=1, ide do uvlake te strane (uvlaka_lijevo/desno) umjesto do margine; obje strane' AFTER `okvir_do_desne_margine`;

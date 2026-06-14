-- pdf_paragraf: dodaj flag "pozadina_popuni_razmak".
-- Kada postoji razmak izmedu odlomaka, boja pozadine moze popuniti taj razmak (1) ili ne (0).
-- Dominira pozadina gornjeg odlomka; vrijedi samo izmedu susjednih odlomaka ISTOG tipa,
-- i NE za zadnji odlomak u nizu istog tipa (ispod njega se ne puni).
ALTER TABLE `pdf_paragraf`
  ADD COLUMN `pozadina_popuni_razmak` tinyint(1) NOT NULL DEFAULT 0
    COMMENT 'Boja pozadine puni i razmak do sljedeceg odlomka istog tipa (1=da); dominira pozadina gornjeg; ne vrijedi za zadnji u nizu istog tipa'
    AFTER `pozadina_cijeli_red`;

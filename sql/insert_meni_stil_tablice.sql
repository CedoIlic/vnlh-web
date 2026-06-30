-- Meni: „PDF Stilovi tablica" (Administrator → PDF → PDF Kompozer). Sistemska tablica — ručno na HeidiSQL.
-- roditelj 115 = PDF Kompozer; meni_tip_id 4 = forma; redoslijed 40 (iza „PDF Stilovi slike" 30;
-- 50 je zauzet „PDF Uzorci stranica"). device 1 = samo desktop. aktivno/test = 1.
INSERT INTO `meni` (`naziv`, `opis`, `napomena`, `html_fajl`, `putanja`, `ref`, `meni_tip_id`, `roditelj`, `redoslijed`, `device`, `aktivno`, `test`)
VALUES ('PDF Stilovi tablica', 'PDF Stilovi iscrtavanja tablica', '',
        'PDF_Stilovi_Tablice_CRUD.html', 'html/', 'pdf_stilovi_tablice_crud', 4, 115, 40, 1, 1, 1);

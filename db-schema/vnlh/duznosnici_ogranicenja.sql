CREATE TABLE `duznosnici_ogranicenja` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `id_duznosnik` int(11) NOT NULL COMMENT 'ID dužnosnika (FK logički na duznosnici.id) čija se ova ograničenja odnose na sve retke u skupu.',
  `id_tip_ogranicenja` smallint(6) NOT NULL COMMENT 'Vrsta ograničenja: 1=država (geo), 2=regija, 3=loža; 4=upis/izmjena po funkcionalnosti (meni); 5=brisanje po funkcionalnosti; 6=stupnjevi po obredu. Određuje semantiku id_tip_obred_funkcionalnost i vrijednost.',
  `id_tip_obred_funkcionalnost` int(11) DEFAULT NULL COMMENT 'Za tip 1–3: NULL (nije korišten; ID entiteta je u vrijednost). Za tip 4–5: meni.id (stavka menija / modul). Za tip 6: obredi.id (obred za koji vrijedi dozvoljeni stupanj u vrijednost).',
  `vrijednost` int(11) DEFAULT NULL COMMENT 'Za tip 1: ID države; tip 2: ID regije; tip 3: ID lože; tip 4 i 5: 0 ili 1 (ne/ da za pravo); tip 6: stupnjevi.id (dozvoljen članski stupanj za taj obred).',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Ograničenja dužnosti: geo (država/regija/loža), CRUD prava po meniju, stupnjevi po obredu.';

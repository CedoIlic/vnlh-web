-- Blagajna lože — šifarnik tipova troškova (najam, materijal, reprezentacija…).
-- Zajednički za sve lože (nije po loži). Koristi ga glavna knjiga.
-- Brisanje tipa u upotrebi blokira FK djeteta (ON DELETE RESTRICT → poruka 106).
CREATE TABLE `loze_blagajna_tip_troska` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'PK tipa troška',
  `naziv` varchar(50) NOT NULL COMMENT 'Naziv tipa troška (najam, materijal, reprezentacija…)',
  `redosljed` int(11) NOT NULL DEFAULT 0 COMMENT 'Redoslijed prikaza (0-100)',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Blagajna lože — tipovi troškova';

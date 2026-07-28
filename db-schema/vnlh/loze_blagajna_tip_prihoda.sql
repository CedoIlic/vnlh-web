-- Blagajna lože — šifarnik tipova prihoda (članarina, upisnina, donacija…).
-- Zajednički za sve lože (nije po loži). Koristi ga cjenik lože, cjenik CSI i glavna knjiga.
-- Brisanje tipa u upotrebi blokira FK djeteta (ON DELETE RESTRICT → poruka 106).
CREATE TABLE `loze_blagajna_tip_prihoda` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'PK tipa prihoda',
  `naziv` varchar(50) NOT NULL COMMENT 'Naziv tipa prihoda (članarina, upisnina, donacija…)',
  `redosljed` int(11) NOT NULL DEFAULT 0 COMMENT 'Redoslijed prikaza (0-100)',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Blagajna lože — tipovi prihoda';

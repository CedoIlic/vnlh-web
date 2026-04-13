-- sustav_sesije_aktivne – aktivne sesije (INSERT nakon logina, UPDATE pri zaštićenim zahtjevima).
-- Pokreni jednom na bazi prije korištenja forme Alati_Aktivne_Sesije.

CREATE TABLE IF NOT EXISTS sustav_sesije_aktivne (
  id int(11) NOT NULL AUTO_INCREMENT COMMENT 'Jedinstveni identifikator sloga; interno razlikovanje zapisa.',
  id_korisnik int(11) NOT NULL COMMENT 'Identifikator korisnika kojem sesija pripada; koristi se za dohvat sesija korisnika.',
  session_id varchar(128) NOT NULL COMMENT 'Jedinstveni identifikator sesije; služi za identifikaciju konkretnog login-a/browsera/uređaja.',
  login_vrijeme datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Vrijeme otvaranja sesije (login); služi za evidenciju trajanja sesije.',
  zadnja_aktivnost datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Vrijeme zadnje aktivnosti; ažurira se pri radu i koristi za timeout.',
  otvorena_stranica varchar(255) NULL DEFAULT NULL COMMENT 'Trenutno otvorena forma, modul ili ruta; informacija gdje se korisnik nalazi.',
  povijest_sesije text NULL DEFAULT NULL COMMENT 'Redoslijed posjećenih skripti (basename), npr. Login.php, Meni.php, … odvojeno zarezom i razmakom.',
  ip_adresa varchar(45) NULL DEFAULT NULL COMMENT 'IP adresa korisnika; koristi se za sigurnost i dijagnostiku.',
  user_agent varchar(1024) NULL DEFAULT NULL COMMENT 'Podaci o pregledniku ili uređaju; služe za tehničku evidenciju i debug.',
  status enum('aktivna','timeout','logout') NOT NULL DEFAULT 'aktivna' COMMENT 'Stanje sesije: aktivna, timeout ili logout; sustav postavlja status i job briše istekle slogove.',
  PRIMARY KEY (id),
  UNIQUE KEY uq_sustav_sesije_aktivne_session_id (session_id),
  KEY ix_sustav_sesije_aktivne_id_korisnik (id_korisnik),
  KEY ix_sustav_sesije_aktivne_korisnik_status (id_korisnik, status),
  KEY ix_sustav_sesije_aktivne_status (status),
  KEY ix_sustav_sesije_aktivne_zadnja_aktivnost (zadnja_aktivnost),
  CONSTRAINT fk_ssa_korisnik FOREIGN KEY (id_korisnik) REFERENCES sustav_korisnici (id_korisnik) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =============================================================
-- sustav_sesije_poruke – dodavanje COMMENT-a na svaku kolonu
--                      – kolone tip i status mijenjaju se u ENUM
-- Izvršiti ručno na bazi (agent ima samo READ-ONLY pristup).
-- =============================================================

ALTER TABLE sustav_sesije_poruke
  MODIFY COLUMN id int(11) NOT NULL AUTO_INCREMENT
    COMMENT 'PK – jedinstveni identifikator poruke',
  MODIFY COLUMN id_razgovor int(11) NOT NULL DEFAULT 0
    COMMENT 'FK razgovor – grupira poruke u tijek komunikacije',
  MODIFY COLUMN id_posiljatelj int(11) NOT NULL
    COMMENT 'FK korisnik – tko šalje poruku',
  MODIFY COLUMN id_primatelj int(11) NOT NULL
    COMMENT 'FK korisnik – tko prima poruku',
  MODIFY COLUMN session_id_posiljatelj varchar(128) DEFAULT NULL
    COMMENT 'Sesija iz koje je poruka poslana (korisnik može imati više sesija)',
  MODIFY COLUMN session_id_primatelj varchar(128) DEFAULT NULL
    COMMENT 'Sesija kojoj je poruka usmjerena (točna sesija primatelja)',
  MODIFY COLUMN poruka text NOT NULL
    COMMENT 'Tekst poruke – sadržaj vidljiv u prozoru razgovora',
  MODIFY COLUMN vrijeme_slanja datetime NOT NULL DEFAULT current_timestamp()
    COMMENT 'Kada je poruka poslana – za kronološki prikaz',
  MODIFY COLUMN vrijeme_isporuke datetime DEFAULT NULL
    COMMENT 'Kada je poruka dostavljena klijentu primatelja',
  MODIFY COLUMN vrijeme_procitano datetime DEFAULT NULL
    COMMENT 'Kada je primatelj otvorio/pročitao poruku',
  MODIFY COLUMN status ENUM('Novo', 'Isporučeno', 'Pročitano') NOT NULL DEFAULT 'Novo'
    COMMENT 'Stanje poruke u životnom ciklusu dostave: Novo | Isporučeno | Pročitano',
  MODIFY COLUMN tip ENUM('Poruka', 'Poruka razvoju', 'Chat poruka') NOT NULL DEFAULT 'Poruka'
    COMMENT 'Vrsta poruke: Poruka – interna između korisnika | Poruka razvoju – bug/prijedlog timu | Chat poruka – real-time chat';

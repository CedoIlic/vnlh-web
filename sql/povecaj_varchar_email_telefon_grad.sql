-- Povećanje varchar kolona koje su prekratke za dulje vrijednosti (strict mode na serveru).
-- e_maili.email  : varchar(30) → varchar(100)  (email s više točaka lako prelazi 30 znakova)
-- telefoni.telefon: varchar(20) → varchar(30)   (međunarodni broj + razmaci/crtice)
-- adrese.grad    : varchar(15) → varchar(50)    (npr. "Slavonski Brod" = 14 znakova)
-- Pokrenuti jednom na lokalnoj i na serverskoj bazi.

ALTER TABLE e_maili
  MODIFY COLUMN email varchar(100) NOT NULL DEFAULT '';

ALTER TABLE telefoni
  MODIFY COLUMN telefon varchar(30) NOT NULL DEFAULT '';

ALTER TABLE adrese
  MODIFY COLUMN grad varchar(50) NOT NULL DEFAULT '';

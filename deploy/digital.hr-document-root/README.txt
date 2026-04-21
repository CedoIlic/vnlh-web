================================================================================
digital.hr — document root (ravan s mapom vnlh/)
================================================================================

Gdje: isti direktorij kao vnlh/ (npr. public_html), NE unutar vnlh/.

Datoteke za copy-paste na server:
  • index.html     — početna stranica; učitava robi.jpg (isti folder)
  • robi.jpg       — slika na početnoj (kopiraj zajedno s index.html)
  • .htaccess      — cijela datoteka: zamijeni postojeći .htaccess
  • htaccess-dodatak.txt — SAMO ako ne želiš dirati ostatak .htaccessa:
                            zalijepi sadržaj NA VRH postojećeg .htaccessa

Varijanta A — najjednostavnije
  1. Otvori .htaccess iz ove mape, Ctrl+A, kopiraj, na serveru zamijeni cijeli .htaccess.
  2. index.html kopiraj u isti direktorij.

Varijanta B — zadrži svoj cPanel .htaccess
  1. Otvori htaccess-dodatak.txt, kopiraj sve.
  2. Na serveru otvori .htaccess i zalijepi NA POČETAK (iznad # php -- BEGIN).
  3. index.html kopiraj u isti direktorij.

Aplikacija: https://digital.hr/vnlh/...

================================================================================

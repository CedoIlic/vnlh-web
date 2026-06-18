# Izračun datuma

Formula za pretvorbu normalnog datuma u datum „budućeg" kalendara.

## Polazni (normalni) datum

- `D` = dan
- `M` = mjesec (1–12, siječanj = 1)
- `Y` = godina

## Formula

1. **Godina u budućnosti:**

   ```
   Y_nova = Y + 4000
   ```

2. **Mjesec u novom kalendaru (ožujak = 1):**

   ```
   M_novi = ((M - 3 + 12) mod 12) + 1
   ```

3. **Dan ostaje isti:**

   ```
   D_novi = D
   ```

**Rezultat:**

```
D_novi. dan M_novi. mjeseca Y_nova. godine
```

## Tablica preračuna mjeseca

| Normalni mjesec | Novi mjesec |
|---|---|
| 3 (ožujak) | 1 |
| 4 (travanj) | 2 |
| 5 (svibanj) | 3 |
| 6 (lipanj) | 4 |
| 7 (srpanj) | 5 |
| 8 (kolovoz) | 6 |
| 9 (rujan) | 7 |
| 10 (listopad) | 8 |
| 11 (studeni) | 9 |
| 12 (prosinac) | 10 |
| 1 (siječanj) | 11 |
| 2 (veljača) | 12 |

## Provjera na primjeru

Polazno: **18. lipnja 2026.** → `M=6`, `D=18`, `Y=2026`

```
Y_nova = 2026 + 4000 = 6026
M_novi = ((6 - 3 + 12) mod 12) + 1 = 4
D_novi = 18
```

**Rezultat:** 18. dan 4. mjeseca 6026. godine

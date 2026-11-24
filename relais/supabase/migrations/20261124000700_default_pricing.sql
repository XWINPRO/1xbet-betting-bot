-- =====================================================================
-- Relais · 007 — Grille tarifaire de départ pour les livraisons ponctuelles.
-- Valeurs indicatives À AJUSTER par l'administrateur (Admin › Tarification).
-- Prix = max(minimum, base + prix_km × distance) + supplément colis,
-- arrondi à la centaine supérieure. Distance à vol d'oiseau.
-- =====================================================================
insert into public.pricing_rules (name, is_active, base_fee, per_km_fee, min_fee, max_distance_km, rounding, package_surcharges, currency)
values (
  'Grille de départ (à ajuster)', true, 500, 150, 1000, 40, 100,
  '{"document": 0, "small": 0, "food": 0, "medium": 300, "large": 1000, "fragile": 500}'::jsonb,
  'XAF'
);

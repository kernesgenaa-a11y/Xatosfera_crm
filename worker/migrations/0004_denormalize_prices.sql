ALTER TABLE properties ADD COLUMN price_usd REAL;
ALTER TABLE clients ADD COLUMN budget_max_usd REAL;

UPDATE properties
SET price_usd = CASE UPPER(COALESCE(currency, 'USD'))
  WHEN 'USD' THEN price
  WHEN 'EUR' THEN ROUND(price * 1.08, 2)
  WHEN 'UAH' THEN ROUND(price * 0.024, 2)
  ELSE price
END
WHERE price IS NOT NULL
  AND price_usd IS NULL;

UPDATE clients
SET budget_max_usd = CASE UPPER(COALESCE(currency, 'USD'))
  WHEN 'USD' THEN budget
  WHEN 'EUR' THEN ROUND(budget * 1.08, 2)
  WHEN 'UAH' THEN ROUND(budget * 0.024, 2)
  ELSE budget
END
WHERE budget IS NOT NULL
  AND budget_max_usd IS NULL;

CREATE INDEX IF NOT EXISTS idx_properties_match_prefilter
  ON properties (status, category, district, price_usd);

CREATE INDEX IF NOT EXISTS idx_clients_match_prefilter
  ON clients (property_type, status, district, budget_max_usd);

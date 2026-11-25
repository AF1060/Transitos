-- Altitude do ponto de observação (metros acima do nível do mar). Predefinição 0 = comportamento anterior.
ALTER TABLE observer_settings ADD COLUMN IF NOT EXISTS observer_altitude_m DOUBLE PRECISION NOT NULL DEFAULT 0;

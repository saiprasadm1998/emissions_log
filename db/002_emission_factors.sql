CREATE TABLE emission_factors (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factor_code   TEXT NOT NULL,
    stream        TEXT NOT NULL,
    factor_value  NUMERIC NOT NULL,
    factor_unit   TEXT NOT NULL,
    valid_from    DATE NOT NULL,
    valid_to      DATE,               -- NULL = still open / in force
    basis         TEXT,
    EXCLUDE USING gist (
        factor_code WITH =,
        daterange(valid_from, valid_to, '[]') WITH &&
    )
);

CREATE TABLE source_factor_mapping (
    source_code TEXT PRIMARY KEY REFERENCES emission_sources(source_code),
    factor_code TEXT NOT NULL
);

CREATE TABLE emission_sources (
    source_code   TEXT PRIMARY KEY,
    source_name   TEXT NOT NULL,
    source_type   TEXT NOT NULL CHECK (source_type IN ('FLARE','VENT')),
    process_unit  TEXT,
    area          TEXT,
    status        TEXT NOT NULL CHECK (status IN ('ACTIVE','DECOMMISSIONED'))
);

CREATE TABLE emission_events (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_ref          TEXT NOT NULL,
    source_code        TEXT NOT NULL REFERENCES emission_sources(source_code),
    start_datetime     TIMESTAMPTZ NOT NULL,
    end_datetime       TIMESTAMPTZ,
    reported_volume    NUMERIC,
    volume_unit        TEXT,
    cause              TEXT,
    recorded_by        TEXT,
    remarks            TEXT,
    is_accepted        BOOLEAN NOT NULL DEFAULT false,
    rejection_reasons  TEXT[] NOT NULL DEFAULT '{}',
    is_voided          BOOLEAN NOT NULL DEFAULT false,
    void_reason        TEXT
);

-- Supports FR-03 server-side filtering by source and date range.
CREATE INDEX idx_emission_events_source_date
    ON emission_events (source_code, start_datetime);

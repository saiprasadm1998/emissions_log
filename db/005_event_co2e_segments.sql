CREATE TABLE event_co2e_segments (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id              UUID NOT NULL REFERENCES emission_events(id),
    factor_id             UUID NOT NULL REFERENCES emission_factors(id),
    period_month          DATE NOT NULL,
    segment_volume_ksm3   NUMERIC NOT NULL,
    co2e_tco2e            NUMERIC NOT NULL
);

-- Supports FR-09 dashboard aggregation (monthly trend, ranked by source
-- via a join back to emission_events) grouped/summed in the database.
CREATE INDEX idx_segments_period_month ON event_co2e_segments (period_month);
CREATE INDEX idx_segments_event_id ON event_co2e_segments (event_id);

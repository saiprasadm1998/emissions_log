CREATE TABLE month_closures (
    period_month  DATE PRIMARY KEY,
    closed_by     UUID REFERENCES users(id),
    closed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

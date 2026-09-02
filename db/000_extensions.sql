-- Enables gen_random_uuid() for surrogate keys, and teaches GiST indexes
-- to handle plain equality (=) alongside range overlap (&&), which the
-- emission_factors exclusion constraint (002) depends on.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

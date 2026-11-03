-- Aggregate counters only.
--
-- Every row is a number attached to a day (or to 'total'). Nothing identifies a
-- visitor: no IP, no user agent, no link. That keeps the public stats page
-- honest and the database boring.

CREATE TABLE IF NOT EXISTS counters (
  scope  TEXT    NOT NULL, -- 'total' or 'YYYY-MM-DD' (UTC)
  metric TEXT    NOT NULL, -- resolves, downloads, bytes, page_views, ...
  value  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, metric)
);

-- The stats page reads one day and the trailing week; this keeps both cheap.
CREATE INDEX IF NOT EXISTS counters_scope_idx ON counters (scope);

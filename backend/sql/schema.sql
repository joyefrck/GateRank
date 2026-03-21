CREATE TABLE IF NOT EXISTS airports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  website VARCHAR(512) NOT NULL,
  status ENUM('normal', 'risk', 'down') NOT NULL DEFAULT 'normal',
  plan_price_month DECIMAL(10,2) NOT NULL,
  has_trial TINYINT(1) NOT NULL DEFAULT 0,
  tags_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_airports_name (name)
);

CREATE TABLE IF NOT EXISTS airport_metrics_daily (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  airport_id BIGINT UNSIGNED NOT NULL,
  date DATE NOT NULL,
  uptime_percent_30d DECIMAL(5,2) NOT NULL,
  median_latency_ms DECIMAL(8,2) NOT NULL,
  median_download_mbps DECIMAL(8,2) NOT NULL,
  packet_loss_percent DECIMAL(5,2) NOT NULL,
  stable_days_streak INT UNSIGNED NOT NULL,
  domain_ok TINYINT(1) NOT NULL DEFAULT 1,
  ssl_days_left INT NOT NULL,
  recent_complaints_count INT UNSIGNED NOT NULL DEFAULT 0,
  history_incidents INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_airport_metrics_daily_airport_date (airport_id, date),
  CONSTRAINT fk_airport_metrics_daily_airport FOREIGN KEY (airport_id) REFERENCES airports(id)
);

CREATE TABLE IF NOT EXISTS airport_scores_daily (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  airport_id BIGINT UNSIGNED NOT NULL,
  date DATE NOT NULL,
  score_s DECIMAL(6,2) NOT NULL,
  score_p DECIMAL(6,2) NOT NULL,
  score_c DECIMAL(6,2) NOT NULL,
  score_r DECIMAL(6,2) NOT NULL,
  risk_penalty DECIMAL(6,2) NOT NULL,
  score DECIMAL(6,2) NOT NULL,
  recent_score DECIMAL(6,2) NOT NULL,
  historical_score DECIMAL(6,2) NOT NULL,
  final_score DECIMAL(6,2) NOT NULL,
  details_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_airport_scores_daily_airport_date (airport_id, date),
  INDEX idx_airport_scores_daily_date_final (date, final_score),
  CONSTRAINT fk_airport_scores_daily_airport FOREIGN KEY (airport_id) REFERENCES airports(id)
);

CREATE TABLE IF NOT EXISTS airport_rankings_daily (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  airport_id BIGINT UNSIGNED NOT NULL,
  date DATE NOT NULL,
  list_type ENUM('today', 'stable', 'value', 'new', 'risk') NOT NULL,
  rank_no INT UNSIGNED NOT NULL,
  score DECIMAL(6,2) NOT NULL,
  details_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_airport_rankings_daily_unique (airport_id, date, list_type),
  INDEX idx_airport_rankings_daily_query (date, list_type, rank_no),
  CONSTRAINT fk_airport_rankings_daily_airport FOREIGN KEY (airport_id) REFERENCES airports(id)
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor VARCHAR(128) NOT NULL,
  action VARCHAR(128) NOT NULL,
  request_id VARCHAR(64) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_admin_audit_logs_created_at (created_at)
);

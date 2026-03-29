CREATE TABLE IF NOT EXISTS airports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  website VARCHAR(512) NOT NULL,
  websites_json JSON NULL,
  status ENUM('normal', 'risk', 'down') NOT NULL DEFAULT 'normal',
  plan_price_month DECIMAL(10,2) NOT NULL,
  has_trial TINYINT(1) NOT NULL DEFAULT 0,
  subscription_url VARCHAR(1024) NULL,
  manual_tags_json JSON NULL,
  auto_tags_json JSON NULL,
  applicant_email VARCHAR(255) NULL,
  applicant_telegram VARCHAR(128) NULL,
  founded_on DATE NULL,
  airport_intro TEXT NULL,
  test_account VARCHAR(255) NULL,
  test_password VARCHAR(255) NULL,
  tags_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_airports_name (name)
);

CREATE TABLE IF NOT EXISTS airport_applications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  website VARCHAR(512) NOT NULL,
  websites_json JSON NULL,
  status ENUM('normal', 'risk', 'down') NOT NULL DEFAULT 'normal',
  plan_price_month DECIMAL(10,2) NOT NULL,
  has_trial TINYINT(1) NOT NULL DEFAULT 0,
  subscription_url VARCHAR(1024) NULL,
  applicant_email VARCHAR(255) NOT NULL,
  applicant_telegram VARCHAR(128) NOT NULL,
  founded_on DATE NOT NULL,
  airport_intro TEXT NOT NULL,
  test_account VARCHAR(255) NOT NULL,
  test_password VARCHAR(255) NOT NULL,
  approved_airport_id BIGINT UNSIGNED NULL,
  review_status ENUM('pending', 'reviewed', 'rejected') NOT NULL DEFAULT 'pending',
  review_note TEXT NULL,
  reviewed_by VARCHAR(128) NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_airport_applications_review_status_created_at (review_status, created_at DESC),
  INDEX idx_airport_applications_name (name),
  INDEX idx_airport_applications_applicant_email (applicant_email)
);

CREATE TABLE IF NOT EXISTS airport_metrics_daily (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  airport_id BIGINT UNSIGNED NOT NULL,
  date DATE NOT NULL,
  uptime_percent_30d DECIMAL(5,2) NOT NULL,
  uptime_percent_today DECIMAL(5,2) NULL,
  latency_samples_ms JSON NULL,
  latency_mean_ms DECIMAL(8,2) NULL,
  latency_std_ms DECIMAL(8,2) NULL,
  latency_cv DECIMAL(10,4) NULL,
  download_samples_mbps JSON NULL,
  median_latency_ms DECIMAL(8,2) NOT NULL,
  median_download_mbps DECIMAL(8,2) NOT NULL,
  packet_loss_percent DECIMAL(5,2) NOT NULL,
  stable_days_streak INT UNSIGNED NOT NULL,
  is_stable_day TINYINT(1) NULL,
  domain_ok TINYINT(1) NOT NULL DEFAULT 1,
  ssl_days_left INT NULL,
  recent_complaints_count INT UNSIGNED NOT NULL DEFAULT 0,
  history_incidents INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_airport_metrics_daily_airport_date (airport_id, date),
  CONSTRAINT fk_airport_metrics_daily_airport FOREIGN KEY (airport_id) REFERENCES airports(id)
);

CREATE TABLE IF NOT EXISTS airport_probe_samples (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  airport_id BIGINT UNSIGNED NOT NULL,
  sampled_at DATETIME NOT NULL,
  sample_type ENUM('latency', 'download', 'availability') NOT NULL,
  probe_scope ENUM('stability', 'performance') NOT NULL DEFAULT 'stability',
  latency_ms DECIMAL(8,2) NULL,
  download_mbps DECIMAL(8,2) NULL,
  availability TINYINT(1) NULL,
  source VARCHAR(128) NOT NULL DEFAULT 'manual',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_probe_airport_time (airport_id, sampled_at),
  INDEX idx_probe_airport_type_time (airport_id, sample_type, sampled_at),
  CONSTRAINT fk_probe_samples_airport FOREIGN KEY (airport_id) REFERENCES airports(id)
);

CREATE TABLE IF NOT EXISTS airport_packet_loss_samples (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  airport_id BIGINT UNSIGNED NOT NULL,
  sampled_at DATETIME NOT NULL,
  probe_scope ENUM('stability', 'performance') NOT NULL DEFAULT 'performance',
  packet_loss_percent DECIMAL(5,2) NOT NULL,
  source VARCHAR(128) NOT NULL DEFAULT 'manual',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_packet_loss_airport_time (airport_id, sampled_at),
  CONSTRAINT fk_packet_loss_samples_airport FOREIGN KEY (airport_id) REFERENCES airports(id)
);

CREATE TABLE IF NOT EXISTS airport_performance_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  airport_id BIGINT UNSIGNED NOT NULL,
  sampled_at DATETIME NOT NULL,
  source VARCHAR(128) NOT NULL DEFAULT 'cron-performance',
  status ENUM('success', 'partial', 'skipped', 'failed') NOT NULL,
  subscription_format VARCHAR(64) NULL,
  parsed_nodes_count INT UNSIGNED NOT NULL DEFAULT 0,
  supported_nodes_count INT UNSIGNED NOT NULL DEFAULT 0,
  selected_nodes_json JSON NOT NULL,
  tested_nodes_json JSON NOT NULL,
  median_latency_ms DECIMAL(8,2) NULL,
  median_download_mbps DECIMAL(8,2) NULL,
  packet_loss_percent DECIMAL(5,2) NULL,
  error_code VARCHAR(64) NULL,
  error_message VARCHAR(1024) NULL,
  diagnostics_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_perf_runs_airport_time (airport_id, sampled_at),
  CONSTRAINT fk_perf_runs_airport FOREIGN KEY (airport_id) REFERENCES airports(id)
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

CREATE TABLE IF NOT EXISTS admin_system_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  setting_key VARCHAR(128) NOT NULL,
  value_json JSON NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_admin_system_settings_key (setting_key)
);

CREATE TABLE IF NOT EXISTS admin_access_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  description TEXT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  token_masked VARCHAR(64) NOT NULL,
  scopes_json JSON NOT NULL,
  status ENUM('active', 'revoked') NOT NULL DEFAULT 'active',
  expires_at DATETIME NULL,
  last_used_at DATETIME NULL,
  last_used_ip VARCHAR(64) NULL,
  created_by VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_admin_access_tokens_hash (token_hash),
  INDEX idx_admin_access_tokens_status (status),
  INDEX idx_admin_access_tokens_last_used_at (last_used_at),
  INDEX idx_admin_access_tokens_expires_at (expires_at)
);

CREATE TABLE IF NOT EXISTS admin_manual_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  airport_id BIGINT UNSIGNED NOT NULL,
  date DATE NOT NULL,
  kind ENUM('full', 'stability', 'performance', 'risk', 'time_decay') NOT NULL,
  status ENUM('queued', 'running', 'succeeded', 'failed') NOT NULL DEFAULT 'queued',
  message TEXT NULL,
  created_by VARCHAR(128) NOT NULL,
  request_id VARCHAR(64) NOT NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_admin_manual_jobs_lookup (airport_id, date, kind, status),
  INDEX idx_admin_manual_jobs_created_at (created_at),
  CONSTRAINT fk_admin_manual_jobs_airport FOREIGN KEY (airport_id) REFERENCES airports(id)
);

CREATE TABLE IF NOT EXISTS news_articles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  excerpt TEXT NOT NULL,
  cover_image_url VARCHAR(1024) NOT NULL,
  content_markdown MEDIUMTEXT NOT NULL,
  content_html MEDIUMTEXT NOT NULL,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_news_articles_slug (slug),
  INDEX idx_news_articles_status_published_at (status, published_at DESC),
  INDEX idx_news_articles_updated_at (updated_at DESC)
);

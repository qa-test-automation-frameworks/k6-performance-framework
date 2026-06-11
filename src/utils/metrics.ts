import { Counter, Gauge, Rate, Trend } from 'k6/metrics';

export const authDuration = new Trend('custom_auth_duration_ms', true);
export const articleReadDuration = new Trend('custom_article_read_duration_ms', true);
export const articleWriteDuration = new Trend('custom_article_write_duration_ms', true);
export const totalBusinessErrors = new Counter('custom_business_errors_total');
export const authSuccessRate = new Rate('custom_auth_success_rate');
export const activeVuCount = new Gauge('custom_active_vus');

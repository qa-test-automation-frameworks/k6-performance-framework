import { Counter, Rate, Trend } from 'k6/metrics';

/** Authentication latency in milliseconds. */
export const authDuration = new Trend('custom_auth_duration_ms', true);
/** Read-only article request latency in milliseconds. */
export const articleReadDuration = new Trend('custom_article_read_duration_ms', true);
/** Article mutation latency in milliseconds. */
export const articleWriteDuration = new Trend('custom_article_write_duration_ms', true);
/** Count of HTTP responses representing business-operation failures. */
export const totalBusinessErrors = new Counter('custom_business_errors_total');
/** Ratio of successful authentication operations. */
export const authSuccessRate = new Rate('custom_auth_success_rate');

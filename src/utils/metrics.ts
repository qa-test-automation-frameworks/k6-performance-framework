import { Counter, Rate, Trend } from 'k6/metrics';

/** Authentication latency in milliseconds. */
export const authDuration = new Trend('custom_auth_duration_ms', true);
/** Read-only article request latency in milliseconds. */
export const articleReadDuration = new Trend('custom_article_read_duration_ms', true);
/** Article mutation latency in milliseconds. */
export const articleWriteDuration = new Trend('custom_article_write_duration_ms', true);
/** Comment operation latency in milliseconds. */
export const commentDuration = new Trend('custom_comment_duration_ms', true);
/** Profile operation latency in milliseconds. */
export const profileDuration = new Trend('custom_profile_duration_ms', true);
/** Tag operation latency in milliseconds. */
export const tagDuration = new Trend('custom_tag_duration_ms', true);
/** Count of HTTP responses representing business-operation failures. */
export const totalBusinessErrors = new Counter('custom_business_errors_total');
/** Ratio of successful authentication operations. */
export const authSuccessRate = new Rate('custom_auth_success_rate');
/** Ratio of successful article read operations. */
export const articleReadSuccessRate = new Rate('custom_article_read_success_rate');
/** Ratio of successful article write operations. */
export const articleWriteSuccessRate = new Rate('custom_article_write_success_rate');
/** Ratio of successful comment operations. */
export const commentSuccessRate = new Rate('custom_comment_success_rate');
/** Ratio of successful profile operations. */
export const profileSuccessRate = new Rate('custom_profile_success_rate');
/** Ratio of successful tag operations. */
export const tagSuccessRate = new Rate('custom_tag_success_rate');

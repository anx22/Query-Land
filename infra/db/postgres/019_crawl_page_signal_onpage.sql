-- 019_crawl_page_signal_onpage — durable on-page SEO signals for resumable crawls.
--
-- Extends 017_crawl_page_signals so the full on-page audit rule set (meta description, headings,
-- thin content, alt text, viewport, html lang, hreflang, structured data, mixed content) can be
-- finalized from storage after a resumable crawl's frontier drains — not just title/canonical.
-- Stored as one JSON object column; rows written before this migration default to '{}', which the
-- store maps to neutral EMPTY_ON_PAGE_SIGNALS (no false positives on legacy signals).
ALTER TABLE crawl_page_signals ADD COLUMN IF NOT EXISTS onpage_signals TEXT NOT NULL DEFAULT '{}';

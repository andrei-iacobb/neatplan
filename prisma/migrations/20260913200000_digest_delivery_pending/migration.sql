-- A delivery is now CLAIMED before the send, not recorded after it. Claiming
-- afterwards meant two concurrent runners - the in-process scheduler and an
-- external cron hitting the same Monday - both found no row, both sent, and only
-- then wrote. PENDING is the claim; a row stuck in it is a process that died
-- mid-send and becomes retryable after a stale window.
ALTER TYPE "DigestDeliveryStatus" ADD VALUE IF NOT EXISTS 'PENDING';

# Issue #9: European Arbitration Chamber unusual for Japan-based company

**Priority:** MEDIUM
**Status:** ✅ DONE

## Problem

**Terms state (Section 11):**
> "Any dispute...shall be referred to and finally resolved by the International Commercial Arbitration Court under the European Arbitration Chamber (Belgium, Brussels, Avenue Louise, 146)..."

**Reality:** The company is based in Kyoto, Japan. The governing law is Japanese law. Using a Belgian arbitration institution is unusual and potentially costly for both parties. The arbitration seat is Kyoto, but the administering institution is in Brussels — this creates procedural complexity.

## Recommended Action

Consider using a Japan-based or Asia-Pacific arbitration institution (e.g., Japan Commercial Arbitration Association — JCAA, or the ICC International Court of Arbitration with a Tokyo seat). Alternatively, if the European Arbitration Chamber was chosen intentionally, document the reasoning.

## Resolution

**Completed:** 2026-02-11

Removed the foreign arbitration structure and simplified dispute handling to Japanese law plus exclusive court jurisdiction in Kyoto, Japan.

**Summary of changes:**
- Section 10 now states governing law only (Japan).
- Section 11 now uses a single court-based clause: exclusive first-instance jurisdiction of Kyoto District Court.
- Removed the prior arbitration framework to reduce complexity and align with a Japan-based individual developer operation.

**Files changed:**
- `packages/web/app/terms/terms.md:219`
- `packages/web/app/terms/terms.md:223`

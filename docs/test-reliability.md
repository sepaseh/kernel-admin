# Test failure ownership and reliability

[English](test-reliability.md) · [فارسی](test-reliability.fa.md)

A failure followed by a pass needs investigation; it is not proof of a harmless transient. Preserve the first log, revision, command, runtime/OS/browser, locale, synthetic input, concurrency and resource conditions. Distinguish a product race, fixture synchronization, resource leak, unavailable prerequisite and a workload/deadline issue before changing assertions.

Record the owning role, reproduction, failure/pass counts, cause or hypothesis, fix, regression evidence and next review date. Report failed attempts, skips and unexecuted manual work separately from passes. A configured workflow or dated QA record is not fresh execution.

Keep deterministic readiness and isolated state. Do not add hidden retries, skip required cases, widen visual tolerances, reduce stress inputs or increase deadlines merely to obtain green. If separate behavior families need independent bounded child tests, retain each existing corpus, assertion and deadline and prove mandatory registration; preserve genuine coverage. Documentation cannot waive a required check.

Any proposed exceptional quarantine needs explicit approval, a named owner, meaningful alternative coverage and a bounded review/expiry date, at most seven days after approval. An expired or ownerless exception cannot establish readiness. Security, authorization, isolation and data-loss failures remain blocking.

Clean only resources owned by the test. For future real Docker execution, follow the [owned-resource lifecycle](../deploy/docker/README.md); never prune shared resources. Recheck the cause and run the relevant [canonical checks](validation.md).

Lighthouse remains a real audit with unchanged metric budgets and throttling. Its temporary advisory exception expires on **2026-11-07T00:00:00Z**. The **Kernel Admin frontend/test maintainer** owns fixture-startup repair and review before expiry. Report the original audit/setup failure separately; it is not a pass. An expired exception blocks validation until a renewed explicit decision or restored blocking enforcement is recorded.

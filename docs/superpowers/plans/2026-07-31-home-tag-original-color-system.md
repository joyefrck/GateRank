# Home Tag Original Color System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the existing system semantic color mapping for compact tags on the GateRank homepage.

**Architecture:** Keep `FeatureTag` as the homepage-specific compact presentation layer, but remove its duplicate keyword-to-color logic. Resolve colors through the shared `getTagBadgeTone` function so sponsored cards, desktop ranking rows, and mobile ranking cards stay visually compact while sharing one semantic palette.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Node test runner through `tsx`.

---

### Task 1: Wire compact homepage tags to the shared semantic palette

**Files:**
- Modify: `backend/tests/frontendCrawlableLinks.test.ts`
- Modify: `src/components/TagBadge.test.tsx`
- Modify: `src/pages/home/HomePageV3.tsx`

- [x] **Step 1: Write the failing homepage source regression test**

Add this test beside the existing React homepage source tests in `backend/tests/frontendCrawlableLinks.test.ts`:

```ts
test('React homepage keeps compact feature tags on the shared system color palette', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/pages/home/HomePageV3.tsx'), 'utf8');

  assert.match(source, /import \{ getTagBadgeTone \} from '\.\.\/\.\.\/components\/TagBadge';/);
  assert.match(source, /const tone = getTagBadgeTone\(tag\);/);
  assert.match(source, /\$\{tone\.className\}/);
  assert.doesNotMatch(source, /const normalized = tag\.toLowerCase\(\);/);
  assert.match(source, /rounded px-2 py-0\.5 text-\[10px\]/);
});
```

Extend `src/components/TagBadge.test.tsx` with the representative system palette assertion:

```ts
test('risk and value tags keep the original system color families', () => {
  assert.match(getTagBadgeTone('风险观察').className, /\borange-/);
  assert.match(getTagBadgeTone('性价比高').className, /\byellow-/);
});
```

- [x] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npx tsx --test --test-name-pattern="compact feature tags" backend/tests/frontendCrawlableLinks.test.ts
```

Expected: FAIL because `HomePageV3.tsx` does not import or call `getTagBadgeTone` and still contains the local `normalized` keyword mapping.

- [x] **Step 3: Replace the homepage-local color mapping**

Add the shared import in `src/pages/home/HomePageV3.tsx`:

```ts
import { getTagBadgeTone } from '../../components/TagBadge';
```

Replace `FeatureTag` with:

```tsx
function FeatureTag({ tag, bordered = false }: { tag: string; bordered?: boolean; key?: React.Key }) {
  const tone = getTagBadgeTone(tag);
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-black tracking-wide ${tone.className} ${bordered ? 'border' : 'border border-transparent'}`}>
      <span className={`h-1 w-1 shrink-0 rounded-full ${tone.dotClassName}`} />
      {tag}
    </span>
  );
}
```

This keeps the homepage dimensions and small radius while using both the original system badge and dot colors.

- [x] **Step 4: Run the focused source and palette tests**

Run:

```bash
npx tsx --test --test-name-pattern="compact feature tags" backend/tests/frontendCrawlableLinks.test.ts
npx tsx --test src/components/TagBadge.test.tsx
```

Expected: both commands PASS.

- [x] **Step 5: Run frontend verification**

Run:

```bash
npm run lint
npm run build
```

Expected: TypeScript validation and Vite production build complete successfully. If an unrelated pre-existing typecheck issue appears, record it separately; do not modify unrelated files.

- [x] **Step 6: Review the focused diff**

Run:

```bash
git diff --check -- src/pages/home/HomePageV3.tsx src/components/TagBadge.test.tsx backend/tests/frontendCrawlableLinks.test.ts
git diff -- src/pages/home/HomePageV3.tsx src/components/TagBadge.test.tsx backend/tests/frontendCrawlableLinks.test.ts
```

Expected: only the shared palette import, compact `FeatureTag` implementation, and focused regression test are present.

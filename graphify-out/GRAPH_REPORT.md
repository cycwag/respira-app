# Graph Report - respira  (2026-11-10)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 123 nodes · 202 edges · 11 communities (8 shown, 3 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3b610355`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9

## God Nodes (most connected - your core abstractions)
1. `fetchWithTimeout()` - 10 edges
2. `NewsModal()` - 9 edges
3. `ParticleCanvas()` - 9 edges
4. `DashboardPage()` - 7 edges
5. `react` - 7 edges
6. `assessRisk()` - 6 edges
7. `getProfile()` - 6 edges
8. `next` - 6 edges
9. `fetchArticleDetail()` - 5 edges
10. `fetchIspaNews()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `@supabase/supabase-js@^2.45.6` --declares--> `@supabase/supabase-js`  [EXTRACTED]
  frontend/package.json → backend/package.json
- `DashboardPage()` --calls--> `ParticleCanvas()`  [EXTRACTED]
  frontend/app/dashboard/page.js → frontend/components/ParticleCanvas.js
- `handleSelectArticle()` --calls--> `fetchArticleDetail()`  [EXTRACTED]
  frontend/components/NewsModal.js → frontend/lib/api.js
- `loadNews()` --calls--> `fetchIspaNews()`  [EXTRACTED]
  frontend/components/NewsModal.js → frontend/lib/api.js
- `AssessmentPage()` --calls--> `saveProfile()`  [EXTRACTED]
  frontend/app/assessment/page.js → frontend/lib/api.js

## Import Cycles
- None detected.

## Communities (11 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (15): app, authLimiter, cors, express, generalLimiter, newsLimiter, path, calculatePersonalOddsRatio() (+7 more)

### Community 1 - "Community 1"
Cohesion: 0.22
Nodes (16): DashboardPage(), loadData(), TIP_DETAILS_MAP, NewsModal(), handleSelectArticle(), loadNews(), assessRisk(), fetchArticleDetail() (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (17): dependencies, cors@^2.8.5, dotenv@^16.4.7, express@^4.21.2, devDependencies, nodemon@^3.1.9, main, name (+9 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (16): @supabase/supabase-js@^2.49.1, @supabase/supabase-js, dependencies, next@^14.2.15, react@^18.3.1, react-dom@^18.3.1, @supabase/supabase-js@^2.45.6, name (+8 more)

### Community 4 - "Community 4"
Cohesion: 0.33
Nodes (6): AssessmentPage(), AuthPage(), ParticleCanvas(), loginUser(), registerUser(), react

### Community 5 - "Community 5"
Cohesion: 0.33
Nodes (6): fetchJakarta7DaysHistory(), fetchJakartaEnvironmentalData(), fetchJson(), http, https, parseEnvNum()

### Community 6 - "Community 6"
Cohesion: 0.43
Nodes (7): cache, decodeHtmlEntities(), FALLBACK_ARTICLES, getArticleDetail(), getIspaNewsList(), pruneCache(), validateNewsUrl()

### Community 8 - "Community 8"
Cohesion: 0.50
Nodes (3): compilerOptions, baseUrl, paths

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@supabase/supabase-js` connect `Community 3` to `Community 2`?**
  _High betweenness centrality (0.211) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.10153846153846154 - nodes in this community are weakly interconnected._
- **Why does `next` connect `Community 3` to `Community 1`, `Community 4`, `Community 7`?**
  _High betweenness centrality (0.133) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.13725490196078433 - nodes in this community are weakly interconnected._
- **Why does `cors` connect `Community 2` to `Community 0`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.13970588235294118 - nodes in this community are weakly interconnected._
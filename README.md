# Lean Impact - savings management & forecasting platform

Lean Impact is an executive dashboard application focused on tracking, visualizing, and forecasting lean project savings (including Kaizen, SGA, and IKW events). The application helps lean managers, administrators, and directors compare approved realized savings and project pipelines against annual savings targets.

The platform is designed to run in a dual mode:
- **Supabase Mode**: Integrates with live Supabase Database, Auth, and Policies when configured.
- **Mock Mode**: Falls back dynamically to browser `localStorage` engine with pre-seeded data, allowing users to test features immediately in the browser.

---

## 🎨 Color Palette & Theme
Lean Impact is styled with an executive light-theme layout (no dark mode supported):
- **Primary Color**: Green (`#22C55E`)
- **Secondary Colors**: Dark Gray (`#1F2937`), Light Gray (`#F3F4F6`), White (`#FFFFFF`)

---

## 🏗️ Architecture & Stack
- **Framework**: React 19 + TypeScript + Vite 8
- **Styling**: Modern, responsive CSS variables, grids, and flexbox (Vanilla CSS)
- **Charts**: Recharts (Monthly Trends, Forecast Progression, Savings Distribution, Functional Areas)
- **File Parsing**: XLSX (Excel reading for Kaizen import sheets, Excel writing for data exports)
- **Image Capture**: html2canvas (PNG exports for executive reports)
- **Database / Auth**: Supabase JS Client

---

## 📊 Database Schema Setup (Supabase)

To link a live database, run the DDL schema script in your Supabase SQL Editor. The file is located in the repository:
📂 [supabase_setup.sql](file:///c:/Users/gdlcastr/Lean%20Impact/supabase_setup.sql)

### Tables Created
1. `savings_targets`: Quarterly savings targets per fiscal year.
2. `projects_approved`: Completed projects with approved savings dates.
3. `projects_open`: Open projects in progress with potential savings estimates.

*Note: In compliance with platform rules, FTE Headcount values are displayed in project details but excluded from monetary summaries (which sum only `op_contribution`, `soft_savings`, `inventory_savings`, and `one_time_savings`).*

---

## ⚙️ Environment Configuration

Create a `.env` file in the project root directory (copied from [`.env.example`](file:///c:/Users/gdlcastr/Lean%20Impact/.env.example)):

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-api-key-here
```

*If these variables are empty, the application automatically boots into a fully functional local Mock Mode.*

---

## 🚀 Local Development Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Run Dev Server**:
   ```bash
   npm run dev
   ```
3. **Verify Production Compilation**:
   ```bash
   npm run build
   ```

---

## 📦 Deployment to GitHub Pages

The project contains a built-in automated deployment script using `gh-pages` and a GitHub Actions workflow.

### Method 1: Manual CLI Deployment
Make sure your package.json homepage is set to your GitHub pages URL:
`"homepage": "https://<your-username>.github.io/<your-repository-name>"`
Then run the deploy command:
```bash
npm run deploy
```
This will compile the application (running `tsc && vite build`) and push the output directory `dist/` directly to your repository's `gh-pages` branch.

### Method 2: Automated GitHub Action CI/CD
A deployment workflow is configured at:
📂 [`.github/workflows/deploy.yml`](file:///c:/Users/gdlcastr/Lean%20Impact/.github/workflows/deploy.yml)

1. Push your code to the `main` branch:
   ```bash
   git add .
   git commit -m "feat: initial commit for Lean Impact"
   git push origin main
   ```
2. The GitHub action will automatically run, compile the project, and publish it to GitHub Pages.
3. In your GitHub repository page: Go to **Settings > Pages** and set the source branch to **`gh-pages`** (folder `/root`).

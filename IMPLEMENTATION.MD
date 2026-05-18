***

# Product Requirement Document: AnchorSpace
## Personal Mindfulness, Weekly Workout Planner & "Work Trance" Breaker

### 1. Executive Summary
AnchorSpace is a high-utility, minimalist Progressive Web App (PWA) designed to bridge the gap between intense professional work and personal well-being. It targets the "work rut" by automating the planning of workouts via a text parser, enforcing periodic mindfulness breaks, and syncing progress across mobile (iPhone) and desktop (Mac) via a cloud database.

### 2. Technology Stack
*   **Frontend:** React (Functional Components, Hooks).
*   **Styling:** Tailwind CSS (Custom Muted/Earthy palette).
*   **Icons:** Lucide React.
*   **Backend/Database:** **Supabase** (PostgreSQL with Auth).
*   **Data Strategy:** Single JSONB column persistence in a `profiles` table for maximum flexibility and cross-device syncing.
*   **Architecture:** PWA (Mobile-first, but responsive for Mac/Desktop).

---

### 3. Core Functional Modules

#### A. The "Daily Anchors" Dashboard & Sync
*   **Four Core Anchors:** Workout (dynamic), Read (timed), Meditate (timed), and Mindful Check-in (mood slider).
*   **Supabase Integration:** On load, the app fetches the user state from Supabase. Any toggle change triggers an immediate background "upsert" to ensure your Mac and iPhone stay in perfect sync.
*   **The "I'm Stuck" Button (Emergency Protocol):** A prominent but minimalist button for moments of high stress or paralysis. Clicking this overrides all schedules and presents a single "Micro-Win" (e.g., "Step outside for 2 mins" or "Drink a glass of water").

#### B. The "Smart Workout" Parser
*   **Input:** A raw text area where users paste routines (e.g., "3x12 Squats; 4 sets Bench Press; 5km Run").
*   **Parser Logic:** Use Regex to identify sets, reps, and exercises. Convert them into an interactive checklist.
*   **Starter Templates:** Include a dropdown of 3 pre-set text routines (Quick Home, Beginner Gym, Mobility Stretch) to eliminate decision fatigue.
*   **Rest Day Logic:** A toggle that turns the dashboard workout card into a "Rest & Recovery" state, graying it out with a calming message.

#### C. The "Work Trance" Breaker (Mac/Desktop Focus)
*   **Background Timer:** A configurable 60/90-minute timer.
*   **Modal Interception:** A full-screen, soft-fade overlay that dims the work environment.
*   **Content:** A visual breathing pacer (SVG circle expansion) and a grounding prompt (e.g., "Identify 3 blue objects in your room").
*   **Mac Notifications:** Integrated browser notifications to nudge the user if the tab is in the background.

#### D. The "Shutdown Ritual"
*   **Trigger:** A manual button to end the workday.
*   **Sequence:** 
    1. Log one "Success of the Day."
    2. Preview tomorrow's workout.
    3. Transition the UI to "Evening Mode" (further desaturated colors).
*   **Purpose:** To psychologically sever the connection to work tasks.

---

### 4. Database Schema (Supabase)
The app requires a single table: `profiles`.
*   `id`: uuid (references auth.users)
*   `updated_at`: timestamp
*   `app_state`: JSONB (Stores the entire user object: weekly plans, daily logs, settings).

---

### 5. UI/UX Design System (Muted/Earthy)
*   **Theme:** "Mineral & Sage"
    *   Background: `#F4F6F4` (Light) / `#1A1F1C` (Dark).
    *   Surface Cards: `#FFFFFF` / `#232A26`.
    *   Accent Active: `#8F9E8B` (Sage).
    *   Accent Neutral: `#D1D7D3` (Mineral Gray).
*   **Consistency Grid:** A 28-day history view. No "streaks." Just circles that fill with higher opacity sage green based on how many anchors were completed. Empty days are just soft outlines—no "red" for missed days.

---

### 6. Implementation Instructions for Claude

**Direct Instruction to Claude:**
> Please build "AnchorSpace" as a complete, single-file React application using Tailwind CSS and Lucide Icons. 
> 
> **Specific Coding Requirements:**
> 1. **Auth & Sync:** Implement Supabase Auth (Sign-in/Sign-up) and use a `useEffect` hook to sync the `app_state` JSON object to the `profiles` table. Handle the "loading" and "unauthenticated" states gracefully with a minimalist login screen.
> 2. **State Management:** Use a single `useState` object for the entire application state to make Supabase syncing seamless.
> 3. **The Parser:** Write a robust JavaScript function to parse raw text lines like "3x10 Pushups" or "Bench Press - 3 sets" into a checklist array.
> 4. **PWA Assets:** Include the `manifest.json` and `service-worker.js` code blocks at the end of your response so I can make this a standalone app on my Mac and iPhone.
> 5. **Micro-Interactions:** Ensure the "Work Trance" overlay uses a smooth CSS transition for the breathing pacer.
> 6. **Templates:** Hardcode 3 starter workout templates into the planning modal.
>
> **Configuration Placeholders:** Use `process.env.REACT_APP_SUPABASE_URL` and `process.env.REACT_APP_SUPABASE_ANON_KEY` for the database connection.

---

### 7. Post-Build Setup for User
1. **Supabase Setup:**
   * Create a free project at [Supabase.com](https://supabase.com).
   * In the SQL Editor, run: 
     ```sql
     create table profiles (
       id uuid references auth.users not null primary key,
       updated_at timestamp with time zone,
       app_state jsonb
     );
     alter table profiles enable row level security;
     create policy "Users can update own profile." on profiles for update using (auth.uid() = id);
     create policy "Users can view own profile." on profiles for select using (auth.uid() = id);
     ```
2. **Deployment:** Paste Claude's code into a tool like Vercel, Netlify, or Replit to get your private URL.
3. **Install:** Open the URL on your iPhone (Add to Home Screen) and your Mac (Install App via Chrome/Safari).
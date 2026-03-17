# 🎓 Thesis Coordination Tracker

An elegant dashboard for tracking thesis milestones, sending emails to students and supervisors, and managing the entire thesis coordination process.

**Live on GitHub Pages · Supabase database · EmailJS for sending · Zero monthly cost**

---

## ✨ Features

- **7 thesis milestones**: ORCID, Proposal Defense, IRB Approval, Progress Reports (×2), Defense Scheduling, Thesis Submission
- **Email Center**: Send individual or bulk emails using pre-built templates
- **Response links**: Every email includes a unique link — when a student clicks it, their milestone is marked complete automatically
- **Reminders**: Manual per-student reminders + bulk reminder blasts by milestone
- **Real-time sync**: All data lives in Supabase, updates instantly
- **Supervisor management**: Assign supervisors, notify them with one click
- **Email history log**: See every email sent, to whom, and when

---

## 🚀 Deploy in 15 Minutes

### Step 1 — Set up Supabase (5 min)

1. Go to [supabase.com](https://supabase.com) → Create new project (free)
2. Wait for it to initialize (~1 min)
3. Go to **SQL Editor** → **New query**
4. Paste the entire contents of `supabase/schema.sql` → **Run**
5. Go to **Project Settings** → **API**
6. Copy your **Project URL** and **anon public key** — you'll need these

### Step 2 — Set up EmailJS (5 min)

1. Go to [emailjs.com](https://emailjs.com) → Sign up (free — 200 emails/month)
2. **Add Email Service**: Connect your Gmail account
3. **Create 3 Email Templates**:

   **Template 1 — Student notification** (`template_student`):
   ```
   Subject: {{subject}}
   
   Dear {{to_name}},
   
   {{message}}
   
   {{response_link}}
   ```

   **Template 2 — Supervisor notification** (`template_supervisor`):
   ```
   Subject: {{subject}}
   
   Dear {{to_name}},
   
   Re: Student {{student_name}}
   
   {{message}}
   ```

   **Template 3 — Reminder** (`template_reminder`):
   ```
   Subject: Reminder: {{milestone}} — Action Required
   
   Dear {{to_name}},
   
   This is a reminder that your milestone "{{milestone}}" is pending.
   Due: {{due_date}}
   
   Please confirm via this link: {{response_link}}
   ```

4. Note each template's **Template ID**, your **Service ID**, and your **Public Key**

### Step 3 — Deploy to GitHub (5 min)

1. Create a new GitHub repo named `thesis-tracker`
2. Go to repo **Settings → Secrets and variables → Actions** → add these secrets:

   | Secret name | Where to find it |
   |---|---|
   | `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
   | `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key |
   | `VITE_EMAILJS_PUBLIC_KEY` | EmailJS → Account → Public Key |
   | `VITE_EMAILJS_SERVICE_ID` | EmailJS → Email Services → your service ID |
   | `VITE_EMAILJS_STUDENT_TEMPLATE` | EmailJS → Template ID of student template |
   | `VITE_EMAILJS_SUPERVISOR_TEMPLATE` | EmailJS → Template ID of supervisor template |
   | `VITE_EMAILJS_REMINDER_TEMPLATE` | EmailJS → Template ID of reminder template |
   | `VITE_APP_URL` | `https://YOUR_GITHUB_USERNAME.github.io/thesis-tracker` |

3. Push this code to your repo:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/thesis-tracker.git
   git push -u origin main
   ```

4. GitHub Actions will automatically build and deploy
5. Go to repo **Settings → Pages** → Source: **gh-pages branch** → Save
6. Your app is live at `https://YOUR_USERNAME.github.io/thesis-tracker` 🎉

---

## 🖥 Running Locally

```bash
cp .env.example .env
# Fill in your keys in .env

npm install
npm run dev
```

---

## 📁 Project Structure

```
thesis-tracker/
├── src/
│   ├── lib/
│   │   ├── supabase.js          # DB client + all data helpers
│   │   ├── emailService.js      # EmailJS sender
│   │   └── emailTemplates.js    # Pre-written email templates
│   ├── components/
│   │   ├── Sidebar.jsx
│   │   ├── MilestoneProgress.jsx
│   │   ├── EmailModal.jsx
│   │   └── AddStudentModal.jsx
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Students.jsx
│   │   ├── StudentDetail.jsx
│   │   ├── EmailCenter.jsx
│   │   ├── Reminders.jsx
│   │   ├── Settings.jsx
│   │   └── Respond.jsx          # Public page for student email links
│   └── App.jsx
├── supabase/
│   └── schema.sql               # Run this in Supabase SQL editor
├── .github/workflows/
│   └── deploy.yml               # Auto-deploy on push to main
└── .env.example
```

---

## 🔗 How Response Links Work

1. You send an email to a student with a milestone attached
2. The email contains a unique link like: `https://yourapp.github.io/thesis-tracker/#/respond?t=TOKEN&m=MILESTONE_ID`
3. Student clicks the link → the `Respond` page opens
4. Supabase looks up the student by their secret token, marks the milestone complete
5. Dashboard updates automatically on next refresh

Each student has a unique `token` (UUID) stored in Supabase — changing it would invalidate old links.

---

## 🛡 Security Note

This app uses Supabase's `anon` key with open Row Level Security policies — appropriate for a small coordinator-only deployment. For a larger or public-facing deployment, add Supabase Auth and restrict RLS policies to authenticated users.

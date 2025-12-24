# trackifyr - Project Summary

## Project Overview
**trackifyr** - Cognitive Load Estimation via Natural Activity Monitoring. Part of the **trackifyr-Cognitive_Load_Management_via_NAM** project. A **FRONTEND-ONLY** Next.js web application for a Final Year Project. This is a research-oriented platform with no backend, database, or API calls - using only dummy/static data.

## Tech Stack
- **Framework**: Next.js 16.1.0 with App Router
- **Styling**: Tailwind CSS v4 (using `@tailwindcss/postcss`)
- **Charts**: Recharts library
- **State Management**: React useState / Context API
- **Routing**: Next.js App Router (not Pages Router)
- **Authentication**: Fake authentication using localStorage

## Project Structure
```
trackifyr-web/
├── app/                          # Next.js App Router
│   ├── layout.jsx                # Root layout with Providers
│   ├── page.jsx                  # Home page (redirects)
│   ├── globals.css               # Global Tailwind styles (@import "tailwindcss")
│   ├── signup/
│   │   └── page.jsx             # Signup page
│   ├── signin/
│   │   └── page.jsx             # Signin page
│   ├── dashboard/
│   │   └── page.jsx             # Main dashboard
│   ├── reports/
│   │   └── page.jsx             # Reports & Analytics
│   └── profile/
│       └── page.jsx             # User profile
├── components/                    # Reusable components
│   ├── Providers.jsx            # Client component wrapper for AuthProvider
│   ├── Sidebar.jsx              # Navigation sidebar
│   ├── CognitiveLoadCard.jsx    # Cognitive load status card
│   ├── CognitiveLoadCharts.jsx  # Recharts visualizations
│   ├── SessionLogsTable.jsx    # Session logs table
│   └── FeedbackPanel.jsx        # Feedback messages
├── context/
│   └── AuthContext.jsx          # Authentication context (fake auth with localStorage)
├── data/
│   └── cognitiveLoadData.js     # Dummy data for cognitive load
├── next.config.js                # Next.js configuration (ES module format)
├── tailwind.config.js            # Tailwind CSS configuration
├── postcss.config.js             # PostCSS configuration (uses @tailwindcss/postcss)
└── jsconfig.json                 # Path aliases (@/*)
```

## Application Flow

### 1. SIGN UP PAGE
- **Fields**: Full Name, Email, Password, Role (Student/Teacher)
- **Client-side validation**: Required fields, email format validation
- **Design**: 
  - Centered card-based layout with soft shadows (`shadow-lg`) and rounded corners (`rounded-2xl`)
  - Subtle light gradient background (`from-blue-50 via-white to-gray-50`)
  - Project branding header at top of card with title and subtitle
  - Icons inside input fields (user, email, lock, users icons)
  - Smooth hover and focus effects with `transition-all duration-200`
  - Fade-in and slide-up animation on page load (700ms duration)
  - Clean academic color palette (blue, gray, green accents)
- **On submit**: Redirects to Sign In page

### 2. SIGN IN PAGE
- **Fields**: Email and Password
- **Fake authentication**: Uses localStorage to check credentials
- **Design**: Same design system as Signup page
- **On login**: Redirects to Dashboard

### 3. DASHBOARD (Main Focus)
**Components:**
- **Cognitive Load Status Card**: 
  - Shows Low/Medium/High with color-coded badges (Green, Yellow, Red)
  - Progress bars for load level and engagement
  - Real-time monitoring indicator
  
- **Quick Stats Cards** (4 cards):
  - Average Load (with trend indicator)
  - Avg Engagement (with trend indicator)
  - Total Sessions
  - Active Monitoring (Live status)

- **Analytics Section**:
  - Line chart (Area chart) showing cognitive load over time using Recharts
  - Bar chart for daily engagement analysis
  - Uses dummy data from `cognitiveLoadData.js`

- **Session Logs Table**:
  - Columns: Time, Cognitive Load Level, Engagement State, Duration
  - Color-coded badges for load levels and engagement states
  - Hover effects on rows

- **Feedback Panel**:
  - AI-powered recommendations
  - Messages like "You seem overloaded, consider taking a break" and "You appear disengaged, try refocusing"
  - Color-coded by type (warning, info, success)

**Design Features:**
- Compact header with minimal top spacing
- Sidebar navigation (Dashboard, Reports, Profile, Logout)
- Glass-morphism effects (`bg-white/80 backdrop-blur-sm`)
- Responsive grid layouts
- Smooth transitions and hover effects

### 4. REPORTS PAGE
- Statistics cards
- Charts visualization
- Analytics overview

### 5. PROFILE PAGE
- View and edit profile information
- Account management
- User statistics

## Design Requirements

### UI/UX Standards:
- **Clean and modern academic UI**
- **Responsive design** (desktop + mobile)
- **Sidebar navigation** with: Dashboard, Reports, Profile, Logout
- **Color palette**: Blue (primary), Gray (neutral), Green (success), Red (errors), Yellow (warnings)
- **Shadows**: Soft shadows (`shadow-lg`, `shadow-md`)
- **Rounded corners**: `rounded-2xl`, `rounded-lg`, `rounded-xl`
- **Transitions**: `transition-all duration-200` for smooth interactions
- **Animations**: Minimal - fade-in/slide-up on page load (700ms)

### Key Design Patterns:
- Centered card layouts for auth pages
- Project branding header on cards
- Icons inside input fields
- Gradient backgrounds (`from-blue-50 via-white to-gray-50`)
- Glass-morphism effects on dashboard components
- Color-coded status indicators
- Hover effects with subtle lift (`hover:-translate-y-0.5`)

## Dummy Data Structure

Located in `data/cognitiveLoadData.js`:
- `cognitiveLoadTimeSeries`: Array of {time, load, engagement} objects
- `dailyEngagementData`: Array of {day, engagement, sessions} objects
- `sessionLogs`: Array of {id, time, cognitiveLoad, engagement, duration} objects
- `currentCognitiveLoad`: {level, value, engagement, timestamp}
- `feedbackMessages`: Array of {id, type, message, timestamp} objects

## Authentication System

**Fake Authentication** using `AuthContext`:
- `signup(userData)`: Stores user in localStorage
- `signin(email, password)`: Checks localStorage for matching email
- `signout()`: Clears localStorage
- `user` and `isAuthenticated` state
- Protected routes redirect to `/signin` if not authenticated
- Public routes redirect to `/dashboard` if already authenticated

## Configuration Files

### next.config.js
```javascript
export default {
  reactStrictMode: true,
}
```

### tailwind.config.js
```javascript
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: { extend: {} },
  plugins: [],
}
```

### postcss.config.js
```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
```

### jsconfig.json
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

## Current State

✅ **Completed:**
- Next.js App Router structure
- Tailwind CSS v4 setup with PostCSS
- Authentication context with fake auth
- Signup and Signin pages with enhanced UI
- Dashboard with all components
- Reports and Profile pages
- Sidebar navigation
- Recharts integration
- Dummy data files
- Responsive design
- Smooth animations and transitions

## Important Notes

1. **No backend/API**: All data is static/dummy
2. **No database**: Uses localStorage for fake authentication
3. **Next.js App Router**: Uses `app/` directory, NOT `pages/` directory
4. **Tailwind v4**: Uses `@import "tailwindcss"` in CSS, not `@tailwind` directives
5. **All components are client components**: Use `'use client'` directive
6. **Path aliases**: Use `@/` prefix for imports (configured in jsconfig.json)
7. **Package scripts**: `npm run dev` (Next.js), not Vite

## Running the Application

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Design Philosophy

The UI is designed to look professional and research-oriented, as if it will later be connected to a real AI model and backend. The design emphasizes:
- Academic/professional aesthetic
- Clean, modern interface
- Data-rich dashboard
- Minimal distractions
- Smooth user experience
- Responsive across all devices


# trackifyr

**trackifyr** - Cognitive Load Estimation via Natural Activity Monitoring

A Next.js web application for monitoring and analyzing cognitive load through natural activity monitoring.

## Getting Started

### Installation

```bash
npm install
```

### PostgreSQL (local sign-in)

You need a running Postgres server and **`DATABASE_URL`** in a **`.env`** file (copy from **`.env.example`**). On Windows, if PostgreSQL is already installed, create the `trackifyr` database:

```powershell
$env:PGPASSWORD = 'password you chose when installing PostgreSQL'
.\scripts\windows-create-db.ps1
```

Then put the same password into **`.env`** as `postgresql://postgres:YOUR_PASSWORD@localhost:5432/trackifyr`, run **`npm run dev`**, and register at **`/signup`**.

### Development

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Python (desktop tracking / Electron)

The desktop app runs **`py -3`** (Windows) or **`python3`** (Unix) to execute `activity_tracker.py` and `webcam_cognitive_load.py`. Install the same packages into that interpreter:

- **Python 3.10+** recommended (matches most `py -3` installs).

```bash
cd trackifyr
py -3 -m pip install -r requirements.txt
```

On Windows you can instead run **`scripts\setup_tracking_env.bat`**. On macOS/Linux: **`chmod +x scripts/setup_tracking_env.sh`** then **`./scripts/setup_tracking_env.sh`**.

To force a specific interpreter (for example a venv), set **`TRACKIFYR_PYTHON`** to the full path of `python.exe` / `python` before starting Electron.

### Build

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

## Tech Stack

- **Framework**: Next.js 16.1.0 with App Router
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts library
- **State Management**: React Context API

## Project Structure

- `app/` - Next.js App Router pages
- `components/` - Reusable React components
- `context/` - React Context providers
- `data/` - Static/dummy data files

## Features

- User authentication (localStorage-based)
- Cognitive load monitoring dashboard
- Real-time analytics and charts
- Session logs and reports
- User profile management

For more details, see [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)

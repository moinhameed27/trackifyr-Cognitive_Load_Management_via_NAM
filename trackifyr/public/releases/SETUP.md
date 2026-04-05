# Trackifyr desktop — local setup

## Installer

1. Download **trackifyr-desktop-setup.exe** (or unzip **trackifyr-desktop.zip** and run the `.exe` inside).
2. Install and open **Trackifyr**. Sign in with the **same email and password** as the website (`https://trackifyr-app.vercel.app`).

## Python (required for activity + webcam cognitive load)

The app runs **`py -3`** on Windows (or **`python3`** on macOS/Linux) to start the tracking scripts bundled with the app.

1. Install **Python 3.10+**.
2. From the **`trackifyr`** folder in this repo (or use the paths below if you only have the desktop app), install dependencies:

   ```bash
   py -3 -m pip install -r requirements.txt
   ```

   On Windows you can run **`scripts\setup_tracking_env.bat`** from the repo instead.

3. Optional: set **`TRACKIFYR_PYTHON`** to the full path of your `python.exe` if the app should not use the default `py -3`.

## Models

The installer bundles **DAiSEE** model assets under **`resources/python-tracking/artifacts/daisee/`**. If tracking fails to start, confirm that folder exists next to the installed app (inside `resources`).

## Firewall / VPN

If sign-in shows “Could not reach the server”, check that **https://trackifyr-app.vercel.app** is reachable from your PC (no corporate block on that host).

## More help

- Web: **Tracking setup** page on the site (loads this file).
- Repo: **README.md** — PostgreSQL, Next.js, and full dev setup.

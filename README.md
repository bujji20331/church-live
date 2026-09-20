# Church Live

A simple, responsive web application designed to help church volunteers manage Sunday and church-service livestreams. This is a clean, minimal-dependency platform designed to run as a static website on GitHub Pages and integrate with Supabase, OBS Studio, and YouTube Live.

## Project Structure

```
church-live/
│
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
│
├── docs/
│   ├── ARCHITECTURE.md
│   └── IMPLEMENTATION_PLAN.md
│
├── README.md
├── .gitignore
└── .env.example
```

## Features (Phase 1)
- **Responsive Dashboard**: Beautiful, clean UI that works perfectly on laptops, desktops, tablets, and phones.
- **System Status Board**: Real-time status indicators (Camera, Audio, Internet, Encoder, YouTube) with a toggleable checklist interface for easy pre-service validation.
- **Service Form**: Section to specify today's service title, description, and scheduled time.
- **Action Dashboard**: A prominent "Prepare Livestream" button that guides the user through the live stream readiness sequence.
- **Recent Services Log**: Interactive table displaying previous services, their status, and archived YouTube links.
- **Fully Documented**: Solid foundation including architecture diagrams and step-by-step phased implementation plans.

## Running Locally

1. Open the project folder in VS Code.
2. If you have the "Live Server" extension, click **Go Live** in the status bar.
3. Alternatively, you can open `church-live/index.html` directly in any web browser.
4. Or, start a quick local server using Python (run this from the `church-live` directory):
   ```bash
   python3 -m http.server 8080
   ```
   Then open `http://localhost:8080` in your web browser.

## Publishing to GitHub Pages

1. Push this `church-live` directory to a new GitHub repository.
2. In your repository on GitHub, go to **Settings** > **Pages**.
3. Under **Build and deployment** > **Source**, select **Deploy from a branch**.
4. Select your branch (usually `main` or `master`) and folder (usually `/` or root), and click **Save**.
5. Your Church Live app will be live at `https://<your-username>.github.io/<your-repo-name>/`.

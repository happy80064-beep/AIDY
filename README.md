<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AIDY

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1-02PcD0Z0HF5U3SaBHj-xxMO3i6-WvYW

## Backend Setup (New!)

To support domestic models (DeepSeek, Qwen, etc.) and secure API keys, a backend server is now required.

1. Navigate to `server` directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure `.env`:
   - Open `server/.env`
   - Add your API keys (e.g., `DEEPSEEK_API_KEY`, `QWEN_API_KEY`)
4. Start the server:
   ```bash
   npm start
   ```

## Run Frontend

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) (Only if using direct Gemini mode, otherwise backend handles it)
3. Run the app:
   `npm run dev`

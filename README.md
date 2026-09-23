# Remind Me ⏰

A lightweight, AI-powered task and scheduling application designed to help you keep track of daily goals. Speak your reminders into existence and get notified directly where you already chat—on Telegram.

## ✨ Features

* **Voice-Activated Scheduling:** Just speak your tasks. Integrated with the **Google Gemini API** to process natural language voice inputs and automatically extract task details, dates, and times.
* **Telegram Bot Notifications:** Receive timely, reliable alerts directly through your custom Telegram Bot, replacing the need for easily missed browser notifications.
* **Create & Manage Reminders:** Easily add, edit, and delete your tasks via an intuitive web interface.
* **Custom Scheduling:** Set precise dates, times, and recurring schedules for your events.
* **Categorization:** Group reminders by tags (e.g., Work, Personal, Health) to keep your workspace organized.
* **Responsive Design:** Works seamlessly across desktop, tablet, and mobile devices.

## 🛠️ Tech Stack

* **Frontend:** React.js 
* **Backend:** Python (FastAPI / Flask)
* **Database:** MongoDB
* **Styling:** Tailwind CSS
* **Integrations:** Google Gemini API (for voice NLP), Telegram Bot API

## 🚀 Getting Started

### Prerequisites
* Node.js & npm
* Python 3.x
* MongoDB instance (local or Atlas)
* Telegram Bot Token (obtained via BotFather on Telegram)
* Google Gemini API Key

### Setup Environment Variables
Create a `.env` file in your backend directory and configure your keys:

```env
MONGO_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_gemini_api_key_here
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

### Installation

**1. Clone the repository:**
```bash
git clone [https://github.com/yourusername/remind-me.git](https://github.com/yourusername/remind-me.git)
cd remind-me
2. Setup the Backend:
cd backend
pip install -r requirements.txt
python app.py
Markdown
### Installation

**1. Clone the repository:**
```bash
git clone [https://github.com/yourusername/remind-me.git](https://github.com/yourusername/remind-me.git)
cd remind-me
**2. Setup the Backend:**

Bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
**3. Setup the Frontend:**
cd frontend
npm install
npm start

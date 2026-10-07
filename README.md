```markdown
# GetRemindMe

**Developed by:** Ricky Panu

## Overview
GetRemindMe is a full-stack, student-focused web application designed to make task management and automated scheduling effortless. It features a Progressive Web App (PWA) frontend built with React and Vite, powered by a robust Python FastAPI backend. By leveraging the Google Gemini API, the app parses natural language to automatically schedule tasks and delivers timely reminders via Web Push notifications and Telegram Bot integration.

## Features
* **Natural Language Parsing:** Input tasks conversationally, and the Gemini API automatically extracts the task details and scheduling intent.
* **Multi-Channel Notifications:** Receive reliable, automated task reminders via Telegram and Web Push notifications.
* **Progressive Web App (PWA):** Fully installable on desktop and mobile devices with offline support via Workbox service workers.
* **Modern Tech Stack:** Lightning-fast frontend tooling with Vite and high-performance asynchronous backend processing with FastAPI.

## Tech Stack
**Frontend (Client)**
* React.js
* Vite
* PWA (Workbox / Service Workers)
* Oxlint (Linting)

**Backend (Server)**
* Python
* FastAPI
* MongoDB
* Google Gemini API
* Telegram Bot API

## Prerequisites
* [Node.js](https://nodejs.org/) (v16 or higher recommended)
* [Python](https://www.python.org/downloads/) (v3.8 or higher)
* MongoDB database (local or Atlas)
* Google Gemini API Key
* Telegram Bot Token

## Getting Started

### 1. Backend Setup
Navigate to the backend directory and set up your Python environment:

```bash
# Navigate to the backend folder 
cd server

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

```

Create a `.env` file in the backend directory and add your environment variables:

```env
MONGO_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_gemini_api_key
TELEGRAM_BOT_TOKEN=your_telegram_token

```

Start the FastAPI development server:

```bash
uvicorn main:app --reload

```

*The backend will typically run on `http://localhost:8000`.*

### 2. Frontend Setup

Open a new terminal, navigate to the client directory, and start the Vite development server:

```bash
# Navigate to the frontend folder
cd remindme/client

# Install dependencies
npm install

# Start the development server
npm run dev

```

*The frontend will typically run on `http://localhost:5173`.*

## Build for Production

To build the frontend for production (which generates the service workers and minified assets):

```bash
cd remindme/client
npm run build

```

The optimized PWA files will be output to the `remindme/client/dist/` directory.

## License

This project is proprietary and developed by Ricky Panu.

```

```
# Spatial Awareness Agent

A real-time spatial awareness agent built with the Gemini Live API. It uses your device’s camera and microphone to act as a proactive "third eye" — describing surroundings, detecting scene changes, identifying people and obstacles, and delivering feedback through voice output.

Built for the [Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/).

## Features

- Real-time camera feed analysis via Gemini Live API
- Voice output describing surroundings, obstacles, people, and gestures
- Client-side pixel-diff scene change detection — automatically alerts when the environment changes
- Works with both voice and text input (text messages include the current camera frame for grounded responses)
- Safety-first priority — hazards are announced immediately

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- A Gemini API key

### 1. Clone the repository

```bash
git clone https://github.com/Aditya1234M/Spatial-Awareness-Agent.git
cd Spatial-Awareness-Agent
```

### 2. Get a Gemini API key

Go to [Google AI Studio](https://aistudio.google.com/apikey) and create a free API key.

### 3. Create a `.env` file

Create a `.env` file in the project root:

```
REACT_APP_GEMINI_API_KEY=your_api_key_here
```

Replace `your_api_key_here` with your actual Gemini API key.

### 4. Install dependencies and run

```bash
npm install
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000).

### 5. Usage

1. Click the play button to connect to the Gemini Live API.
2. Click the webcam button to enable your camera.
3. Click the microphone button to let the agent access your mic.
4. Speak or type to ask the agent what it sees.
5. The agent will automatically announce scene changes when it detects them.

## Architecture

- **Frontend:** React with TypeScript
- **API:** Gemini Live API via `@google/genai` SDK over WebSocket
- **Audio:** 16kHz PCM recording, 24kHz playback via Web Audio API
- **Video:** Camera frames captured at 3fps, sent as JPEG via `sendRealtimeInput`
- **Scene Detection:** Client-side pixel-diff algorithm on a downscaled 80x45 canvas, triggers model nudge when mean pixel difference exceeds threshold (with 8s cooldown)

## Available Scripts

### `npm start`

Runs the app in development mode at [http://localhost:3000](http://localhost:3000).

### `npm run build`

Builds the app for production to the `build` folder.

/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useRef, useState } from "react";
import "./App.scss";
import { LiveAPIProvider } from "./contexts/LiveAPIContext";
import SidePanel from "./components/side-panel/SidePanel";
import { Altair } from "./components/altair/Altair";
import ControlTray from "./components/control-tray/ControlTray";
import cn from "classnames";
import { LiveClientOptions } from "./types";
import { useLiveAPIContext } from "./contexts/LiveAPIContext";

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY || "";

const apiOptions: LiveClientOptions = {
  apiKey: API_KEY,
};

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "hi", label: "Hindi" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
  { code: "ar", label: "Arabic" },
  { code: "pt", label: "Portuguese" },
  { code: "ko", label: "Korean" },
];

function AppContent() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [language, setLanguage] = useState("en");
  const { connected } = useLiveAPIContext();

  return (
    <div className="streaming-console">
      <SidePanel videoRef={videoRef} />
      <main>
        <header className="iris-header">
          <div className="iris-header-left">
            <div className={cn("status-dot", { active: connected })} />
            <span className="status-text">
              {connected ? "Connected" : "Disconnected"}
            </span>
            {videoStream && (
              <>
                <div className="status-dot camera-dot active" />
                <span className="status-text">Camera</span>
              </>
            )}
          </div>
          <div className="iris-header-right">
            <span className="iris-slogan">Your third eye, always watching</span>
            <span className="iris-brand">iris</span>
          </div>
        </header>

        <div className="main-app-area">
          <Altair language={language} />
          <video
            className={cn("stream", {
              hidden: !videoRef.current || !videoStream,
            })}
            ref={videoRef}
            autoPlay
            playsInline
          />
          {!videoStream && (
            <div className="no-camera-placeholder">
              <span className="material-symbols-outlined filled placeholder-icon">
                visibility
              </span>
              <p>Enable camera to start</p>
            </div>
          )}
        </div>

        <ControlTray
          videoRef={videoRef}
          supportsVideo={true}
          onVideoStreamChange={setVideoStream}
          enableEditingSettings={false}
        >
          <div className="language-selector">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="language-dropdown"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
        </ControlTray>
      </main>
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <LiveAPIProvider options={apiOptions}>
        <AppContent />
      </LiveAPIProvider>
    </div>
  );
}

export default App;

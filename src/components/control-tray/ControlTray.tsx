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

import cn from "classnames";

import { memo, ReactNode, RefObject, useEffect, useRef, useState, useCallback } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { UseMediaStreamResult } from "../../hooks/use-media-stream-mux";
import { useScreenCapture } from "../../hooks/use-screen-capture";
import { useWebcam } from "../../hooks/use-webcam";
import { AudioRecorder } from "../../lib/audio-recorder";
import AudioPulse from "../audio-pulse/AudioPulse";
import "./control-tray.scss";
import SettingsDialog from "../settings-dialog/SettingsDialog";

export type ControlTrayProps = {
  videoRef: RefObject<HTMLVideoElement>;
  children?: ReactNode;
  supportsVideo: boolean;
  onVideoStreamChange?: (stream: MediaStream | null) => void;
  enableEditingSettings?: boolean;
};

type MediaStreamButtonProps = {
  isStreaming: boolean;
  onIcon: string;
  offIcon: string;
  start: () => Promise<any>;
  stop: () => any;
};

/**
 * button used for triggering webcam or screen-capture
 */
const MediaStreamButton = memo(
  ({ isStreaming, onIcon, offIcon, start, stop }: MediaStreamButtonProps) =>
    isStreaming ? (
      <button className="action-button" onClick={stop}>
        <span className="material-symbols-outlined">{onIcon}</span>
      </button>
    ) : (
      <button className="action-button" onClick={start}>
        <span className="material-symbols-outlined">{offIcon}</span>
      </button>
    )
);

function ControlTray({
  videoRef,
  children,
  onVideoStreamChange = () => {},
  supportsVideo,
  enableEditingSettings,
}: ControlTrayProps) {
  const videoStreams = [useWebcam(), useScreenCapture()];
  const [activeVideoStream, setActiveVideoStream] =
    useState<MediaStream | null>(null);
  const [webcam, screenCapture] = videoStreams;
  const [inVolume, setInVolume] = useState(0);
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [muted, setMuted] = useState(false);
  const renderCanvasRef = useRef<HTMLCanvasElement>(null);
  const diffCanvasRef = useRef<HTMLCanvasElement>(null);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const lastNudgeTimeRef = useRef<number>(0);
  const connectButtonRef = useRef<HTMLButtonElement>(null);

  // Dimensions for the lightweight diff canvas
  const DIFF_W = 80;
  const DIFF_H = 45;
  // Mean pixel difference threshold (0-255). ~20 filters sensor noise but catches real changes.
  const DIFF_THRESHOLD = 20;
  // Minimum seconds between nudges so we don't spam the model
  const NUDGE_COOLDOWN_MS = 8000;

  const { client, connected, connect, disconnect, volume } =
    useLiveAPIContext();

  useEffect(() => {
    if (!connected && connectButtonRef.current) {
      connectButtonRef.current.focus();
    }
  }, [connected]);
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--volume",
      `${Math.max(5, Math.min(inVolume * 200, 8))}px`
    );
  }, [inVolume]);

  useEffect(() => {
    const onData = (base64: string) => {
      client.sendRealtimeInput([
        {
          mimeType: "audio/pcm;rate=16000",
          data: base64,
        },
      ]);
    };
    if (connected && !muted && audioRecorder) {
      audioRecorder.on("data", onData).on("volume", setInVolume).start();
    } else {
      audioRecorder.stop();
    }
    return () => {
      audioRecorder.off("data", onData).off("volume", setInVolume);
    };
  }, [connected, client, muted, audioRecorder]);

  // Capture a frame from the video element as a base64 JPEG
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = renderCanvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return null;

    const ctx = canvas.getContext("2d")!;
    canvas.width = video.videoWidth * 0.5;
    canvas.height = video.videoHeight * 0.5;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL("image/jpeg", 0.8);
    return base64.slice(base64.indexOf(",") + 1);
  }, [videoRef, renderCanvasRef]);

  // Compare current frame to previous using a tiny grayscale canvas.
  // Returns a difference score 0-255 (mean absolute pixel difference).
  const computeFrameDiff = useCallback(() => {
    const video = videoRef.current;
    const diffCanvas = diffCanvasRef.current;
    if (!video || !diffCanvas || video.videoWidth === 0) return 0;

    const ctx = diffCanvas.getContext("2d", { willReadFrequently: true })!;
    diffCanvas.width = DIFF_W;
    diffCanvas.height = DIFF_H;
    ctx.drawImage(video, 0, 0, DIFF_W, DIFF_H);

    const imageData = ctx.getImageData(0, 0, DIFF_W, DIFF_H);
    const currentPixels = imageData.data; // RGBA flat array

    const prev = prevFrameDataRef.current;
    if (!prev) {
      // First frame — store and report no diff
      prevFrameDataRef.current = new Uint8ClampedArray(currentPixels);
      return 0;
    }

    // Compute mean absolute difference over grayscale values
    let totalDiff = 0;
    const pixelCount = DIFF_W * DIFF_H;
    for (let i = 0; i < currentPixels.length; i += 4) {
      const grayNow = (currentPixels[i] + currentPixels[i + 1] + currentPixels[i + 2]) / 3;
      const grayPrev = (prev[i] + prev[i + 1] + prev[i + 2]) / 3;
      totalDiff += Math.abs(grayNow - grayPrev);
    }

    // Store current frame for next comparison
    prevFrameDataRef.current = new Uint8ClampedArray(currentPixels);

    return totalDiff / pixelCount;
  }, [videoRef]);

  // Send video frames to the API at ~3fps, with change detection
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = activeVideoStream;
    }

    let timeoutId = -1;

    function sendVideoFrame() {
      const data = captureFrame();
      if (data) {
        client.sendRealtimeInput([{ mimeType: "image/jpeg", data }]);

        // Check for significant scene change
        const diff = computeFrameDiff();
        const now = Date.now();
        if (diff > DIFF_THRESHOLD && now - lastNudgeTimeRef.current > NUDGE_COOLDOWN_MS) {
          lastNudgeTimeRef.current = now;
          client.send(
            [{ text: "The scene just changed. Briefly describe what you see now." }],
            true
          );
        }
      }
      if (connected) {
        timeoutId = window.setTimeout(sendVideoFrame, 1000 / 3);
      }
    }
    if (connected && activeVideoStream !== null) {
      requestAnimationFrame(sendVideoFrame);
    }
    return () => {
      clearTimeout(timeoutId);
    };
  }, [connected, activeVideoStream, client, videoRef, captureFrame, computeFrameDiff]);

  //handler for swapping from one video-stream to the next
  const changeStreams = (next?: UseMediaStreamResult) => async () => {
    if (next) {
      const mediaStream = await next.start();
      setActiveVideoStream(mediaStream);
      onVideoStreamChange(mediaStream);
    } else {
      setActiveVideoStream(null);
      onVideoStreamChange(null);
    }

    videoStreams.filter((msr) => msr !== next).forEach((msr) => msr.stop());
  };

  return (
    <section className="control-tray">
      <canvas style={{ display: "none" }} ref={renderCanvasRef} />
      <canvas style={{ display: "none" }} ref={diffCanvasRef} />
      <nav className={cn("actions-nav", { disabled: !connected })}>
        <button
          className={cn("action-button mic-button")}
          onClick={() => setMuted(!muted)}
        >
          {!muted ? (
            <span className="material-symbols-outlined filled">mic</span>
          ) : (
            <span className="material-symbols-outlined filled">mic_off</span>
          )}
        </button>

        <div className="action-button no-action outlined">
          <AudioPulse volume={volume} active={connected} hover={false} />
        </div>

        {supportsVideo && (
          <>
            <MediaStreamButton
              isStreaming={screenCapture.isStreaming}
              start={changeStreams(screenCapture)}
              stop={changeStreams()}
              onIcon="cancel_presentation"
              offIcon="present_to_all"
            />
            <MediaStreamButton
              isStreaming={webcam.isStreaming}
              start={changeStreams(webcam)}
              stop={changeStreams()}
              onIcon="videocam_off"
              offIcon="videocam"
            />
          </>
        )}
        {children}
      </nav>

      <div className={cn("connection-container", { connected })}>
        <div className="connection-button-container">
          <button
            ref={connectButtonRef}
            className={cn("action-button connect-toggle", { connected })}
            onClick={connected ? disconnect : connect}
          >
            <span className="material-symbols-outlined filled">
              {connected ? "pause" : "play_arrow"}
            </span>
          </button>
        </div>
        <span className="text-indicator">Streaming</span>
      </div>
      {enableEditingSettings ? <SettingsDialog /> : ""}
    </section>
  );
}

export default memo(ControlTray);

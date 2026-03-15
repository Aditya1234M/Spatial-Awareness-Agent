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
import { useEffect, useRef, useState, memo } from "react";
import vegaEmbed from "vega-embed";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import {
  FunctionDeclaration,
  LiveServerToolCall,
  Modality,
  Type,
} from "@google/genai";

const declaration: FunctionDeclaration = {
  name: "render_altair",
  description: "Displays an altair graph in json format.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      json_graph: {
        type: Type.STRING,
        description:
          "JSON STRING representation of the graph to render. Must be a string, not a json object",
      },
    },
    required: ["json_graph"],
  },
};

function AltairComponent({ language }: { language: string }) {
  const [jsonString, setJSONString] = useState<string>("");
  const { client, setConfig, setModel } = useLiveAPIContext();

  useEffect(() => {
    const languageInstruction = language !== "en"
      ? `\n\n## Language\nAlways respond in ${language}. All descriptions, warnings, and scene updates must be spoken in ${language}.`
      : "";

    setModel("models/gemini-2.5-flash-native-audio-preview-12-2025");
    setConfig({
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
      },
      systemInstruction: {
        parts: [
          {
            text: `You are a real-time spatial awareness agent. You act as a proactive "third eye" for the user. You receive a live camera feed from their device — every frame is real. Trust what you see and describe it.

## How you work
You receive video frames continuously alongside audio from the user. When the user speaks to you, always base your response on the LATEST frame you have received. Each time you respond, look at the most recent frame — not earlier ones.

You will also receive automatic "scene changed" messages from the system when the camera detects a significant visual change. When you receive one of these, look at the current frame and briefly describe what changed — for example: new surroundings, a person appeared or left, an obstacle ahead, etc. Keep these updates to one short sentence.

## How to respond
- Be short. 1-2 sentences max.
- Be specific: "a person in a blue shirt on your left" not "someone is there."
- Use spatial directions: left, right, ahead, behind, above, below, at your feet.
- Describe obstacles, people, expressions, gestures, signs, and environmental changes.
- Do not invent things that are not visible in the frame.
- When asked "what do you see?" — describe the most prominent things in the current frame first.

## Priority order
1. Safety hazards — immediately interrupt to warn
2. Obstacles in the user's path
3. People and their gestures/expressions
4. Environment and scene changes
5. Text, signs, or labels if clearly readable

## Safety
If you see something dangerous, say it IMMEDIATELY. Do not wait. Interrupt yourself if needed. Keep warnings to a few words.

## What NOT to do
- Do not make up details.
- Do not describe what a scene "typically" looks like. Describe THIS frame.
- Do not say "the image is dark/blurry" unless it is genuinely unrecognizable.
- Do not repeat your previous description if the user asks again — always look at the current frame fresh.${languageInstruction}`,
          },
        ],
      },
      tools: [
        // there is a free-tier quota for search
        { googleSearch: {} },
        { functionDeclarations: [declaration] },
      ],
    });
  }, [setConfig, setModel, language]);

  useEffect(() => {
    const onToolCall = (toolCall: LiveServerToolCall) => {
      if (!toolCall.functionCalls) {
        return;
      }
      const fc = toolCall.functionCalls.find(
        (fc) => fc.name === declaration.name
      );
      if (fc) {
        const str = (fc.args as any).json_graph;
        setJSONString(str);
      }
      // send data for the response of your tool call
      // in this case Im just saying it was successful
      if (toolCall.functionCalls.length) {
        setTimeout(
          () =>
            client.sendToolResponse({
              functionResponses: toolCall.functionCalls?.map((fc) => ({
                response: { output: { success: true } },
                id: fc.id,
                name: fc.name,
              })),
            }),
          200
        );
      }
    };
    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client]);

  const embedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (embedRef.current && jsonString) {
      console.log("jsonString", jsonString);
      vegaEmbed(embedRef.current, JSON.parse(jsonString));
    }
  }, [embedRef, jsonString]);
  return <div className="vega-embed" ref={embedRef} />;
}

export const Altair = memo(AltairComponent);

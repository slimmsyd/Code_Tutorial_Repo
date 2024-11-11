"use client"

import { useRef, useState } from "react";
import { analyzeImage } from "./lib/computervison";


interface EventData {
  date: string;
  time: string;
  location: string | null;
  description: string;
}

// Add

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false); // State to track dragging status
  const [analysisResult, setAnalysisResult] = useState<string | null>(null); // State to hold analysis resul
  const [azureResult, setAzureResult] = useState<string | null>(null);
  const [agentEventData, setAgentEventData] = useState<EventData | null>(null);
  
  // sjklst


   function parseEventResponse(response: string): EventData {
    const lines = response.split('\n');
    const eventData: EventData = {
        date: '',
        time: '',
        location: null,
        description: ''
    };

    lines.forEach(line => {
        if (line.includes('Date:')) {
            eventData.date = line.split('Date:')[1].trim();
        }
        else if (line.includes('Time:')) {
            eventData.time = line.split('Time:')[1].trim();
        }
        else if (line.includes('Location:')) {
            const location = line.split('Location:')[1].trim();
            eventData.location = location !== 'Not provided' ? location : null;
        }
        else if (line.includes('Description:')) {
            eventData.description = line.split('Description:')[1].trim();
        }
    });

    return eventData;
}
  
  const handleScan = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: "environment" } }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error("Error accessing back camera:", error);
    }
  };

  const takePicture = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/png');
        setImageDataUrl(imageDataUrl); // Save the image data URL
      }
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    setImageDataUrl(null);
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64String = e.target?.result as string;
        setImageDataUrl(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); // Prevent default to allow drop
    setIsDragging(true); // Set dragging state
  };

  const handleDragLeave = () => {
    setIsDragging(false); // Reset dragging state when leaving the drop area
  };

  const handleAnalyzeImage = async () => {
    if (imageDataUrl) {
        try {
            // 1. Get text from Azure Vision
            const azureResponse = await analyzeImage(imageDataUrl);
            
            if ('readResult' in azureResponse && azureResponse.readResult?.blocks) {
                const extractedText = azureResponse.readResult.blocks
                    .map(block => block.lines.map(line => line.text).join(' '))
                    .join('\n');
                
                // Set Azure raw result
                setAzureResult(extractedText);
                
                // 2. Send to our Flask backend for agent processing
                const agentResponse = await fetch('http://127.0.0.1:5000/analyze', {
                  method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ ocr_text: extractedText })
                });

                if (!agentResponse.ok) {
                    throw new Error('Failed to process event data');
                }

                const processedData = await agentResponse.json();
                
                // Parse only the agent result into structured data
                const agentParsed = parseEventResponse(processedData.result);
                setAgentEventData(agentParsed);
            }
        } catch (error) {
            console.error("Error processing image:", error);
            setAzureResult(error instanceof Error ? error.message : "Error processing image");
            setAgentEventData(null);
        }
    }
  };

  return (
    <div 
      className={`camera-container flex flex-col items-center justify-center text-black ${isDragging ? 'dragging' : ''}`} 
      onDrop={handleDrop} 
      onDragOver={handleDragOver} 
      onDragLeave={handleDragLeave}
    >
      <div className="video-container">
        <video ref={videoRef} className="video" />
      </div>
      <button onClick={handleScan}>Scan</button>
      <button onClick={takePicture}>Take Picture</button>
      <button onClick={handleAnalyzeImage}>Analyze Image</button>
      {imageDataUrl && (
        <div>
          <h3>Captured Image:</h3>
          <img src={imageDataUrl} alt="Captured" />
        </div>
      )}
      {isDragging && <div className="drop-message">Drop your image here!</div>}
      {imageDataUrl ? <div className="text-black">Image has been successfully added</div> : <div className="text-white">No image captured</div>}
      {analysisResult && (
        <div className="analysis-result">
          <h3>Analysis Result:</h3>
          {analysisResult}
          {imageDataUrl && <img src={imageDataUrl} alt="Analyzed Image" className="mt-4 max-w-md" />}
        </div>
      )}
      <div className="w-full max-w-2xl mt-8">
        {/* Azure Raw Result */}
        {azureResult && (
            <div className="mb-8">
                <h3 className="text-lg font-bold mb-2">Azure OCR Result:</h3>
                <pre className="bg-gray-100 p-4 rounded overflow-auto">
                    {azureResult}
                </pre>
            </div>
        )}
        
        {/* Structured Agent Result */}
        {agentEventData && (
            <div>
                <h3 className="text-lg font-bold mb-2">AI Agent Analysis:</h3>
                <div className="mt-4">
                    <p>Date: {agentEventData.date}</p>
                    <p>Time: {agentEventData.time}</p>
                    {agentEventData.location && <p>Location: {agentEventData.location}</p>}
                    <p>Description: {agentEventData.description}</p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

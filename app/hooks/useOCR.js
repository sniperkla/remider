
"use client";
import { useState } from 'react';
import Tesseract from "tesseract.js";

export default function useOCR() {
  const [scanProgress, setScanProgress] = useState(0);

  const uploadImageToCloudinary = async (file) => {
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/upload/cloudinary", {
        method: "POST",
        body: formData
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.url || null;
    } catch (err) {
      console.warn("Cloudinary upload failed", err);
      return null;
    }
  };

  const recognize = async (file, ocrProvider = "google") => {
    try {
      setScanProgress(0);
      let text = "";
      const imageUrl = await uploadImageToCloudinary(file);
      
      if (ocrProvider === "google") {
        setScanProgress(5);
        // We'll return a promise that the caller can wait for
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await fetch('/api/ocr/google-vision', {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          const data = await response.json();
          text = data.text || "";
          setScanProgress(100);
        } else {
          throw new Error('Google Vision API failed');
        }
      } else {
        // Tesseract.js
        const result = await Tesseract.recognize(file, "tha+eng", {
          logger: (m) => {
            if (m.status === "recognizing text") {
              setScanProgress(Math.round(m.progress * 100));
            }
          },
        });
        text = result.data.text;
        setScanProgress(100);
      }
      
      return { text, imageUrl };
    } catch (error) {
      console.error("OCR Error:", error);
      return { text: "", imageUrl: null, error };
    }
  };

  return {
    recognize,
    scanProgress,
    setScanProgress,
    uploadImageToCloudinary
  };
}

"use client";
import React, { useRef, useEffect } from 'react';

export default function WebcamModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  
  useEffect(() => {
    let stream;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
        alert("Cannot access camera. Please check permissions.");
        onClose();
      }
    };
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onClose]);

  const capture = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
      canvas.toBlob(blob => {
        const file = new File([blob], "webcam-capture.jpg", { type: "image/jpeg" });
        onCapture(file);
      }, 'image/jpeg');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 130000,
      background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: '640px', padding: '20px' }}>
        <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: '12px', border: '2px solid #a855f7' }} />
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '20px' }}>
             <button onClick={onClose} style={{
               padding: '10px 20px', borderRadius: '50px', border: 'none',
               background: '#ef4444', color: 'white', fontWeight: 'bold', cursor: 'pointer'
             }}>Cancel</button>
             <button onClick={capture} style={{
               padding: '10px 40px', borderRadius: '50px', border: 'none',
               background: '#a855f7', color: 'white', fontWeight: 'bold', fontSize: '1.2rem', cursor: 'pointer',
               boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)'
             }}>📸 Capture</button>
        </div>
      </div>
    </div>
  );
}

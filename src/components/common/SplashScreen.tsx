
"use client";
import { memo } from 'react';

const SplashScreen = () => (
  <>
    <style jsx>{`
      /* Using a more specific selector to avoid conflicts */
      .splash-container {
        background-color: #000;
        font-family: 'Outfit', sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        height: 100vh;
        width: 100vw;
        color: #fff;
        position: fixed;
        top: 0;
        left: 0;
        z-index: 9999;
      }

      .splash-container .logo {
        font-family: 'Unbounded', cursive;
        font-size: 4.5rem;
        font-weight: 600;
        background: linear-gradient(120deg, #ffd700, #f6c600, #e6ac00);
        background-size: 300%;
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        animation: shimmer 3s infinite linear, fadeInUp 1.2s ease-out forwards;
        opacity: 0;
        transform: translateY(40px);
      }

      .splash-container .caption {
        font-size: 1.1rem;
        font-weight: 500;
        color: #d6a700;
        margin-top: 1.2rem;
        opacity: 0;
        animation: fadeInUp 1s ease-out 1.5s forwards;
        transform: translateY(20px);
      }

      .splash-container .tagline {
        font-size: 0.95rem;
        color: #aaa;
        margin-top: 0.4rem;
        opacity: 0;
        animation: fadeInUp 1s ease-out 2.5s forwards;
        transform: translateY(20px);
      }

      .splash-container .org {
        position: absolute;
        bottom: 20px;
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.5);
        font-weight: 400;
        letter-spacing: 0.05em;
        text-decoration: none;
        opacity: 0;
        animation: fadeInUp 1s ease-out 3.5s forwards;
      }

      @keyframes shimmer {
        0% { background-position: 0%; }
        100% { background-position: 200%; }
      }

      @keyframes fadeInUp {
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `}</style>
    <div className="splash-container">
      <div className="logo">Kuchlu</div>
      <div className="caption">One soulmate, infinite moods</div>
      <div className="tagline">Speak your heart in a single tap.</div>
      <a href="https://cwithsai.org" target="_blank" rel="noopener noreferrer" className="org">cwithsai.org</a>
    </div>
  </>
);

export default memo(SplashScreen);

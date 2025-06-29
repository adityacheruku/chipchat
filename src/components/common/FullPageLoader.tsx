
"use client";
import { memo } from 'react';

const FullPageLoader = () => (
  <>
    <style jsx>{`
      /* Using a more specific selector to avoid conflicts */
      .full-page-loader-container {
        background: #000;
        min-height: 100vh;
        width: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        font-family: 'Unbounded', cursive;
        color: #ffd700;
        position: fixed;
        top: 0;
        left: 0;
        z-index: 9998;
      }
      .full-page-loader-container .logo {
        font-size: 3.5rem;
        background: linear-gradient(120deg, #ffd700, #f6c600, #e6ac00);
        background-size: 200% auto;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        animation: textShimmer 2.5s infinite;
      }
      .full-page-loader-container .loader {
        position: relative;
        width: 80px;
        height: 80px;
        margin-top: 2rem;
      }
      .full-page-loader-container .loader div {
        position: absolute;
        border: 4px solid transparent;
        border-top-color: #ffd700;
        border-radius: 50%;
        animation: spin 1.5s linear infinite;
      }
      .full-page-loader-container .loader div:nth-child(1) {
        width: 80px;
        height: 80px;
        animation-duration: 1.5s;
      }
      .full-page-loader-container .loader div:nth-child(2) {
        width: 60px;
        height: 60px;
        top: 10px;
        left: 10px;
        animation-duration: 1s;
        border-top-color: #f6c600;
      }
      .full-page-loader-container .loader div:nth-child(3) {
        width: 40px;
        height: 40px;
        top: 20px;
        left: 20px;
        animation-duration: 0.7s;
        border-top-color: #e6ac00;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      @keyframes textShimmer {
        0% { background-position: 0% center; }
        100% { background-position: -200% center; }
      }
    `}</style>
    <div className="full-page-loader-container">
      <div className="logo">Kuchlu</div>
      <div className="loader">
        <div></div>
        <div></div>
        <div></div>
      </div>
    </div>
  </>
);

export default memo(FullPageLoader);

const router = require("express").Router();
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const db = require("../db");
const { findUser, ensureAuth } = require("../middleware");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: "Too many login attempts. Try again in 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Password validation
function validatePassword(password) {
  if (!password || password.length < 8)
    return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain a number";
  return null;
}

// Login page
router.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/");
  const errorHtml = req.query.error === "1"
    ? `<div class="error-banner">
        <svg width="16" height="16" style="flex-shrink:0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>
        <span>Invalid email or password</span>
       </div>`
    : "";
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>vBudget — Login</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      overflow: hidden;
      background: #04000f;
      position: relative;
    }

    /* ── Dual counter-rotating conic gradient wheels ── */
    body::before {
      content: '';
      position: fixed;
      inset: -60%;
      background: conic-gradient(
        from 0deg at 50% 50%,
        #ff006e, #fb5607, #ffbe0b, #06d6a0, #3a86ff, #8338ec, #ff1493, #ff006e
      );
      animation: spin-bg 6s linear infinite;
      opacity: 0.25;
      filter: blur(50px);
      z-index: 0;
    }
    body::after {
      content: '';
      position: fixed;
      inset: -40%;
      background: conic-gradient(
        from 180deg at 30% 70%,
        #00ffff, #ff00ff, #ffff00, #ff4500, #00ff88, #ff0055, #00ffcc, #00ffff
      );
      animation: spin-bg-rev 9s linear infinite;
      opacity: 0.2;
      filter: blur(70px);
      z-index: 0;
    }

    @keyframes spin-bg { to { transform: rotate(360deg); } }
    @keyframes spin-bg-rev { to { transform: rotate(-360deg); } }

    /* ── Turbo floating blobs ── */
    .blob {
      position: fixed;
      border-radius: 50%;
      filter: blur(45px);
      opacity: 0.7;
      pointer-events: none;
      z-index: 0;
    }
    .blob-1 { width: 500px; height: 500px; background: radial-gradient(#ff006e, #ff4500); top: -150px; left: -150px; animation: float1 3.5s ease-in-out infinite; }
    .blob-2 { width: 450px; height: 450px; background: radial-gradient(#3a86ff, #00ffff); bottom: -120px; right: -120px; animation: float2 4.2s ease-in-out infinite; }
    .blob-3 { width: 350px; height: 350px; background: radial-gradient(#ffbe0b, #ff006e); top: 35%; left: 55%; animation: float3 3.8s ease-in-out infinite; }
    .blob-4 { width: 300px; height: 300px; background: radial-gradient(#8338ec, #ff00ff); top: 5%; right: 10%; animation: float4 5.1s ease-in-out infinite; }
    .blob-5 { width: 280px; height: 280px; background: radial-gradient(#06d6a0, #00ffcc); bottom: 10%; left: 5%; animation: float5 4.5s ease-in-out infinite; }
    .blob-6 { width: 240px; height: 240px; background: radial-gradient(#fb5607, #ffbe0b); top: 50%; left: 15%; animation: float6 5.5s ease-in-out infinite; }
    .blob-7 { width: 200px; height: 200px; background: radial-gradient(#ff1493, #8338ec); top: 20%; left: 40%; animation: float7 4.0s ease-in-out infinite; }
    .blob-8 { width: 320px; height: 320px; background: radial-gradient(#00ff88, #3a86ff); bottom: 30%; right: 5%; animation: float8 6.5s ease-in-out infinite; }

    @keyframes float1 { 0%,100%{transform:translate(0,0) scale(1)} 25%{transform:translate(80px,-60px) scale(1.12)} 50%{transform:translate(-20px,70px) scale(0.9)} 75%{transform:translate(50px,30px) scale(1.05)} }
    @keyframes float2 { 0%,100%{transform:translate(0,0) scale(1)} 25%{transform:translate(-70px,50px) scale(1.15)} 50%{transform:translate(60px,-80px) scale(0.88)} 75%{transform:translate(-40px,-20px) scale(1.08)} }
    @keyframes float3 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-90px,60px) scale(1.2)} 66%{transform:translate(40px,-50px) scale(0.85)} }
    @keyframes float4 { 0%,100%{transform:translate(0,0) rotate(0deg)} 33%{transform:translate(50px,80px) rotate(60deg) scale(1.25)} 66%{transform:translate(-30px,20px) rotate(-30deg) scale(0.9)} }
    @keyframes float5 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(100px,-50px) scale(0.8)} }
    @keyframes float6 { 0%,100%{transform:translate(0,0)} 25%{transform:translate(-60px,-70px) scale(1.15)} 50%{transform:translate(70px,30px) scale(0.85)} 75%{transform:translate(-30px,60px) scale(1.1)} }
    @keyframes float7 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-80px,60px) scale(1.3) rotate(45deg)} }
    @keyframes float8 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(60px,-40px) scale(0.8)} 66%{transform:translate(-50px,80px) scale(1.2)} }

    /* ── Dual orbiting rings ── */
    .orbit {
      position: fixed;
      top: 50%; left: 50%;
      width: 800px; height: 800px;
      margin: -400px 0 0 -400px;
      animation: orbit-spin 15s linear infinite;
      z-index: 0;
      pointer-events: none;
    }
    .orbit-inner {
      position: fixed;
      top: 50%; left: 50%;
      width: 500px; height: 500px;
      margin: -250px 0 0 -250px;
      animation: orbit-spin-rev 8s linear infinite;
      z-index: 0;
      pointer-events: none;
    }
    .orbit-dot {
      position: absolute;
      border-radius: 50%;
      top: 50%; left: 50%;
    }
    .orbit .orbit-dot { width: 16px; height: 16px; filter: blur(1px); }
    .orbit-inner .orbit-dot { width: 10px; height: 10px; }
    .orbit .orbit-dot:nth-child(1)  { background:#ff006e; box-shadow:0 0 12px #ff006e; transform:rotate(0deg)   translateX(400px) translateY(-50%); }
    .orbit .orbit-dot:nth-child(2)  { background:#fb5607; box-shadow:0 0 12px #fb5607; transform:rotate(45deg)  translateX(400px) translateY(-50%); }
    .orbit .orbit-dot:nth-child(3)  { background:#ffbe0b; box-shadow:0 0 12px #ffbe0b; transform:rotate(90deg)  translateX(400px) translateY(-50%); }
    .orbit .orbit-dot:nth-child(4)  { background:#06d6a0; box-shadow:0 0 12px #06d6a0; transform:rotate(135deg) translateX(400px) translateY(-50%); }
    .orbit .orbit-dot:nth-child(5)  { background:#3a86ff; box-shadow:0 0 12px #3a86ff; transform:rotate(180deg) translateX(400px) translateY(-50%); }
    .orbit .orbit-dot:nth-child(6)  { background:#8338ec; box-shadow:0 0 12px #8338ec; transform:rotate(225deg) translateX(400px) translateY(-50%); }
    .orbit .orbit-dot:nth-child(7)  { background:#ff1493; box-shadow:0 0 12px #ff1493; transform:rotate(270deg) translateX(400px) translateY(-50%); }
    .orbit .orbit-dot:nth-child(8)  { background:#00ffcc; box-shadow:0 0 12px #00ffcc; transform:rotate(315deg) translateX(400px) translateY(-50%); }
    .orbit-inner .orbit-dot:nth-child(1) { background:#ff006e; box-shadow:0 0 8px #ff006e; transform:rotate(0deg)   translateX(250px) translateY(-50%); }
    .orbit-inner .orbit-dot:nth-child(2) { background:#ffbe0b; box-shadow:0 0 8px #ffbe0b; transform:rotate(60deg)  translateX(250px) translateY(-50%); }
    .orbit-inner .orbit-dot:nth-child(3) { background:#3a86ff; box-shadow:0 0 8px #3a86ff; transform:rotate(120deg) translateX(250px) translateY(-50%); }
    .orbit-inner .orbit-dot:nth-child(4) { background:#8338ec; box-shadow:0 0 8px #8338ec; transform:rotate(180deg) translateX(250px) translateY(-50%); }
    .orbit-inner .orbit-dot:nth-child(5) { background:#06d6a0; box-shadow:0 0 8px #06d6a0; transform:rotate(240deg) translateX(250px) translateY(-50%); }
    .orbit-inner .orbit-dot:nth-child(6) { background:#fb5607; box-shadow:0 0 8px #fb5607; transform:rotate(300deg) translateX(250px) translateY(-50%); }
    @keyframes orbit-spin { to { transform: rotate(360deg); } }
    @keyframes orbit-spin-rev { to { transform: rotate(-360deg); } }

    /* ── Sparkle particles ── */
    .sparkle {
      position: fixed;
      border-radius: 50%;
      pointer-events: none;
      z-index: 1;
      animation: sparkle-rise linear forwards;
    }
    @keyframes sparkle-rise {
      0%   { opacity: 1; transform: translateY(0) scale(1); }
      100% { opacity: 0; transform: translateY(-120px) scale(0.2); }
    }

    /* ── Card wrapper ── */
    .card-wrap {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 420px;
      animation: card-entrance 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
    }
    @keyframes card-entrance {
      from { opacity:0; transform: scale(0.5) translateY(60px) rotate(-5deg); }
      to   { opacity:1; transform: scale(1) translateY(0) rotate(0deg); }
    }

    /* ── Brand header ── */
    .brand {
      text-align: center;
      margin-bottom: 1.5rem;
    }
    .logo-ring {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 80px; height: 80px;
      border-radius: 28px;
      background: linear-gradient(135deg, #ff006e, #fb5607, #ffbe0b, #06d6a0, #3a86ff, #8338ec);
      background-size: 400%;
      box-shadow: 0 0 50px rgba(255,0,110,0.8), 0 0 100px rgba(251,86,7,0.4);
      margin-bottom: 1rem;
      animation: logo-wobble 1.8s ease-in-out infinite, logo-glow 3s linear infinite, logo-gradient 4s linear infinite;
    }
    @keyframes logo-wobble {
      0%   { transform: rotate(-6deg) scale(1); }
      12%  { transform: rotate(6deg) scale(1.1); }
      25%  { transform: rotate(-4deg) scale(0.92); }
      37%  { transform: rotate(8deg) scale(1.08); }
      50%  { transform: rotate(-5deg) scale(0.96); }
      62%  { transform: rotate(4deg) scale(1.12); }
      75%  { transform: rotate(-7deg) scale(0.94); }
      87%  { transform: rotate(5deg) scale(1.06); }
      100% { transform: rotate(-6deg) scale(1); }
    }
    @keyframes logo-glow {
      0%,100% { box-shadow: 0 0 50px #ff006e, 0 0 100px rgba(255,0,110,0.4); }
      25%      { box-shadow: 0 0 50px #ffbe0b, 0 0 100px rgba(255,190,11,0.4); }
      50%      { box-shadow: 0 0 50px #3a86ff, 0 0 100px rgba(58,134,255,0.4); }
      75%      { box-shadow: 0 0 50px #8338ec, 0 0 100px rgba(131,56,236,0.4); }
    }
    @keyframes logo-gradient { to { background-position: 400% center; } }
    .logo-ring svg { width: 42px; height: 42px; color: #fff; animation: icon-spin 5s linear infinite; }
    @keyframes icon-spin { to { transform: rotate(360deg); } }

    .brand-title {
      font-size: 3.5rem;
      font-weight: 900;
      letter-spacing: -2px;
      background: linear-gradient(90deg, #ff006e, #fb5607, #ffbe0b, #06d6a0, #3a86ff, #8338ec, #ff1493, #ff006e);
      background-size: 400%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: rainbow-text 3s linear infinite, title-bounce 2s ease-in-out infinite;
    }
    @keyframes rainbow-text { to { background-position: 400% center; } }
    @keyframes title-bounce {
      0%,100% { transform: translateY(0) skewX(0deg); }
      20%      { transform: translateY(-6px) skewX(-3deg); }
      40%      { transform: translateY(3px) skewX(2deg); }
      60%      { transform: translateY(-4px) skewX(-2deg); }
      80%      { transform: translateY(2px) skewX(3deg); }
    }

    .brand-sub {
      font-size: 0.9rem;
      margin-top: 0.3rem;
      background: linear-gradient(90deg, #ffbe0b, #06d6a0, #3a86ff, #8338ec, #ffbe0b);
      background-size: 300%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: rainbow-text 4s linear infinite, sub-skew 3s ease-in-out infinite;
    }
    @keyframes sub-skew {
      0%,100% { transform: skewX(0deg); }
      33%      { transform: skewX(-4deg); }
      66%      { transform: skewX(4deg); }
    }

    /* ── Login card with rainbow border ── */
    .card-border {
      border-radius: 26px;
      padding: 3px;
      background: linear-gradient(90deg, #ff006e, #fb5607, #ffbe0b, #06d6a0, #3a86ff, #8338ec, #ff1493, #ff006e);
      background-size: 400%;
      animation: rainbow-border 3s linear infinite, card-border-wobble 4s ease-in-out infinite;
    }
    @keyframes rainbow-border { to { background-position: 400% center; } }
    @keyframes card-border-wobble {
      0%,100% { transform: rotate(0deg) translateY(0); }
      10%      { transform: rotate(-0.8deg) translateY(-4px); }
      20%      { transform: rotate(0.9deg) translateY(3px); }
      30%      { transform: rotate(-0.6deg) translateY(-3px); }
      40%      { transform: rotate(1.0deg) translateY(4px); }
      50%      { transform: rotate(-0.7deg) translateY(-2px); }
      60%      { transform: rotate(0.8deg) translateY(3px); }
      70%      { transform: rotate(-0.9deg) translateY(-4px); }
      80%      { transform: rotate(0.6deg) translateY(2px); }
      90%      { transform: rotate(-0.8deg) translateY(-3px); }
    }
    .card {
      background: rgba(10,0,30,0.85);
      backdrop-filter: blur(30px);
      -webkit-backdrop-filter: blur(30px);
      border-radius: 24px;
      padding: 2rem;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.15);
    }

    .card-title {
      font-size: 1.15rem;
      font-weight: 700;
      background: linear-gradient(90deg, #fff, #ffbe0b, #ff006e, #3a86ff, #fff);
      background-size: 300%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: rainbow-text 4s linear infinite;
      margin-bottom: 1.5rem;
    }

    /* ── Error banner ── */
    .error-banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255,0,110,0.15);
      border: 1px solid rgba(255,0,110,0.4);
      color: #ff6b9d;
      font-size: 0.875rem;
      border-radius: 10px;
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
    }
    @keyframes shake {
      10%,90%  { transform: translateX(-3px); }
      20%,80%  { transform: translateX(6px); }
      30%,50%,70% { transform: translateX(-8px); }
      40%,60%  { transform: translateX(8px); }
    }

    /* ── Form elements ── */
    .field { margin-bottom: 1.1rem; }
    label {
      display: block;
      font-size: 0.8rem;
      font-weight: 600;
      background: linear-gradient(90deg, #ff006e, #ffbe0b, #3a86ff);
      background-size: 200%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: rainbow-text 3s linear infinite;
      margin-bottom: 0.4rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    input[type="email"], input[type="password"], input[type="text"] {
      width: 100%;
      padding: 0.7rem 1rem;
      border-radius: 12px;
      border: 1.5px solid rgba(255,255,255,0.15);
      background: rgba(255,255,255,0.06);
      color: #fff;
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
      font-family: inherit;
    }
    input::placeholder { color: rgba(255,255,255,0.25); }
    input:focus {
      border-color: #ff006e;
      box-shadow: 0 0 0 3px rgba(255,0,110,0.3), 0 0 30px rgba(255,0,110,0.25);
      transform: scale(1.02);
    }

    .pw-wrap { position: relative; }
    .pw-toggle {
      position: absolute;
      right: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: rgba(255,255,255,0.4);
      cursor: pointer;
      padding: 0;
      display: flex;
      transition: color 0.2s;
    }
    .pw-toggle:hover { color: rgba(255,255,255,0.8); }

    /* ── Submit button ── */
    .btn-submit {
      width: 100%;
      margin-top: 0.5rem;
      padding: 0.9rem 1rem;
      border: none;
      border-radius: 14px;
      background: linear-gradient(135deg, #ff006e, #fb5607, #ffbe0b, #06d6a0, #3a86ff, #8338ec, #ff006e);
      background-size: 400%;
      color: #fff;
      font-size: 0.95rem;
      font-weight: 800;
      font-family: inherit;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      cursor: pointer;
      animation: btn-rainbow 2s linear infinite, btn-wobble-idle 1.5s ease-in-out infinite, btn-glow 2s ease-in-out infinite;
      transition: transform 0.15s;
    }
    @keyframes btn-rainbow { to { background-position: 400% center; } }
    @keyframes btn-wobble-idle {
      0%,100% { transform: rotate(-1deg) scale(1); }
      25%      { transform: rotate(1.5deg) scale(1.02); }
      50%      { transform: rotate(-1.5deg) scale(0.98); }
      75%      { transform: rotate(1deg) scale(1.03); }
    }
    @keyframes btn-glow {
      0%,100% { box-shadow: 0 4px 30px #ff006e, 0 0 60px rgba(255,0,110,0.3); }
      33%      { box-shadow: 0 4px 30px #3a86ff, 0 0 60px rgba(58,134,255,0.3); }
      66%      { box-shadow: 0 4px 30px #8338ec, 0 0 60px rgba(131,56,236,0.3); }
    }
    .btn-submit:hover { transform: scale(1.05) translateY(-3px); }
    .btn-submit:active { transform: scale(0.96); }

    /* ── Footer ── */
    .footer {
      text-align: center;
      background: linear-gradient(90deg, #fb5607, #ffbe0b, #06d6a0);
      background-size: 200%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: rainbow-text 3s linear infinite;
      font-size: 0.75rem;
      margin-top: 1.25rem;
    }

    /* ── Hidden util ── */
    .hidden { display: none !important; }
  </style>
</head>
<body>

  <!-- Turbo blobs -->
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>
  <div class="blob blob-4"></div>
  <div class="blob blob-5"></div>
  <div class="blob blob-6"></div>
  <div class="blob blob-7"></div>
  <div class="blob blob-8"></div>

  <!-- Outer orbit -->
  <div class="orbit" aria-hidden="true">
    <div class="orbit-dot"></div>
    <div class="orbit-dot"></div>
    <div class="orbit-dot"></div>
    <div class="orbit-dot"></div>
    <div class="orbit-dot"></div>
    <div class="orbit-dot"></div>
    <div class="orbit-dot"></div>
    <div class="orbit-dot"></div>
  </div>

  <!-- Inner counter-orbit -->
  <div class="orbit-inner" aria-hidden="true">
    <div class="orbit-dot"></div>
    <div class="orbit-dot"></div>
    <div class="orbit-dot"></div>
    <div class="orbit-dot"></div>
    <div class="orbit-dot"></div>
    <div class="orbit-dot"></div>
  </div>

  <div class="card-wrap">

    <!-- Brand header -->
    <div class="brand">
      <div class="logo-ring">
        <svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"/>
        </svg>
      </div>
      <div class="brand-title">vBudget</div>
      <div class="brand-sub">Expense tracking for film &amp; media productions</div>
    </div>

    <!-- Login card -->
    <div class="card-border">
      <div class="card">
        <div class="card-title">Sign in to your account</div>

        ${errorHtml}

        <form method="POST" action="/login">
          <div class="field">
            <label for="email">Email address</label>
            <input id="email" type="email" name="email" required autofocus placeholder="you@example.com">
          </div>

          <div class="field">
            <label for="password">Password</label>
            <div class="pw-wrap">
              <input id="password" type="password" name="password" required placeholder="••••••••" style="padding-right:2.75rem">
              <button type="button" class="pw-toggle" onclick="togglePw()" aria-label="Toggle password visibility">
                <svg id="eye-show" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <svg id="eye-hide" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" class="hidden">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>
                </svg>
              </button>
            </div>
          </div>

          <button type="submit" class="btn-submit">Sign in</button>
        </form>
      </div>
    </div>

    <div class="footer">vBudget &copy; ${new Date().getFullYear()}</div>
  </div>

  <script>
    function togglePw() {
      const input = document.getElementById('password');
      const showIcon = document.getElementById('eye-show');
      const hideIcon = document.getElementById('eye-hide');
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      showIcon.classList.toggle('hidden', isHidden);
      hideIcon.classList.toggle('hidden', !isHidden);
    }

    // Sparkle particles
    const colors = ['#ff006e','#fb5607','#ffbe0b','#06d6a0','#3a86ff','#8338ec','#ff1493','#00ffcc'];
    function spawnSparkle() {
      const s = document.createElement('div');
      s.className = 'sparkle';
      const size = 4 + Math.random() * 8;
      s.style.cssText = [
        'width:' + size + 'px',
        'height:' + size + 'px',
        'background:' + colors[Math.floor(Math.random() * colors.length)],
        'left:' + Math.random() * 100 + 'vw',
        'bottom:' + (Math.random() * 20) + 'px',
        'box-shadow:0 0 ' + (size * 2) + 'px currentColor',
        'animation-duration:' + (0.8 + Math.random() * 1.2) + 's'
      ].join(';');
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 2000);
    }
    setInterval(spawnSparkle, 150);
  </script>
</body>
</html>`);
});

router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  const user = findUser(email);
  if (!user || !bcrypt.compareSync(password, user.hash)) {
    return res.redirect("/login?error=1");
  }
  const superAdmin = user.super_admin === 1;

  // Auto-select project if user is member of exactly one project
  let currentProjectId = null;
  let currentProjectRole = null;
  let currentProjectName = null;

  if (superAdmin) {
    const projects = db.prepare("SELECT * FROM projects ORDER BY id").all();
    // Try default project first
    if (user.default_project_id) {
      const defProject = projects.find((p) => p.id === user.default_project_id);
      if (defProject) {
        currentProjectId = defProject.id;
        currentProjectName = defProject.name;
        const membership = db
          .prepare(
            "SELECT project_role FROM project_members WHERE project_id = ? AND LOWER(user_email) = LOWER(?)",
          )
          .get(currentProjectId, email);
        currentProjectRole = membership ? membership.project_role : "admin";
      }
    }
    // Fall back: auto-select if only one project
    if (!currentProjectId && projects.length === 1) {
      currentProjectId = projects[0].id;
      currentProjectName = projects[0].name;
      const membership = db
        .prepare(
          "SELECT project_role FROM project_members WHERE project_id = ? AND LOWER(user_email) = LOWER(?)",
        )
        .get(currentProjectId, email);
      currentProjectRole = membership ? membership.project_role : "admin";
    }
  } else {
    const memberships = db
      .prepare(
        `
      SELECT pm.project_id, pm.project_role, p.name
      FROM project_members pm JOIN projects p ON p.id = pm.project_id
      WHERE LOWER(pm.user_email) = LOWER(?)
    `,
      )
      .all(email);
    // Try default project first
    if (user.default_project_id) {
      const defMembership = memberships.find(
        (m) => m.project_id === user.default_project_id,
      );
      if (defMembership) {
        currentProjectId = defMembership.project_id;
        currentProjectRole = defMembership.project_role;
        currentProjectName = defMembership.name;
      }
    }
    // Fall back: auto-select if only one project
    if (!currentProjectId && memberships.length === 1) {
      currentProjectId = memberships[0].project_id;
      currentProjectRole = memberships[0].project_role;
      currentProjectName = memberships[0].name;
    }
  }

  req.session.user = {
    email: user.email,
    superAdmin,
    currentProjectId,
    currentProjectRole,
    currentProjectName,
  };
  res.redirect("/");
});

router.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// API: Set default project for current user
router.put("/api/user/default-project", ensureAuth, (req, res) => {
  const { projectId } = req.body;
  const email = req.session.user.email;

  if (projectId !== null) {
    // Validate membership (or super admin)
    if (!req.session.user.superAdmin) {
      const membership = db
        .prepare(
          "SELECT 1 FROM project_members WHERE project_id = ? AND LOWER(user_email) = LOWER(?)",
        )
        .get(projectId, email);
      if (!membership)
        return res.status(403).json({ error: "Not a member of this project" });
    }
    const project = db
      .prepare("SELECT id FROM projects WHERE id = ?")
      .get(projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
  }

  db.prepare(
    "UPDATE users SET default_project_id = ? WHERE LOWER(email) = LOWER(?)",
  ).run(projectId, email);
  res.json({ ok: true, defaultProjectId: projectId });
});

module.exports = router;
module.exports.validatePassword = validatePassword;

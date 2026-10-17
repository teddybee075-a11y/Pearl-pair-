const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send(`
    <html>
    <head><title>Pearl MD</title></head>
    <body style="text-align:center; font-family:sans-serif; padding:50px; background:#111; color:white">
      <h1>Pearl-AI is Live! 🤖</h1>
      <p>Your deployment works!</p>
      <p>Domain: pearl-ai-delta.vercel.app</p>
      <p style="color:green">Status: Ready ✅</p>
      <hr>
      <p>For WhatsApp bot, deploy full bot to Render</p>
      <a href="https://github.com/teddybee075-a11y/Pearl-pair-" style="color:cyan">View GitHub</a>
    </body>
    </html>
  `);
});

module.exports = app;

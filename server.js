const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

app.post("/api/resolve", async (req, res) => {
  const raw = String(req.body?.url || "").trim();
  if (!raw) return res.status(400).json({ error: "Vui lòng nhập URL." });

  let url;
  try {
    url = new URL(raw);
  } catch {
    return res.status(400).json({ error: "URL không hợp lệ." });
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return res.status(400).json({ error: "Chỉ hỗ trợ http/https." });
  }

  // Resolve only normal HTTP redirects. No CAPTCHA/login bypass.
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "LinkDestinationTool/1.0"
      }
    });

    clearTimeout(timer);

    return res.json({
      input: raw,
      destination: response.url,
      status: response.status
    });
  } catch (headError) {
    // Some servers reject HEAD, so retry with a small GET.
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "LinkDestinationTool/1.0",
          "Range": "bytes=0-0"
        }
      });

      clearTimeout(timer);

      return res.json({
        input: raw,
        destination: response.url,
        status: response.status
      });
    } catch (getError) {
      return res.status(502).json({
        error: "Không thể lấy link đích. Máy chủ có thể chặn bot, yêu cầu CAPTCHA/đăng nhập hoặc không cho truy cập tự động."
      });
    }
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Link Destination Tool: http://localhost:${port}`);
});

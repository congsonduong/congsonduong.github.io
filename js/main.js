/* Son Duong — Portfolio v3 interactions. Vanilla JS + one WebGL shader, no dependencies. */

(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  // Set by the inline script in <head>: system "reduce motion" setting, unless the visitor flipped the Motion switch
  const reduceMotion = document.documentElement.classList.contains("calm");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const store = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} },
  };

  const mouse = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0 };
  window.addEventListener("pointermove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.nx = e.clientX / innerWidth - 0.5;
    mouse.ny = e.clientY / innerHeight - 0.5;
  }, { passive: true });

  /* ---------- Preloader (first visit per session) ---------- */

  const pre = $(".preloader");
  const start = () => { document.body.classList.remove("loading"); document.body.classList.add("ready"); };
  if (pre && !reduceMotion && !store.get("seen")) {
    const bar = $(".pre-bar i", pre);
    const count = $(".pre-count", pre);
    let shown = 0, loaded = false;
    window.addEventListener("load", () => (loaded = true));
    const t0 = performance.now();
    const tick = (now) => {
      const target = loaded || now - t0 > 2600 ? 100 : Math.min(90, ((now - t0) / 1100) * 90);
      shown = Math.min(100, shown + Math.max(0.6, (target - shown) * 0.08));
      bar.style.width = `${shown}%`;
      count.textContent = String(Math.round(shown)).padStart(3, "0");
      if (shown < 99.5) return requestAnimationFrame(tick);
      store.set("seen", "1");
      pre.classList.add("done");
      start();
      setTimeout(() => pre.remove(), 1100);
    };
    requestAnimationFrame(tick);
  } else {
    pre?.remove();
    start();
  }

  /* ---------- Liquid silk in the harbour palette (WebGL fragment shader) ---------- */

  const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  const FRAG = `
    precision mediump float;
    uniform vec2 R; uniform float T; uniform vec2 M; uniform float S;
    // Height field of folded ribbons running diagonally
    float H(vec2 p){
      float t = T * 0.11;
      p.y += 0.22 * sin(p.x * 0.8 + t * 1.3);
      float v = sin(p.x * 2.4 + sin(p.y * 1.3 + t) * 1.2 + t * 1.6);
      v += 0.45 * sin(p.x * 4.7 - p.y * 0.5 + t * 2.0 + sin(p.y * 1.9 - t) * 0.7);
      v += 0.12 * sin(p.x * 11.0 + t * 3.0);
      return v;
    }
    void main(){
      vec2 uv = (gl_FragCoord.xy - 0.5 * R) / R.y;
      uv += M * 0.06;
      float a = -0.62;
      uv = mat2(cos(a), -sin(a), sin(a), cos(a)) * uv * S;
      float e = 0.004;
      float h = H(uv);
      vec2 g = vec2(H(uv + vec2(e, 0.)) - h, H(uv + vec2(0., e)) - h) / e;
      vec3 n = normalize(vec3(-g * 0.32, 1.0));
      vec3 r = reflect(vec3(0., 0., -1.), n);
      // Studio lighting: a big soft box above, a strip light on the left, black elsewhere
      float env = smoothstep(-0.1, 0.85, r.y) * 0.95 + smoothstep(0.35, 0.95, -r.x) * 0.5;
      float spec = pow(max(dot(r, normalize(vec3(0.35, 0.55, 0.75))), 0.), 22.);
      float rim = pow(max(dot(r, normalize(vec3(-0.6, 0.2, 0.75))), 0.), 30.);
      float fres = pow(1. - max(n.z, 0.), 1.8);
      float c = 0.015 + env * 0.62 + spec * 1.25 + rim * 0.6 + fres * 0.55;
      c *= 0.18 + 0.82 * smoothstep(-1.3, 1.2, h);
      vec2 q = gl_FragCoord.xy / R;
      c *= 0.3 + 0.7 * smoothstep(0.05, 0.75, q.y);       // darker towards the bottom, where text sits
      c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 180.; // dither, no banding
      // Map brightness onto the harbour ramp: abyss, ocean, royal, sea teal, sand, white
      c = clamp(c, 0., 1.25);
      vec3 col = mix(vec3(0.024, 0.051, 0.122), vec3(0.071, 0.227, 0.451), smoothstep(0.0, 0.28, c));
      col = mix(col, vec3(0.122, 0.373, 0.749), smoothstep(0.22, 0.48, c));
      col = mix(col, vec3(0.247, 0.627, 0.667), smoothstep(0.46, 0.72, c));
      col = mix(col, vec3(0.945, 0.851, 0.651), smoothstep(0.7, 0.95, c));
      col = mix(col, vec3(1.0), smoothstep(0.98, 1.25, c));
      gl_FragColor = vec4(col, 1.);
    }`;

  const chromes = $$("canvas[data-chrome]").map((canvas) => {
    const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = { R: gl.getUniformLocation(prog, "R"), T: gl.getUniformLocation(prog, "T"), M: gl.getUniformLocation(prog, "M"), S: gl.getUniformLocation(prog, "S") };
    const scale = canvas.dataset.chrome === "card" ? 2.6 : 2.1;
    const c = { canvas, gl, u, scale, visible: true, m: { x: 0, y: 0 }, seed: Math.random() * 100 };
    c.resize = () => {
      const q = Math.min(devicePixelRatio || 1, 1.5) * 0.6; // soft surface, so render small and let CSS scale it
      canvas.width = Math.max(1, Math.round(canvas.offsetWidth * q));
      canvas.height = Math.max(1, Math.round(canvas.offsetHeight * q));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    c.draw = (t) => {
      c.m.x = lerp(c.m.x, mouse.nx, 0.04);
      c.m.y = lerp(c.m.y, -mouse.ny, 0.04);
      gl.uniform2f(u.R, canvas.width, canvas.height);
      gl.uniform1f(u.T, c.seed + t / 1000);
      gl.uniform2f(u.M, c.m.x, c.m.y);
      gl.uniform1f(u.S, c.scale);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    c.resize();
    new IntersectionObserver(([en]) => (c.visible = en.isIntersecting)).observe(canvas);
    canvas.previousElementSibling?.classList.contains("chrome-fallback") && canvas.previousElementSibling.remove();
    return c;
  }).filter(Boolean);

  if (chromes.length) {
    window.addEventListener("resize", () => chromes.forEach((c) => { c.resize(); if (reduceMotion) c.draw(0); }));
    if (reduceMotion) chromes.forEach((c) => c.draw(0));
    else {
      const loop = (t) => {
        if (!document.hidden) chromes.forEach((c) => c.visible && c.draw(t));
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  }

  const portrait = $(".hero-photo");
  if (portrait && finePointer && !reduceMotion) {
    const pos = { x: 0, y: 0 };
    const drift = () => {
      pos.x = lerp(pos.x, -mouse.nx * 18, 0.06);
      pos.y = lerp(pos.y, -mouse.ny * 10, 0.06);
      portrait.style.transform = `translate3d(${pos.x}px, ${pos.y + scrollY * 0.12}px, 0)`;
      requestAnimationFrame(drift);
    };
    requestAnimationFrame(drift);
  }

  /* ---------- Custom cursor ---------- */

  const ring = $(".cursor");
  const dot = $(".cursor-dot");
  if (ring && finePointer && !reduceMotion) {
    document.body.classList.add("has-cursor");
    const r = { x: mouse.x, y: mouse.y };
    const follow = () => {
      r.x = lerp(r.x, mouse.x, 0.28);
      r.y = lerp(r.y, mouse.y, 0.28);
      ring.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`;
      requestAnimationFrame(follow);
    };
    document.addEventListener("pointerdown", () => ring.classList.add("press"));
    document.addEventListener("pointerup", () => ring.classList.remove("press"));
    requestAnimationFrame(follow);
    document.addEventListener("pointerover", (e) => {
      const view = e.target.closest("[data-cursor='view']");
      const link = e.target.closest("a, button, .media, .xp-head, .filter");
      ring.classList.toggle("view", !!view);
      ring.classList.toggle("link", !view && !!link);
    });
    document.addEventListener("pointerleave", () => ring.classList.add("hide"));
    document.addEventListener("pointerenter", () => ring.classList.remove("hide"));
  } else {
    ring?.remove();
    dot?.remove();
  }

  /* ---------- Magnetic buttons ---------- */

  if (finePointer && !reduceMotion) {
    $$(".magnetic").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const b = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - b.left - b.width / 2) * 0.22}px, ${(e.clientY - b.top - b.height / 2) * 0.3}px)`;
      });
      el.addEventListener("pointerleave", () => {
        el.style.transition = "transform .6s cubic-bezier(.22,1,.36,1)";
        el.style.transform = "";
        setTimeout(() => (el.style.transition = ""), 600);
      });
    });
  }

  /* ---------- Nav: hide on scroll down, progress bar, mobile menu, section spy ---------- */

  const nav = $(".nav");
  const progress = $(".progress");
  let lastY = scrollY;
  const onScroll = () => {
    const y = scrollY;
    nav?.classList.toggle("scrolled", y > 20);
    if (nav && !nav.classList.contains("open")) nav.classList.toggle("hidden", y > lastY && y > 400);
    lastY = y;
    if (progress) {
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.width = `${max > 0 ? (y / max) * 100 : 0}%`;
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  $(".menu-toggle")?.addEventListener("click", (e) => {
    const open = nav.classList.toggle("open");
    e.currentTarget.setAttribute("aria-expanded", open);
  });
  $$(".nav-links a").forEach((a) => a.addEventListener("click", () => nav.classList.remove("open")));
  const navLinks = $$('.nav-links a[href^="#"]');
  if (navLinks.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${en.target.id}`));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    navLinks.forEach((a) => { const s = $(a.getAttribute("href")); if (s) spy.observe(s); });
  }

  /* ---------- About statement: words fill in as you scroll (the last sentence settles at grey) ---------- */

  const lit = $("[data-lit]");
  if (lit && !reduceMotion) {
    const words = [];
    const wrap = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part.trim()) return frag.appendChild(document.createTextNode(part));
            const s = document.createElement("span");
            s.className = "lw dim";
            s.textContent = part;
            words.push(s);
            frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) wrap(n);
      });
    };
    wrap(lit);
    const light = () => {
      const r = lit.getBoundingClientRect();
      const p = clamp((innerHeight * 0.8 - r.top) / (r.height + innerHeight * 0.25), 0, 1);
      const n = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle("dim", i >= n));
    };
    window.addEventListener("scroll", light, { passive: true });
    light();
  }

  /* ---------- Counters ---------- */

  const counter = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      counter.unobserve(el);
      if (reduceMotion) return;
      const target = parseFloat(el.dataset.count);
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min((now - t0) / 1400, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4))).toLocaleString("en-GB");
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach((el) => counter.observe(el));

  /* ---------- Story: vertical scroll drives the horizontal track ---------- */

  const story = $(".story");
  if (story) {
    const strack = $(".story-track", story);
    const sbar = $(".story-progress i", story);
    const horizontal = () => innerWidth > 760 && !reduceMotion;
    let dist = 0;
    const layout = () => {
      story.classList.toggle("static", !horizontal());
      if (!horizontal()) { story.style.height = ""; strack.style.transform = ""; return; }
      dist = Math.max(0, strack.scrollWidth - innerWidth + 80);
      story.style.height = `${innerHeight + dist}px`;
    };
    const move = () => {
      if (!horizontal()) return;
      const p = clamp(-story.getBoundingClientRect().top / (story.offsetHeight - innerHeight || 1), 0, 1);
      strack.style.transform = `translate3d(${-p * dist}px,0,0)`;
      if (sbar) sbar.style.width = `${p * 100}%`;
    };
    window.addEventListener("resize", () => { layout(); move(); });
    window.addEventListener("load", () => { layout(); move(); });
    window.addEventListener("scroll", move, { passive: true });
    layout();
    move();
  }

  /* ---------- Work list: cover preview follows the cursor ---------- */

  const preview = $(".preview");
  if (preview && finePointer) {
    const imgs = $$("img", preview);
    const p = { x: 0, y: 0 };
    let on = false;
    const chase = () => {
      p.x = lerp(p.x, mouse.x, 0.16);
      p.y = lerp(p.y, mouse.y, 0.16);
      preview.style.left = `${p.x + 24}px`;
      preview.style.top = `${p.y - preview.offsetHeight / 2}px`;
      if (on) requestAnimationFrame(chase);
    };
    $$(".work-row").forEach((row) => {
      row.addEventListener("pointerenter", () => {
        imgs.forEach((im, i) => im.classList.toggle("on", i === +row.dataset.preview));
        preview.classList.add("on");
        if (!on) { on = true; p.x = mouse.x; p.y = mouse.y; requestAnimationFrame(chase); }
      });
      row.addEventListener("pointerleave", () => { preview.classList.remove("on"); on = false; });
    });
  }

  /* ---------- Testimonials: manual slider, no auto-advance ---------- */

  const slides = $$(".slide");
  if (slides.length) {
    let i = 0;
    const cur = $(".quote-nav .cur"), tot = $(".quote-nav .tot");
    const prev = $(".quote-nav .prev"), next = $(".quote-nav .next");
    const pad = (n) => String(n).padStart(2, "0");
    tot.textContent = pad(slides.length);
    const show = (n) => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle("on", k === i));
      cur.textContent = pad(i + 1);
    };
    if (slides.length < 2) { prev.disabled = true; next.disabled = true; }
    prev.addEventListener("click", () => show(i - 1));
    next.addEventListener("click", () => show(i + 1));
  }

  /* ---------- Testing lab: a simulated creative test ---------- */

  const dash = $(".dash");
  const runBtn = $(".run-btn");
  if (dash && runBtn) {
    const rows = $$("[data-v]", dash);
    const steps = $$(".loop li");
    const best = $(".best", dash);
    const round = $(".round", dash);
    let rounds = 0;
    const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));
    const run = async () => {
      runBtn.disabled = true;
      round.textContent = ++rounds;
      rows.forEach((r) => { r.classList.remove("winner", "lost"); $(".bar span", r).style.setProperty("--w", "0%"); const pl = $(".pill", r); pl.className = "pill"; pl.textContent = "…"; });
      best.textContent = "–";
      for (const s of steps.slice(0, 2)) { steps.forEach((x) => x.classList.toggle("on", x === s)); await wait(500); }
      steps.forEach((x) => x.classList.toggle("on", x === steps[2]));
      // Each round the learnings feed back in, so the ceiling creeps up a little
      const vals = rows.map(() => +(1.7 + Math.random() * (2.3 + rounds * 0.25)).toFixed(1));
      rows.forEach((r, k) => $(".bar span", r).style.setProperty("--w", `${Math.min(100, (vals[k] / 5) * 100)}%`));
      await wait(1300);
      steps.forEach((x) => x.classList.toggle("on", x === steps[3]));
      const top = Math.max(...vals);
      rows.forEach((r, k) => {
        const pl = $(".pill", r), v = vals[k];
        if (v === top) { pl.textContent = "Scale"; pl.classList.add("win"); r.classList.add("winner"); }
        else if (v >= 3) { pl.textContent = "Keep"; pl.classList.add("keep"); }
        else if (v < 2) { pl.textContent = "Cut"; pl.classList.add("cut"); r.classList.add("lost"); }
        else { pl.textContent = "Iterate"; pl.classList.add("iter"); }
      });
      best.textContent = `${top}:1`;
      $(".btn-label", runBtn).textContent = "Run next round";
      runBtn.disabled = false;
    };
    runBtn.addEventListener("click", run);
    const auto = new IntersectionObserver(([en]) => { if (en.isIntersecting) { auto.disconnect(); run(); } }, { threshold: 0.5 });
    auto.observe(dash);
    if (finePointer && !reduceMotion) {
      dash.addEventListener("pointermove", (e) => {
        const b = dash.getBoundingClientRect();
        dash.style.setProperty("--ry", `${((e.clientX - b.left) / b.width - 0.5) * 7}deg`);
        dash.style.setProperty("--rx", `${-((e.clientY - b.top) / b.height - 0.5) * 5}deg`);
      });
      dash.addEventListener("pointerleave", () => { dash.style.setProperty("--ry", "0deg"); dash.style.setProperty("--rx", "0deg"); });
    }
  }

  /* ---------- Experience accordion ---------- */

  $$(".xp-head").forEach((btn) => btn.addEventListener("click", () => {
    const item = btn.closest(".xp-item");
    const open = !item.classList.contains("open");
    item.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", open);
  }));

  /* ---------- Media: lightbox ---------- */

  $$(".media img").forEach((img) => {
    const ok = () => img.parentElement.classList.add("has-img");
    if (img.complete && img.naturalWidth) ok(); else img.addEventListener("load", ok);
  });
  const lightbox = $(".lightbox");
  if (lightbox) {
    const lbImg = $("img", lightbox);
    document.addEventListener("click", (e) => {
      const media = e.target.closest(".media.has-img");
      const src = media && $("img", media);
      if (!src) return;
      lbImg.src = src.src;
      lbImg.alt = src.alt;
      lightbox.classList.add("open");
    });
    lightbox.addEventListener("click", () => lightbox.classList.remove("open"));
  }

  /* ---------- Gallery filters ---------- */

  const filters = $$(".filter");
  filters.forEach((btn) => btn.addEventListener("click", () => {
    filters.forEach((b) => { b.classList.toggle("active", b === btn); b.setAttribute("aria-pressed", String(b === btn)); });
    const f = btn.dataset.filter;
    $$(".g-item").forEach((it) => it.classList.toggle("hide", f !== "all" && it.dataset.cat !== f));
  }));

  /* ---------- Copy email ---------- */

  const EMAIL = "son16072003@gmail.com";
  const copyEmail = async (btn) => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      if (btn) { btn.classList.add("copied"); setTimeout(() => btn.classList.remove("copied"), 2200); }
    } catch {
      location.href = `mailto:${EMAIL}`;
    }
  };
  $$(".copy-email").forEach((btn) => btn.addEventListener("click", () => copyEmail(btn)));

  /* ---------- UK local time ---------- */

  const clocks = $$(".clock");
  if (clocks.length) {
    const fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
    const tickClock = () => clocks.forEach((c) => (c.textContent = fmt.format(new Date())));
    tickClock();
    setInterval(tickClock, 15000);
  }

  /* ---------- Quick menu (Ctrl/⌘ + K) ---------- */

  const palette = $(".palette");
  if (palette) {
    const input = $("input", palette);
    const list = $("ul", palette);
    const root = document.body.dataset.root || "";
    const goTo = (url) => {
      const here = location.pathname.split("/").pop() || "index.html";
      const [page, hash] = url.split("#");
      if (hash && page.endsWith(here) && $(`#${hash}`)) $(`#${hash}`).scrollIntoView({ behavior: "smooth" });
      else location.href = url;
    };
    const commands = [
      { label: "Selected work", hint: "section", go: () => goTo(`${root}index.html#work`) },
      { label: "Digiphar", hint: "case study", go: () => goTo(`${root}work/digiphar.html`) },
      { label: "Minh Thuan Mart", hint: "case study", go: () => goTo(`${root}work/minh-thuan-mart.html`) },
      { label: "One Strange Fellow", hint: "case study", go: () => goTo(`${root}work/one-strange-fellow.html`) },
      { label: "ZENDA", hint: "case study", go: () => goTo(`${root}work/zenda.html`) },
      { label: "What I bring to a team", hint: "section", go: () => goTo(`${root}index.html#bring`) },
      { label: "Run the testing lab", hint: "section", go: () => goTo(`${root}index.html#lab`) },
      { label: "Haiphong to Manchester", hint: "section", go: () => goTo(`${root}index.html#story`) },
      { label: "Download CV", hint: "PDF", go: () => window.open(`${root}assets/Cong-Son-Duong-CV.pdf`, "_blank") },
      { label: "Copy email address", hint: "action", go: () => copyEmail() },
      { label: "Open LinkedIn", hint: "link", go: () => window.open("https://www.linkedin.com/in/cong-son-duong", "_blank") },
    ];
    let shown = commands, sel = 0;
    const render = () => {
      list.innerHTML = "";
      shown.forEach((c, k) => {
        const li = document.createElement("li");
        li.className = k === sel ? "sel" : "";
        li.setAttribute("role", "option");
        li.innerHTML = "<span></span><small></small>";
        li.firstChild.textContent = c.label;
        li.lastChild.textContent = c.hint;
        li.addEventListener("mouseenter", () => { sel = k; render(); });
        li.addEventListener("click", () => run(c));
        list.appendChild(li);
      });
    };
    const open = () => { palette.classList.add("open"); input.value = ""; shown = commands; sel = 0; render(); setTimeout(() => input.focus(), 10); };
    const close = () => palette.classList.remove("open");
    const run = (c) => { close(); c.go(); };
    input.addEventListener("input", () => {
      const q = input.value.toLowerCase().trim();
      shown = commands.filter((c) => (c.label + " " + c.hint).toLowerCase().includes(q));
      sel = 0;
      render();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { sel = Math.min(sel + 1, shown.length - 1); render(); e.preventDefault(); }
      if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); render(); e.preventDefault(); }
      if (e.key === "Enter" && shown[sel]) run(shown[sel]);
    });
    palette.addEventListener("click", (e) => { if (e.target === palette) close(); });
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); palette.classList.contains("open") ? close() : open(); }
      if (e.key === "Escape") { close(); lightbox?.classList.remove("open"); }
    });
    $$("[data-open-palette]").forEach((b) => b.addEventListener("click", open));
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
    $$(".kbd-key").forEach((k) => (k.textContent = isMac ? "⌘K" : "Ctrl K"));
  }

  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  /* ---------- Motion switch ---------- */

  $$(".motion-toggle").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(!reduceMotion));
    btn.addEventListener("click", () => {
      try { localStorage.setItem("motion", reduceMotion ? "on" : "off"); } catch {}
      location.reload();
    });
  });
})();

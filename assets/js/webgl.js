(function () {
  const canvas = document.querySelector("#hero-webgl");
  if (!canvas) return;

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reducedMotionQuery.matches) {
    document.documentElement.classList.add("webgl-disabled");
    return;
  }

  const gl =
    canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      depth: false,
      powerPreference: "low-power",
    }) || canvas.getContext("experimental-webgl");

  if (!gl) {
    document.documentElement.classList.add("webgl-disabled");
    return;
  }

  const vertexShaderSource = `
    attribute vec2 a_position;
    attribute float a_alpha;
    attribute float a_size;
    uniform vec2 u_resolution;
    varying float v_alpha;

    void main() {
      vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
      gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
      gl_PointSize = a_size;
      v_alpha = a_alpha;
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;
    uniform vec3 u_color;
    varying float v_alpha;

    void main() {
      float dist = distance(gl_PointCoord, vec2(0.5));
      float pointMask = smoothstep(0.5, 0.15, dist);
      gl_FragColor = vec4(u_color, v_alpha * pointMask);
    }
  `;

  const lineFragmentShaderSource = `
    precision mediump float;
    uniform vec3 u_color;
    varying float v_alpha;

    void main() {
      gl_FragColor = vec4(u_color, v_alpha);
    }
  `;

  function createShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  function createProgram(fragmentSource) {
    const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertexShader || !fragmentShader) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }

    return program;
  }

  const pointProgram = createProgram(fragmentShaderSource);
  const lineProgram = createProgram(lineFragmentShaderSource);

  if (!pointProgram || !lineProgram) {
    document.documentElement.classList.add("webgl-disabled");
    return;
  }

  const pointBuffer = gl.createBuffer();
  const lineBuffer = gl.createBuffer();
  const particles = [];
  const pointer = { x: 0, y: 0, active: false };
  const families = [
    { x: 0.72, y: 0.22 },
    { x: 0.84, y: 0.44 },
    { x: 0.66, y: 0.66 },
    { x: 0.46, y: 0.34 },
    { x: 0.88, y: 0.78 },
    { x: 0.58, y: 0.84 },
  ];
  const particleCount = window.innerWidth < 700 ? 34 : 70;
  let width = 0;
  let height = 0;
  let animationFrame = 0;

  for (let i = 0; i < particleCount; i += 1) {
    const family = families[i % families.length];
    particles.push({
      x: family.x + (Math.random() - 0.5) * 0.26,
      y: family.y + (Math.random() - 0.5) * 0.24,
      anchorX: family.x,
      anchorY: family.y,
      depth: 0.45 + Math.random() * 0.85,
      vx: (Math.random() - 0.5) * 0.00018,
      vy: (Math.random() - 0.5) * 0.00018,
      phase: Math.random() * Math.PI * 2,
    });
  }

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));

    const displayWidth = Math.floor(width * ratio);
    const displayHeight = Math.floor(height * ratio);

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function bindProgram(program, buffer, stride) {
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const alphaLocation = gl.getAttribLocation(program, "a_alpha");
    const sizeLocation = gl.getAttribLocation(program, "a_size");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const colorLocation = gl.getUniformLocation(program, "u_color");

    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform3f(colorLocation, 0.42, 0.86, 0.98);

    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(alphaLocation);
    gl.vertexAttribPointer(alphaLocation, 1, gl.FLOAT, false, stride, 8);

    gl.enableVertexAttribArray(sizeLocation);
    gl.vertexAttribPointer(sizeLocation, 1, gl.FLOAT, false, stride, 12);
  }

  function render(time) {
    resize();

    const scaleX = canvas.width;
    const scaleY = canvas.height;
    const pointData = [];
    const lineData = [];
    const t = time * 0.001;

    for (const particle of particles) {
      particle.x += particle.vx * particle.depth + Math.sin(t * 0.18 + particle.phase) * 0.00005;
      particle.y += particle.vy * particle.depth + Math.cos(t * 0.16 + particle.phase) * 0.00004;
      particle.x += (particle.anchorX - particle.x) * 0.00012;
      particle.y += (particle.anchorY - particle.y) * 0.00012;

      if (particle.x < -0.04) particle.x = 1.04;
      if (particle.x > 1.04) particle.x = -0.04;
      if (particle.y < -0.04) particle.y = 1.04;
      if (particle.y > 1.04) particle.y = -0.04;

      let px = particle.x * scaleX;
      let py = particle.y * scaleY;

      if (pointer.active) {
        const dx = pointer.x * scaleX - px;
        const dy = pointer.y * scaleY - py;
        const distance = Math.hypot(dx, dy);
        if (distance < 190) {
          const pull = (1 - distance / 190) * 0.0028;
          px += dx * pull;
          py += dy * pull;
        }
      }

      particle.screenX = px;
      particle.screenY = py;
      pointData.push(px, py, 0.18 + particle.depth * 0.16, 1.6 + particle.depth * 2.1);
    }

    const maxDistance = Math.min(170, Math.max(116, width * 0.16));
    for (let i = 0; i < particles.length; i += 1) {
      for (let j = i + 1; j < particles.length; j += 1) {
        const a = particles[i];
        const b = particles[j];
        const distance = Math.hypot(a.screenX - b.screenX, a.screenY - b.screenY);

        if (distance < maxDistance) {
          const alpha = (1 - distance / maxDistance) * 0.08;
          lineData.push(a.screenX, a.screenY, alpha, 1, b.screenX, b.screenY, alpha, 1);
        }
      }
    }

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineData), gl.DYNAMIC_DRAW);
    bindProgram(lineProgram, lineBuffer, 16);
    gl.drawArrays(gl.LINES, 0, lineData.length / 4);

    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pointData), gl.DYNAMIC_DRAW);
    bindProgram(pointProgram, pointBuffer, 16);
    gl.drawArrays(gl.POINTS, 0, pointData.length / 4);

    animationFrame = window.requestAnimationFrame(render);
  }

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener(
    "pointermove",
    (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = (event.clientX - rect.left) / Math.max(1, rect.width);
      pointer.y = (event.clientY - rect.top) / Math.max(1, rect.height);
      pointer.active = pointer.x >= 0 && pointer.x <= 1 && pointer.y >= 0 && pointer.y <= 1;
    },
    { passive: true },
  );
  window.addEventListener("pointerleave", () => {
    pointer.active = false;
  });

  window.addEventListener("pagehide", () => {
    window.cancelAnimationFrame(animationFrame);
  });

  reducedMotionQuery.addEventListener("change", (event) => {
    if (event.matches) {
      window.cancelAnimationFrame(animationFrame);
      document.documentElement.classList.remove("webgl-ready");
      document.documentElement.classList.add("webgl-disabled");
    }
  });

  document.documentElement.classList.add("webgl-ready");
  resize();
  animationFrame = window.requestAnimationFrame(render);
})();

(function () {
  const canvas = document.querySelector("#page-webgl");
  if (!canvas) return;

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const desktopQuery = window.matchMedia("(min-width: 1081px)");

  if (reducedMotionQuery.matches || !desktopQuery.matches) {
    if (reducedMotionQuery.matches) {
      document.documentElement.classList.add("webgl-disabled");
    }
    return;
  }

  const gl =
    canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      depth: false,
      powerPreference: "low-power",
    }) || canvas.getContext("experimental-webgl");

  if (!gl) return;

  const vertexShaderSource = `
    attribute vec2 a_position;
    attribute float a_alpha;
    attribute float a_size;
    uniform vec2 u_resolution;
    varying float v_alpha;

    void main() {
      vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
      gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
      gl_PointSize = a_size;
      v_alpha = a_alpha;
    }
  `;

  const pointFragmentShaderSource = `
    precision mediump float;
    uniform vec3 u_color;
    varying float v_alpha;

    void main() {
      float dist = distance(gl_PointCoord, vec2(0.5));
      float mask = smoothstep(0.5, 0.18, dist);
      gl_FragColor = vec4(u_color, v_alpha * mask);
    }
  `;

  const lineFragmentShaderSource = `
    precision mediump float;
    uniform vec3 u_color;
    varying float v_alpha;

    void main() {
      gl_FragColor = vec4(u_color, v_alpha);
    }
  `;

  function createShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  function createProgram(fragmentSource) {
    const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertexShader || !fragmentShader) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }

    return program;
  }

  const pointProgram = createProgram(pointFragmentShaderSource);
  const lineProgram = createProgram(lineFragmentShaderSource);
  const pointBuffer = gl.createBuffer();
  const lineBuffer = gl.createBuffer();

  if (!pointProgram || !lineProgram || !pointBuffer || !lineBuffer) return;

  const nodes = [];
  const pointer = { x: 0.5, y: 0.5, active: false };
  const nodeCount = 64;
  let width = 0;
  let height = 0;
  let animationFrame = 0;
  let running = true;

  for (let i = 0; i < nodeCount; i += 1) {
    const column = i % 8;
    const row = Math.floor(i / 8);
    nodes.push({
      anchorX: 0.06 + column * 0.128 + (Math.random() - 0.5) * 0.05,
      anchorY: 0.08 + row * 0.14 + (Math.random() - 0.5) * 0.06,
      phase: Math.random() * Math.PI * 2,
      depth: 0.55 + Math.random() * 0.9,
      radiusX: 0.006 + Math.random() * 0.012,
      radiusY: 0.008 + Math.random() * 0.016,
      speed: 0.08 + Math.random() * 0.09,
    });
  }

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.35);
    width = window.innerWidth;
    height = window.innerHeight;

    const displayWidth = Math.max(1, Math.floor(width * ratio));
    const displayHeight = Math.max(1, Math.floor(height * ratio));

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function bindProgram(program, buffer, stride, color) {
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const alphaLocation = gl.getAttribLocation(program, "a_alpha");
    const sizeLocation = gl.getAttribLocation(program, "a_size");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const colorLocation = gl.getUniformLocation(program, "u_color");

    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform3f(colorLocation, color[0], color[1], color[2]);

    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(alphaLocation);
    gl.vertexAttribPointer(alphaLocation, 1, gl.FLOAT, false, stride, 8);

    gl.enableVertexAttribArray(sizeLocation);
    gl.vertexAttribPointer(sizeLocation, 1, gl.FLOAT, false, stride, 12);
  }

  function render(time) {
    if (!running) return;

    resize();

    const pointData = [];
    const lineData = [];
    const t = time * 0.001;
    const scrollInfluence = (window.scrollY || 0) * 0.000035;
    const scaleX = canvas.width;
    const scaleY = canvas.height;

    for (const node of nodes) {
      const pointerShiftX = pointer.active ? (pointer.x - 0.5) * 0.008 * node.depth : 0;
      const pointerShiftY = pointer.active ? (pointer.y - 0.5) * 0.006 * node.depth : 0;
      const x =
        node.anchorX +
        Math.sin(t * node.speed + node.phase) * node.radiusX +
        pointerShiftX;
      const y =
        node.anchorY +
        Math.cos(t * node.speed * 0.82 + node.phase) * node.radiusY +
        scrollInfluence * node.depth +
        pointerShiftY;

      node.screenX = ((x % 1.08) + 0.02) * scaleX;
      node.screenY = ((y % 1.12) - 0.06) * scaleY;

      pointData.push(
        node.screenX,
        node.screenY,
        0.2 + node.depth * 0.12,
        1.8 + node.depth * 1.65,
      );
    }

    const maxDistance = Math.min(178, Math.max(128, width * 0.13));
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const distance = Math.hypot(a.screenX - b.screenX, a.screenY - b.screenY);

        if (distance < maxDistance) {
          const alpha = (1 - distance / maxDistance) * 0.088;
          lineData.push(a.screenX, a.screenY, alpha, 1, b.screenX, b.screenY, alpha, 1);
        }
      }
    }

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineData), gl.DYNAMIC_DRAW);
    bindProgram(lineProgram, lineBuffer, 16, [0.46, 0.9, 0.98]);
    gl.drawArrays(gl.LINES, 0, lineData.length / 4);

    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pointData), gl.DYNAMIC_DRAW);
    bindProgram(pointProgram, pointBuffer, 16, [0.62, 0.98, 0.94]);
    gl.drawArrays(gl.POINTS, 0, pointData.length / 4);

    animationFrame = window.requestAnimationFrame(render);
  }

  function stop() {
    running = false;
    window.cancelAnimationFrame(animationFrame);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      stop();
      return;
    }

    if (!running && desktopQuery.matches && !reducedMotionQuery.matches) {
      running = true;
      animationFrame = window.requestAnimationFrame(render);
    }
  }

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener(
    "pointermove",
    (event) => {
      pointer.x = event.clientX / Math.max(1, window.innerWidth);
      pointer.y = event.clientY / Math.max(1, window.innerHeight);
      pointer.active = true;
    },
    { passive: true },
  );
  window.addEventListener("pointerleave", () => {
    pointer.active = false;
  });
  document.addEventListener("visibilitychange", handleVisibilityChange);
  reducedMotionQuery.addEventListener("change", (event) => {
    if (event.matches) {
      document.documentElement.classList.add("webgl-disabled");
      stop();
    }
  });
  desktopQuery.addEventListener("change", (event) => {
    if (!event.matches) stop();
  });
  window.addEventListener("pagehide", stop);

  resize();
  animationFrame = window.requestAnimationFrame(render);
})();

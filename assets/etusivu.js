/* Etusivun tehosteet: revontulitaivas, lumisade, sanamerkin kinokset, parallaksi ja pelivideot. */
(function () {
  'use strict';
  var d = document.documentElement;
  var hiljaa = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saasto = navigator.connection && navigator.connection.saveData;
  var kapea = function () { return innerWidth < 861; };
  var kiinni = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  var sankari = document.querySelector('.sankari');
  var maailmat = document.querySelector('.maailmat');
  var raita = document.querySelector('.raita');
  var yla = document.querySelector('.yla');

  if (!hiljaa) d.classList.add('vaaka');

  /* ---------- taivas (WebGL) ---------- */
  var taivas = (function () {
    var c = document.getElementById('taivas');
    var gl = c.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return null;
    var vs = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
    var fs = [
      '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform vec2 R;uniform float T;uniform vec2 M;uniform float S;',
      'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
      'return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}',
      'float b(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+vec2(11.3,7.1);a*=.5;}return v;}',
      'void main(){vec2 u=gl_FragCoord.xy/R;float s=R.x/R.y;vec2 p=vec2(u.x*s,u.y);',
      'vec3 c=mix(vec3(.051,.106,.239),vec3(.024,.043,.11),smoothstep(.1,1.,u.y));',
      'c+=vec3(.03,.06,.12)*smoothstep(.75,.0,u.y);',
      /* tähdet */
      'vec2 g=p*vec2(92.);vec2 id=floor(g);vec2 fr=fract(g)-.5;float r=h(id);',
      'if(r>.962){float tw=.55+.45*sin(T*(1.+r*3.)+r*40.);float dd=length(fr-(vec2(h(id+1.),h(id+2.))-.5)*.6);',
      'c+=vec3(.86,.93,1.)*smoothstep(.13,.0,dd)*tw*(r-.962)*22.*smoothstep(.2,.55,u.y);}',
      /* revontuliverhot */
      'vec3 A=vec3(0.);for(int i=0;i<3;i++){float f=float(i);float x=p.x*(1.05+f*.3)+f*3.7+M.x*.1;',
      'float w=b(vec2(x*.8+T*.028,T*.016+f*2.))*.62;float y0=.60+f*.08+w-.27-S*.2+M.y*.015;float e=u.y-y0;',
      'float q=pow(b(vec2(x*8.+T*.1,f*5.+T*.02)),1.5)*2.4+.25;',
      'float v=exp(-max(e,0.)*(3.4+f*1.5))*exp(-max(-e,0.)*30.)*q*(.8-.2*f);',
      'vec3 k=mix(vec3(.10,.78,.52),vec3(.14,.34,.86),smoothstep(.04,.32,e)+f*.2);',
      'k=mix(k,vec3(.42,.22,.78),smoothstep(.22,.6,e)*.55);A+=k*v;}',
      'A=A*.62;A=A/(1.+.55*A);c+=A;gl_FragColor=vec4(c,1.);}'
    ].join('\n');
    function aja(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; }
    var pr = gl.createProgram();
    gl.attachShader(pr, aja(gl.VERTEX_SHADER, vs));
    gl.attachShader(pr, aja(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    var bf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var a = gl.getAttribLocation(pr, 'a');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    var uR = gl.getUniformLocation(pr, 'R'), uT = gl.getUniformLocation(pr, 'T'),
        uM = gl.getUniformLocation(pr, 'M'), uS = gl.getUniformLocation(pr, 'S');
    var laatu = 1;
    function koko() {
      var k = Math.min(devicePixelRatio || 1, 1.5) * (innerWidth < 700 ? .6 : .8) * laatu;
      c.width = Math.round(innerWidth * k);
      c.height = Math.round(innerHeight * k);
      gl.viewport(0, 0, c.width, c.height);
      gl.uniform2f(uR, c.width, c.height);
    }
    d.classList.add('taivas-ok');
    return {
      koko: koko,
      kevenna: function () { if (laatu > .45) { laatu *= .72; koko(); } },
      piirra: function (t, mx, my, s) {
        gl.uniform1f(uT, t); gl.uniform2f(uM, mx, my); gl.uniform1f(uS, s);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    };
  })();

  /* ---------- kinokset sanamerkin päällä ---------- */
  var kinos = (function () {
    var box = document.querySelector('.sanamerkki');
    var c = box.querySelector('.kinos');
    var x = c.getContext('2d');
    var ASKEL = 2, YLA = 40;
    var L = null; // reunat: ly, lh, lc (kapasiteetti), lv, ov (naapurit), sar (sarakkeen reunat)
    var likainen = true;

    function rakenna() {
      var r = box.getBoundingClientRect();
      var W = Math.ceil(r.width), H = Math.ceil(r.height) + YLA;
      if (!W || !H) return;
      var dpr = Math.min(devicePixelRatio || 1, 2);
      c.width = W * dpr; c.height = H * dpr;
      c.style.width = W + 'px'; c.style.height = H + 'px';
      x.setTransform(dpr, 0, 0, dpr, 0, 0);

      var o = document.createElement('canvas');
      o.width = W; o.height = H;
      var g = o.getContext('2d', { willReadFrequently: true });
      box.querySelectorAll('svg.sm').forEach(function (s) {
        var q = s.getBoundingClientRect(), v = s.viewBox.baseVal, k = q.width / v.width;
        g.setTransform(k, 0, 0, k, q.left - r.left - v.x * k, q.top - r.top + YLA - v.y * k);
        s.querySelectorAll('path').forEach(function (p) { g.fill(new Path2D(p.getAttribute('d'))); });
      });
      var dat = g.getImageData(0, 0, W, H).data;
      var kork = r.height, MAKS = kiinni(kork * .085, 5, 24);

      var ly = [], lx = [], sar = [];
      for (var cx = 0; cx * ASKEL < W; cx++) {
        var px = cx * ASKEL, lista = [], tyhja = 0;
        for (var y = 1; y < H; y++) {
          var kiinteä = dat[(y * W + px) * 4 + 3] > 128;
          if (!kiinteä) { tyhja++; continue; }
          if (tyhja >= 7) { lista.push(ly.length); ly.push(y); lx.push(px); }
          tyhja = 0;
        }
        sar.push(lista);
      }
      var n = ly.length, vas = new Int32Array(n).fill(-1), oik = new Int32Array(n).fill(-1);
      for (var s2 = 0; s2 < sar.length - 1; s2++) {
        sar[s2].forEach(function (i) {
          var paras = -1, ero = ASKEL * 2.4;
          sar[s2 + 1].forEach(function (j) { var e = Math.abs(ly[j] - ly[i]); if (e < ero) { ero = e; paras = j; } });
          if (paras >= 0 && vas[paras] < 0) { oik[i] = paras; vas[paras] = i; }
        });
      }
      var cap = new Float32Array(n);
      for (var i = 0; i < n; i++) {
        var a = vas[i], b = oik[i];
        var kulma = Math.abs(ly[a < 0 ? i : a] - ly[b < 0 ? i : b]) / (ASKEL * 2);
        var melu = .68 + .32 * Math.sin(lx[i] * .047 + ly[i]) * Math.sin(lx[i] * .013);
        cap[i] = (a < 0 || b < 0) ? 0 : MAKS * kiinni(1 - kulma / 1.05, 0, 1) * melu;
      }
      for (var k2 = 0; k2 < 5; k2++) { // pyöristetään reunat: kinos ohenee kohti kirjaimen laitaa
        var seur = cap.slice();
        for (var m = 0; m < n; m++) {
          var ca = vas[m] < 0 ? 0 : cap[vas[m]], cb = oik[m] < 0 ? 0 : cap[oik[m]];
          seur[m] = Math.min(cap[m], (cap[m] + ca + cb) / 3 + .4, Math.min(ca, cb) + 1.7);
        }
        cap = seur;
      }
      var vanha = L;
      L = { ly: ly, lx: lx, sar: sar, vas: vas, oik: oik, cap: cap, h: new Float32Array(n), n: n };
      var alku = hiljaa ? .9 : .2;
      for (var t = 0; t < n; t++) L.h[t] = cap[t] * alku * (vanha ? 1.6 : 1);
      likainen = true;
    }

    function laskeudu(sx, sy, ed, ra, boxR) {
      if (!L) return false;
      var cx = Math.round((sx - boxR.left) / ASKEL);
      var lista = L.sar[cx];
      if (!lista) return false;
      var y = sy - boxR.top + YLA, yEd = ed - boxR.top + YLA;
      for (var i = 0; i < lista.length; i++) {
        var q = lista[i], pinta = L.ly[q] - L.h[q];
        if (y >= pinta && yEd <= pinta + 3) {
          if (L.cap[q] <= 0) return false;
          var maara = ra * 2.1;
          for (var j = 0, a = q, b = q; j < 6; j++) {
            var osa = maara * (1 - j / 6) * .5;
            if (a >= 0) { L.h[a] = Math.min(L.cap[a], L.h[a] + osa); a = L.vas[a]; }
            if (b >= 0 && j) { L.h[b] = Math.min(L.cap[b], L.h[b] + osa); b = L.oik[b]; }
          }
          likainen = true;
          return true;
        }
      }
      return false;
    }

    function puhalla(sx, sy, boxR, r, kerroin, tupsu) {
      if (!L) return;
      var ox = sx - boxR.left, oy = sy - boxR.top + YLA;
      var c0 = Math.floor((ox - r) / ASKEL), c1 = Math.ceil((ox + r) / ASKEL);
      for (var c2 = c0; c2 <= c1; c2++) {
        var lista = L.sar[c2];
        if (!lista) continue;
        for (var i = 0; i < lista.length; i++) {
          var q = lista[i], dx = L.lx[q] - ox, dy = L.ly[q] - oy;
          if (dx * dx + dy * dy < r * r && L.h[q] > .6) {
            var ero = L.h[q] * kerroin;
            L.h[q] -= ero;
            if (Math.random() < .09) tupsu(L.lx[q] + boxR.left, L.ly[q] + boxR.top - YLA);
            likainen = true;
          }
        }
      }
    }

    function piirra() {
      if (!L || !likainen) return;
      likainen = false;
      var W = c.width, H = c.height;
      x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H); x.restore();
      x.fillStyle = '#F2F7FF';
      x.shadowColor = 'rgba(120,170,235,.55)';
      x.shadowBlur = 5; x.shadowOffsetY = 1.5;
      x.beginPath();
      for (var i = 0; i < L.n; i++) {
        if (L.vas[i] >= 0) continue; // ketjun alku
        var q = i, xs = [], ys = [], bs = [];
        while (q >= 0) { xs.push(L.lx[q]); ys.push(L.ly[q] - L.h[q]); bs.push(L.ly[q] + 1.5); q = L.oik[q]; }
        if (xs.length < 3) continue;
        x.moveTo(xs[0], bs[0]);
        for (var a = 0; a < xs.length; a++) x.lineTo(xs[a], ys[a]);
        for (var b = xs.length - 1; b >= 0; b--) x.lineTo(xs[b], bs[b]);
        x.closePath();
      }
      x.fill();
    }

    return { rakenna: rakenna, laskeudu: laskeudu, puhalla: puhalla, piirra: piirra, box: box };
  })();

  /* ---------- lumisade ---------- */
  var lumi = (function () {
    var c = document.getElementById('lumi');
    var x = c.getContext('2d');
    var W, H, hiutaleet = [], tupsut = [], dpr = 1;

    function uusi(alussa) {
      var syv = Math.random();
      return {
        x: Math.random() * W, y: alussa ? Math.random() * H : -8, ed: 0,
        r: .9 + syv * syv * 2.5, nop: 26 + syv * 62, hetu: Math.random() * 6.28,
        heilu: 12 + Math.random() * 24, alfa: .35 + syv * .6, lahi: syv > .34
      };
    }
    function koko() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      c.width = W * dpr; c.height = H * dpr;
      var maara = Math.round(kiinni(W * H / 7500, 70, 240));
      while (hiutaleet.length < maara) hiutaleet.push(uusi(true));
      hiutaleet.length = maara;
    }
    function tupsu(sx, sy) {
      if (tupsut.length > 240) return;
      tupsut.push({ x: sx, y: sy, vx: (Math.random() - .5) * 90 + tuuli.x * 60, vy: -40 - Math.random() * 90 + tuuli.y * 30, ika: 0, r: .8 + Math.random() * 1.7 });
    }
    var tuuli = { x: 0, y: 0 };

    function askel(dt, t, nakyvyys, boxR, hero) {
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.clearRect(0, 0, W, H);
      x.fillStyle = '#fff';
      tuuli.x *= .94; tuuli.y *= .94;
      for (var i = 0; i < hiutaleet.length; i++) {
        var f = hiutaleet[i];
        f.ed = f.y;
        f.y += f.nop * dt;
        f.x += (Math.sin(t * .7 + f.hetu) * f.heilu + 9 + tuuli.x * 120) * dt;
        if (f.y > H + 8) { hiutaleet[i] = uusi(false); continue; }
        if (f.x < -10) f.x = W + 8; else if (f.x > W + 10) f.x = -8;
        if (hero && f.lahi && f.x >= boxR.left && f.x <= boxR.right && f.y > boxR.top - 42 && f.y < boxR.bottom &&
            kinos.laskeudu(f.x, f.y, f.ed, f.r, boxR)) { hiutaleet[i] = uusi(false); continue; }
        x.globalAlpha = f.alfa * nakyvyys;
        x.beginPath(); x.arc(f.x, f.y, f.r, 0, 6.3); x.fill();
      }
      for (var k = tupsut.length - 1; k >= 0; k--) {
        var p = tupsut[k];
        p.ika += dt;
        if (p.ika > 1.1) { tupsut.splice(k, 1); continue; }
        p.vy += 130 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        x.globalAlpha = .9 * (1 - p.ika / 1.1);
        x.beginPath(); x.arc(p.x, p.y, p.r, 0, 6.3); x.fill();
      }
      x.globalAlpha = 1;
    }
    return { koko: koko, askel: askel, tupsu: tupsu, tuuli: tuuli };
  })();

  /* ---------- osoitin ---------- */
  var ox = -999, oy = -999, tx = 0, ty = 0, hx = 0, hy = 0, edx = null, edy = null;
  addEventListener('pointermove', function (e) {
    ox = e.clientX; oy = e.clientY;
    tx = ox / innerWidth * 2 - 1; ty = oy / innerHeight * 2 - 1;
    if (edx !== null) {
      var vx = ox - edx, vy = oy - edy, v = Math.sqrt(vx * vx + vy * vy);
      lumi.tuuli.x = kiinni(lumi.tuuli.x + vx * .012, -1.6, 1.6);
      lumi.tuuli.y = kiinni(lumi.tuuli.y + vy * .012, -1.6, 1.6);
      if (v > 5) {
        var r = kinos.box.getBoundingClientRect();
        if (ox > r.left - 40 && ox < r.right + 40 && oy > r.top - 80 && oy < r.bottom + 40) {
          kinos.puhalla(ox, oy, r, kiinni(v * 2.2, 26, 72), .55, lumi.tupsu);
        }
      }
    }
    edx = ox; edy = oy;
  }, { passive: true });

  /* ---------- kallistuva puhelin ---------- */
  var kuva = document.querySelector('[data-kallistus]');
  if (kuva && !hiljaa) {
    addEventListener('pointermove', function (e) {
      var r = kuva.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      var x = kiinni((e.clientX - (r.left + r.width / 2)) / innerWidth, -.5, .5);
      var y = kiinni((e.clientY - (r.top + r.height / 2)) / innerHeight, -.5, .5);
      kuva.style.setProperty('--ry', (x * 26).toFixed(2) + 'deg');
      kuva.style.setProperty('--rx', (-y * 18).toFixed(2) + 'deg');
    }, { passive: true });
  }

  /* ---------- vieritys ---------- */
  var naru = document.querySelectorAll('.koristenaru i');
  function vieritys() {
    var y = scrollY, vh = innerHeight;
    var p = kiinni(y / Math.max(1, sankari.offsetHeight - vh), 0, 1);
    sankari.style.setProperty('--p', p.toFixed(4));
    yla.classList.toggle('kiinni', y > 40);
    if (kuva) {
      var r = kuva.getBoundingClientRect();
      kuva.style.setProperty('--peli-s', kiinni((vh / 2 - r.top - r.height / 2) / vh, -1, 1).toFixed(3));
    }
    if (d.classList.contains('vaaka') && !kapea()) {
      var m = maailmat.getBoundingClientRect();
      var q = kiinni(-m.top / Math.max(1, m.height - vh), 0, 1);
      // luvut pysähtyvät hetkeksi omalle kohdalleen
      var v = q * 5, a = Math.floor(v), o = v - a, k = o * o * (3 - 2 * o);
      var siirto = (a + (a >= 5 ? 0 : k)) / 6 * 100;
      raita.style.transform = 'translate3d(' + (-siirto).toFixed(3) + '%,0,0)';
      raita.style.setProperty('--vs', (siirto / 100 * 6).toFixed(3));
      var nyt = Math.round(v);
      naru.forEach(function (n, i) { n.classList.toggle('tama', i === nyt); });
    } else { raita.style.transform = ''; }
  }
  addEventListener('scroll', vieritys, { passive: true });

  /* ---------- videot: vain näkyvissä oleva pyörii ---------- */
  var videot = document.querySelectorAll('.puhelin video');
  if (hiljaa || saasto) {
    videot.forEach(function (v) { v.removeAttribute('loop'); });
  } else if ('IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else { v.pause(); }
      });
    }, { threshold: .55 });
    videot.forEach(function (v) { vio.observe(v); });
  }

  /* ---------- traileri ---------- */
  var dlg = document.getElementById('traileri');
  var dv = dlg.querySelector('video');
  document.getElementById('avaa-traileri').addEventListener('click', function () {
    dlg.showModal(); var p = dv.play(); if (p && p.catch) p.catch(function () {});
  });
  dlg.querySelector('.sulje').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', function () { dv.pause(); });

  /* ---------- päivämäärät ---------- */
  function paivat() {
    var nyt = new Date();
    var fi = d.getAttribute('data-lang') === 'fi';
    var t = document.getElementById('kalenteriteksti');
    var lk = document.getElementById('luukut');
    if (!lk.children.length) {
      [17, 6, 9, 21, 3, 24, 11, 14, 1, 19, 12, 8, 23, 5, 2, 20, 10, 15, 13, 22, 4, 16, 7, 18].forEach(function (nro) {
        var o = document.createElement('i'); o.textContent = nro; o.dataset.pv = nro; lk.appendChild(o);
      });
    }
    var v = 2026, alku = new Date(v, 11, 1), loppu = new Date(v, 11, 25);
    var ero = Math.ceil((alku - nyt) / 864e5);
    if (nyt >= loppu) {
      document.getElementById('kalenterilaskuri').hidden = true;
    } else if (nyt >= alku) {
      var pv = nyt.getDate();
      t.textContent = fi ? 'Luukku ' + pv + ' on auki.' : 'Door ' + pv + ' is open.';
      Array.prototype.forEach.call(lk.children, function (l) { l.classList.toggle('auki', +l.dataset.pv <= pv); });
    } else {
      t.textContent = fi
        ? 'Ensimmäinen luukku aukeaa ' + (ero === 1 ? 'huomenna.' : ero + ' päivän päästä.')
        : 'The first door opens ' + (ero === 1 ? 'tomorrow.' : 'in ' + ero + ' days.');
    }
    var kilpailu = document.getElementById('kilpailu');
    if (nyt >= new Date('2026-11-20T21:00:00+02:00')) kilpailu.hidden = true;
    if (kilpailu.hidden && nyt >= loppu) document.querySelector('.tapahtumat').hidden = true;
  }
  paivat();
  document.addEventListener('kieli', function () { paivat(); kokoLuokat(); });

  /* ---------- pääsilmukka ---------- */
  var taivasNakyy = true;
  if ('IntersectionObserver' in window) {
    var nakyvat = new Set([sankari]);
    var tio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) nakyvat.add(e.target); else nakyvat.delete(e.target); });
      taivasNakyy = nakyvat.size > 0;
    });
    tio.observe(sankari);
    document.querySelectorAll('[data-taivas]').forEach(function (s) { tio.observe(s); });
  }

  function kokoLuokat() {
    if (taivas) taivas.koko();
    lumi.koko();
    kinos.rakenna();
    vieritys();
    if (hiljaa) staattinen();
  }
  function staattinen() {
    if (taivas) taivas.piirra(40, 0, 0, 0);
    kinos.piirra();
  }

  var ed = 0, kierros = 0, alkoi = 0, mx = 0, my = 0, hidas = 0;
  function silmukka(ms) {
    requestAnimationFrame(silmukka);
    if (document.hidden) { ed = ms; return; }
    if (!alkoi) { alkoi = ms; ed = ms; }
    var dt = Math.min((ms - ed) / 1000, .05);
    ed = ms; kierros++;
    var t = (ms / 1000) % 3600;
    if (taivas && !kapea()) { // hitaalla koneella taivaan tarkkuus laskee, liike säilyy
      hidas = dt >= .03 ? hidas + 1 : Math.max(0, hidas - 1);
      if (hidas > 45) { hidas = 0; taivas.kevenna(); }
    }
    hx += (tx - hx) * .05; hy += (ty - hy) * .05;
    mx += (hx - mx) * .08; my += (hy - my) * .08;
    var heroP = parseFloat(sankari.style.getPropertyValue('--p')) || 0;
    if (scrollY < sankari.offsetHeight) {
      sankari.style.setProperty('--hx', hx.toFixed(3));
      sankari.style.setProperty('--hy', hy.toFixed(3));
    }
    if (taivas && taivasNakyy && (!kapea() || kierros % 2 === 0)) taivas.piirra(t, mx, my, heroP);
    var boxR = kinos.box.getBoundingClientRect();
    var heroAuki = heroP < .78 && ms - alkoi > 900;
    lumi.askel(dt, t, kiinni(1 - scrollY / (innerHeight * 6), .45, 1), boxR, heroAuki);
    if (kierros % 2 === 0) kinos.piirra();
  }

  var aika;
  addEventListener('resize', function () { clearTimeout(aika); aika = setTimeout(kokoLuokat, 160); });
  function kaynnista() {
    kokoLuokat();
    if (!hiljaa) requestAnimationFrame(silmukka);
    if (scrollY > 80 || hiljaa) d.classList.add('levossa');
    else setTimeout(function () { d.classList.add('levossa'); }, 2400);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(kaynnista); else kaynnista();
})();

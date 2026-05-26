// ============================================================
// script.js - 3D Background + GitHub Dashboard
// ============================================================

var scene, camera, renderer;
var currentMesh, currentModel;
var lastFetchedEvents = null;
var lastFetchedRepos  = null;
var autoRotationSpeed = 0.005;
var isAutoRotating    = true;
var targetOrbitOffset  = { x: 0, y: 0 };
var currentOrbitOffset = { x: 0, y: 0 };
var baseCameraPos = { x: 5, y: 5, z: 5 };

// ── Date-range filter state (GitHub Dashboard) ──────────────
var ghDateFilter = { start: null, end: null };  // null = no filter

var shapes = {
  cube:       function() { return new THREE.BoxGeometry(2, 2, 2); },
  sphere:     function() { return new THREE.SphereGeometry(1.5, 32, 32); },
  torus:      function() { return new THREE.TorusGeometry(1.5, 0.5, 16, 100); },
  cylinder:   function() { return new THREE.CylinderGeometry(1, 1, 2, 32); },
  octahedron: function() { return new THREE.OctahedronGeometry(1.5); }
};

// ============================================================
// PART 1 — 3D BACKGROUND
// ============================================================

function init() {
  var canvas    = document.getElementById('three-canvas');
  var container = document.querySelector('.canvas-container');

  scene = new THREE.Scene();
  var aspectRatio = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
  camera.position.set(5, 5, 5);

  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = false;
  canvas.style.pointerEvents = 'none';

  addLights();
  loadModel('assets/models/prism.glb', function() {
    console.log('prism.glb failed, showing octahedron instead');
    createShape('octahedron');
  });

  window.addEventListener('resize', onWindowResize);

  setTimeout(function() {
    var loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.classList.add('hidden');
  }, 1000);

  animate();
}

function addLights() {
  var ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambientLight);
  var mainLight = new THREE.DirectionalLight(0xffffff, 1);
  mainLight.position.set(10, 10, 5);
  mainLight.castShadow = true;
  scene.add(mainLight);
  var fillLight = new THREE.DirectionalLight(0x6699ff, 0.3);
  fillLight.position.set(-5, 0, -5);
  scene.add(fillLight);
  var pointLight = new THREE.PointLight(0xff9999, 0.5, 50);
  pointLight.position.set(5, 5, 5);
  scene.add(pointLight);
}

function createShape(shapeType) {
  if (currentMesh) {
    scene.remove(currentMesh);
    currentMesh.geometry.dispose();
    currentMesh.material.dispose();
    currentMesh = null;
  }
  if (currentModel) {
    scene.remove(currentModel);
    disposeModel(currentModel);
    currentModel = null;
  }
  var colorEl = document.getElementById('color-picker');
  var color   = colorEl ? colorEl.value : '#66ccff';
  var geometry = shapes[shapeType]();
  var material = new THREE.MeshPhongMaterial({ color: color, shininess: 100, transparent: true, opacity: 0.9 });
  currentMesh = new THREE.Mesh(geometry, material);
  currentMesh.castShadow = true;
  scene.add(currentMesh);
}

function animate() {
  requestAnimationFrame(animate);
  if (currentModel && isAutoRotating) currentModel.rotation.y += autoRotationSpeed;
  if (currentMesh  && isAutoRotating) {
    currentMesh.rotation.x += autoRotationSpeed;
    currentMesh.rotation.y += autoRotationSpeed * 1.5;
  }
  currentOrbitOffset.x += (targetOrbitOffset.x - currentOrbitOffset.x) * 0.05;
  currentOrbitOffset.y += (targetOrbitOffset.y - currentOrbitOffset.y) * 0.05;
  camera.position.x = baseCameraPos.x + currentOrbitOffset.x * 1.5;
  camera.position.y = baseCameraPos.y + currentOrbitOffset.y * 1.0;
  camera.position.z = baseCameraPos.z;
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
}

function onWindowResize() {
  var container = document.querySelector('.canvas-container');
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function loadModel(url, onError) {
  var loader = new THREE.GLTFLoader();
  loader.load(url,
    function(gltf) {
      if (currentMesh) { scene.remove(currentMesh); currentMesh.geometry.dispose(); currentMesh.material.dispose(); currentMesh = null; }
      if (currentModel) { scene.remove(currentModel); disposeModel(currentModel); }
      currentModel = gltf.scene;
      prepareModel(currentModel);
      scene.add(currentModel);
      zoomCameraToFit(currentModel);
      console.log('Model loaded:', url);
    },
    undefined,
    function(err) { console.warn('Model failed to load:', url, err); if (onError) onError(err); }
  );
}

function prepareModel(model) {
  model.traverse(function(child) {
    if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
  });
  centerAndScaleModel(model, 16);
}

function centerAndScaleModel(model, targetSize) {
  var box    = new THREE.Box3().setFromObject(model);
  var size   = new THREE.Vector3();
  var center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  model.position.sub(center);
  var maxDimension = Math.max(size.x, size.y, size.z);
  if (maxDimension > 0) model.scale.setScalar(targetSize / maxDimension);
}

function zoomCameraToFit(model) {
  var box  = new THREE.Box3().setFromObject(model);
  var size = new THREE.Vector3();
  box.getSize(size);
  var maxDimension = Math.max(size.x, size.y, size.z);
  var distance  = maxDimension * 0.95;
  var direction = new THREE.Vector3(1, 1, 1).normalize();
  camera.position.copy(direction.multiplyScalar(distance));
  camera.fov = 60;
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0, 0);
  baseCameraPos.x = camera.position.x;
  baseCameraPos.y = camera.position.y;
  baseCameraPos.z = camera.position.z;
}

function disposeModel(model) {
  model.traverse(function(child) {
    if (child.isMesh) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          for (var i = 0; i < child.material.length; i++) child.material[i].dispose();
        } else {
          child.material.dispose();
        }
      }
    }
  });
}

function addMouseEffects() {
  window.addEventListener('mousemove', function(event) {
    var normalizedX = (event.clientX / window.innerWidth)  * 2 - 1;
    var normalizedY = (event.clientY / window.innerHeight) * 2 - 1;
    targetOrbitOffset.x =  normalizedX * 0.5;
    targetOrbitOffset.y = -normalizedY * 0.3;
  });

  var canvas = renderer.domElement;
  function updateOpacity() {
    var scrollY     = window.scrollY;
    var maxScroll   = 600;
    var baseOpacity = 0.18;
    var maxOpacity  = 0.35;
    var extra = Math.min(scrollY / maxScroll, 1) * (maxOpacity - baseOpacity);
    canvas.style.opacity = (baseOpacity + extra).toFixed(2);
  }
  window.addEventListener('scroll', updateOpacity);
  updateOpacity();
}


// ============================================================
// PART 2 — DATE-RANGE FILTER UI
// ============================================================

/**
 * Inject the date-range filter bar into the GitHub Dashboard section.
 * Called once from initGithubDashboard() after the form is found.
 */
function injectDateFilterStyles() {
  if (document.getElementById('xaytheon-filter-styles')) return;
  var style = document.createElement('style');
  style.id = 'xaytheon-filter-styles';
  style.textContent = [
    '#gh-date-filter-bar, #contrib-date-filter-bar {',
    '  width: 100%; margin: 0 0 24px 0; position: relative; z-index: 2;',
    '}',

    '#gh-date-filter-bar .xf-bar, #contrib-date-filter-bar .xf-bar {',
    '  display: flex !important; flex-wrap: wrap !important; align-items: center !important;',
    '  gap: 10px !important; padding: 14px 20px 14px 24px !important;',
    '  border-radius: 14px !important; position: relative !important;',
    '  border-left: 3px solid #0ea5e9 !important;',
    '}',

    '#gh-date-filter-bar .xf-label, #contrib-date-filter-bar .xf-label {',
    '  font-size: 11px !important; font-weight: 800 !important; letter-spacing: 1.2px !important;',
    '  text-transform: uppercase !important; color: #0ea5e9 !important;',
    '  white-space: nowrap !important; flex-shrink: 0 !important;',
    '  background: none !important; border: none !important; padding: 0 !important;',
    '  box-shadow: none !important; margin: 0 !important; opacity: 1 !important;',
    '}',

    '#gh-date-filter-bar .xf-div, #contrib-date-filter-bar .xf-div {',
    '  width: 1px !important; height: 20px !important; opacity: 0.3 !important; flex-shrink: 0 !important;',
    '}',

    '#gh-date-filter-bar .xf-presets, #contrib-date-filter-bar .xf-presets {',
    '  display: flex !important; flex-wrap: wrap !important; gap: 5px !important; align-items: center !important;',
    '}',

    '#gh-date-filter-bar .xf-btn, #contrib-date-filter-bar .xf-btn {',
    '  display: inline-block !important; padding: 6px 14px !important;',
    '  font-size: 12.5px !important; font-family: inherit !important; font-weight: 700 !important;',
    '  border-radius: 8px !important; cursor: pointer !important;',
    '  white-space: nowrap !important; line-height: 1.4 !important;',
    '  opacity: 1 !important; text-decoration: none !important;',
    '  background: transparent !important; color: inherit !important;',
    '  transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.1s !important;',
    '}',
    '#gh-date-filter-bar .xf-btn::before, #contrib-date-filter-bar .xf-btn::before {',
    '  display: none !important;',
    '}',
    '#gh-date-filter-bar .xf-btn:hover, #contrib-date-filter-bar .xf-btn:hover {',
    '  background: rgba(14,165,233,0.12) !important; color: #0ea5e9 !important;',
    '  border-color: rgba(14,165,233,0.6) !important; transform: translateY(-1px) !important;',
    '  box-shadow: 0 2px 8px rgba(14,165,233,0.2) !important; opacity: 1 !important;',
    '}',
    '#gh-date-filter-bar .xf-btn.xf-active, #contrib-date-filter-bar .xf-btn.xf-active {',
    '  background: #0ea5e9 !important; border-color: #0ea5e9 !important;',
    '  color: #fff !important; box-shadow: 0 2px 10px rgba(14,165,233,0.4) !important;',
    '  transform: translateY(-1px) !important; opacity: 1 !important;',
    '}',

    '#gh-date-filter-bar .xf-badge, #contrib-date-filter-bar .xf-badge {',
    '  display: inline-flex !important; align-items: center !important; gap: 6px !important;',
    '  padding: 5px 12px !important; font-size: 12px !important; font-weight: 700 !important;',
    '  background: rgba(14,165,233,0.12) !important; border: 1px solid rgba(14,165,233,0.35) !important;',
    '  border-radius: 999px !important; color: #0ea5e9 !important; white-space: nowrap !important;',
    '}',

    '#gh-date-filter-bar .xf-clear, #contrib-date-filter-bar .xf-clear {',
    '  display: inline-flex !important; align-items: center !important; justify-content: center !important;',
    '  width: 16px !important; height: 16px !important; border-radius: 50% !important;',
    '  background: rgba(14,165,233,0.22) !important; border: none !important;',
    '  color: #0ea5e9 !important; cursor: pointer !important; font-size: 10px !important;',
    '  padding: 0 !important; opacity: 1 !important; flex-shrink: 0 !important;',
    '}',
    '#gh-date-filter-bar .xf-clear::before, #contrib-date-filter-bar .xf-clear::before {',
    '  display: none !important;',
    '}',

    '#gh-date-filter-bar .xf-custom, #contrib-date-filter-bar .xf-custom {',
    '  width: 100% !important; display: flex !important; flex-wrap: wrap !important;',
    '  align-items: flex-end !important; gap: 10px !important;',
    '  padding-top: 12px !important; border-top: 1px dashed rgba(14,165,233,0.3) !important;',
    '}',

    '#gh-date-filter-bar .xf-inp-wrap, #contrib-date-filter-bar .xf-inp-wrap {',
    '  display: flex !important; flex-direction: column !important; gap: 4px !important;',
    '}',
    '#gh-date-filter-bar .xf-inp-wrap label, #contrib-date-filter-bar .xf-inp-wrap label {',
    '  font-size: 11px !important; font-weight: 800 !important; letter-spacing: 1px !important;',
    '  text-transform: uppercase !important; color: #0ea5e9 !important;',
    '}',
    '#gh-date-filter-bar .xf-inp-wrap input, #contrib-date-filter-bar .xf-inp-wrap input {',
    '  padding: 8px 12px !important; font-size: 13px !important; font-family: inherit !important;',
    '  border-radius: 8px !important; outline: none !important;',
    '  min-width: 148px !important; line-height: 1.4 !important; opacity: 1 !important;',
    '}',

    '#gh-date-filter-bar .xf-apply, #contrib-date-filter-bar .xf-apply {',
    '  padding: 8px 20px !important; font-size: 13px !important; font-family: inherit !important;',
    '  font-weight: 800 !important; border-radius: 8px !important; border: none !important;',
    '  background: #0ea5e9 !important; color: #fff !important; cursor: pointer !important;',
    '  align-self: flex-end !important; opacity: 1 !important; white-space: nowrap !important;',
    '  box-shadow: 0 2px 10px rgba(14,165,233,0.32) !important;',
    '}',
    '#gh-date-filter-bar .xf-apply::before, #contrib-date-filter-bar .xf-apply::before {',
    '  display: none !important;',
    '}',
    '#gh-date-filter-bar .xf-apply:hover, #contrib-date-filter-bar .xf-apply:hover {',
    '  opacity: 0.85 !important; transform: translateY(-1px) !important;',
    '}',

    '#gh-filtered-count, #contrib-filter-count {',
    '  font-size: 12px !important; opacity: 0.5 !important; text-align: right !important;',
    '  margin: -16px 0 16px !important; font-style: italic !important;',
    '}',
  ].join('\n');
  document.head.appendChild(style);
}

function injectDateFilterBar() {
  var form = document.getElementById('github-form');
  if (!form) return;

  // Inject styles via JS — bypasses all CSS file loading issues
  injectDateFilterStyles();

  // Detect theme for dynamic colors
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var bgColor     = isDark ? '#0d1117' : '#ffffff';
  var borderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  var textColor   = isDark ? '#ffffff' : '#000000';
  var divColor    = isDark ? '#ffffff' : '#000000';

  var bar = document.createElement('div');
  bar.id = 'gh-date-filter-bar';

  var barDiv = document.createElement('div');
  barDiv.className = 'xf-bar';
  barDiv.style.cssText = [
    'background:' + bgColor,
    'border:1px solid ' + borderColor,
    'box-shadow: 0 2px 12px rgba(0,0,0,0.08)',
  ].join(';');

  barDiv.innerHTML = [
    '<span class="xf-label">Filter range</span>',
    '<div class="xf-div" style="background:' + divColor + '"></div>',
    '<div class="xf-presets">',
    '  <button class="xf-btn xf-active" style="border:1px solid ' + borderColor + '" data-days="0">All time</button>',
    '  <button class="xf-btn" style="border:1px solid ' + borderColor + '" data-days="7">7 days</button>',
    '  <button class="xf-btn" style="border:1px solid ' + borderColor + '" data-days="30">30 days</button>',
    '  <button class="xf-btn" style="border:1px solid ' + borderColor + '" data-days="90">3 months</button>',
    '  <button class="xf-btn" style="border:1px solid ' + borderColor + '" data-days="365">1 year</button>',
    '</div>',
    '<div class="xf-badge" id="gh-filter-badge" style="display:none">',
    '  <span id="gh-filter-badge-text"></span>',
    '  <button class="xf-clear" id="gh-date-clear-filter">✕</button>',
    '</div>',
    '<div class="xf-custom" id="gh-custom-range" style="display:none">',
    '  <div class="xf-inp-wrap">',
    '    <label>From</label>',
    '    <input type="date" id="gh-date-start" style="border:1px solid ' + borderColor + ';background:' + bgColor + ';color:' + textColor + '" />',
    '  </div>',
    '  <div class="xf-inp-wrap">',
    '    <label>To</label>',
    '    <input type="date" id="gh-date-end" style="border:1px solid ' + borderColor + ';background:' + bgColor + ';color:' + textColor + '" />',
    '  </div>',
    '  <button class="xf-apply" id="gh-date-apply">Apply</button>',
    '</div>',
  ].join('\n');

  bar.appendChild(barDiv);

  // Insert BEFORE the github-grid
  var grid = document.querySelector('.github-grid');
  if (grid) {
    grid.parentNode.insertBefore(bar, grid);
  } else {
    form.parentNode.insertBefore(bar, form.nextSibling);
  }

  // Wire up preset buttons
  bar.querySelectorAll('.xf-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      bar.querySelectorAll('.xf-btn').forEach(function(b) { b.classList.remove('xf-active'); b.style.background = 'transparent'; b.style.color = 'inherit'; b.style.borderColor = ''; });
      btn.classList.add('xf-active');
      btn.style.background = '#0ea5e9';
      btn.style.color = '#fff';
      btn.style.borderColor = '#0ea5e9';

      var days = btn.getAttribute('data-days');
      var customRange = document.getElementById('gh-custom-range');

      if (days === 'custom') {
        customRange.style.display = 'flex';
        return;
      }

      customRange.style.display = 'none';

      if (days === '0') {
        ghDateFilter = { start: null, end: null };
        updateFilterBadge(null, null);
      } else {
        var end   = new Date();
        var start = new Date(Date.now() - parseInt(days) * 86400000);
        ghDateFilter = { start: start, end: end };
        updateFilterBadge(start, end);
      }

      applyDateFilterAndRender();
    });
  });

  // Wire up custom range apply
  document.getElementById('gh-date-apply').addEventListener('click', function() {
    var startVal = document.getElementById('gh-date-start').value;
    var endVal   = document.getElementById('gh-date-end').value;

    if (!startVal && !endVal) {
      ghDateFilter = { start: null, end: null };
      updateFilterBadge(null, null);
    } else {
      var start = startVal ? new Date(startVal + 'T00:00:00') : null;
      var end   = endVal   ? new Date(endVal   + 'T23:59:59') : new Date();
      if (start && end && start > end) {
        alert('Start date must be before end date.');
        return;
      }
      ghDateFilter = { start: start, end: end };
      updateFilterBadge(start, end);
    }

    applyDateFilterAndRender();
  });

  // Wire up clear button
  document.getElementById('gh-date-clear-filter').addEventListener('click', function() {
    ghDateFilter = { start: null, end: null };
    updateFilterBadge(null, null);
    bar.querySelectorAll('.xf-btn').forEach(function(b) { b.classList.remove('xf-active'); b.style.background='transparent'; b.style.color='inherit'; b.style.borderColor=''; });
    var allTime = bar.querySelector('[data-days="0"]');
    if (allTime) { allTime.classList.add('xf-active'); allTime.style.background='#0ea5e9'; allTime.style.color='#fff'; allTime.style.borderColor='#0ea5e9'; }
    document.getElementById('gh-custom-range').style.display = 'none';
    applyDateFilterAndRender();
  });
}

/** Update the "active filter" badge text */
function updateFilterBadge(start, end) {
  var badge    = document.getElementById('gh-filter-badge');
  var badgeTxt = document.getElementById('gh-filter-badge-text');
  if (!badge || !badgeTxt) return;

  if (!start && !end) {
    badge.style.display = 'none';
    badgeTxt.textContent = '';
    return;
  }

  var fmt = function(d) {
    return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '…';
  };
  badgeTxt.textContent = fmt(start) + ' → ' + fmt(end);
  badge.style.display = 'inline-flex';
}

/** Filter an array of GitHub events by the current ghDateFilter */
function filterEventsByDate(events) {
  if (!events) return [];
  if (!ghDateFilter.start && !ghDateFilter.end) return events;

  return events.filter(function(ev) {
    if (!ev.created_at) return true;
    var d = new Date(ev.created_at);
    if (ghDateFilter.start && d < ghDateFilter.start) return false;
    if (ghDateFilter.end   && d > ghDateFilter.end)   return false;
    return true;
  });
}

/** Filter an array of repos by the current ghDateFilter (uses updated_at) */
function filterReposByDate(repos) {
  if (!repos) return [];
  if (!ghDateFilter.start && !ghDateFilter.end) return repos;

  return repos.filter(function(repo) {
    var d = new Date(repo.updated_at || repo.pushed_at || repo.created_at);
    if (ghDateFilter.start && d < ghDateFilter.start) return false;
    if (ghDateFilter.end   && d > ghDateFilter.end)   return false;
    return true;
  });
}

/** Re-render dashboard cards using cached data + current filter */
function applyDateFilterAndRender() {
  if (!lastFetchedEvents && !lastFetchedRepos) return;

  var filteredEvents = filterEventsByDate(lastFetchedEvents || []);
  var filteredRepos  = filterReposByDate(lastFetchedRepos  || []);

  // Update activity count badge
  var countBadge = document.getElementById('gh-filtered-count');
  if (countBadge) {
    var total    = (lastFetchedEvents || []).length;
    var filtered = filteredEvents.length;
    countBadge.textContent = (ghDateFilter.start || ghDateFilter.end)
      ? filtered + ' / ' + total + ' events in range'
      : '';
  }

  renderRepos(filteredRepos.slice(0, 8));
  renderActivity(filteredEvents.slice(0, 10));
  showContributionsChart(
    localStorage.getItem('xaytheon:ghUsername') || '',
    filteredEvents
  );
}


// ============================================================
// PART 3 — GITHUB DASHBOARD
// ============================================================

function initGithubDashboard() {
  var form = document.getElementById('github-form');
  if (!form) return;

  var usernameInput = document.getElementById('gh-username');
  var clearBtn      = document.getElementById('gh-clear');

  // Inject the date filter bar
  injectDateFilterBar();

  // Add event count info element (injected below the grid later)
  var grid = document.querySelector('.github-grid');
  if (grid) {
    var infoEl = document.createElement('div');
    infoEl.id = 'gh-filtered-count';
    infoEl.style.cssText = 'grid-column:1/-1; text-align:right; font-size:0.82em; opacity:0.6; margin-top:-8px;';
    grid.parentNode.insertBefore(infoEl, grid);
  }

  var savedUsername = localStorage.getItem('xaytheon:ghUsername');
  if (savedUsername) {
    usernameInput.value = savedUsername;
    loadGithubDashboard(savedUsername);
  }

  form.addEventListener('submit', function(event) {
    event.preventDefault();
    var username = usernameInput.value.trim();
    if (!username) { setGithubStatus('Please enter a GitHub username.', true); return; }
    localStorage.setItem('xaytheon:ghUsername', username);
    loadGithubDashboard(username);
  });

  clearBtn.addEventListener('click', function() {
    localStorage.removeItem('xaytheon:ghUsername');
    usernameInput.value = '';
    lastFetchedEvents = null;
    lastFetchedRepos  = null;
    ghDateFilter      = { start: null, end: null };

    setText('gh-name',         '—');
    setText('gh-login',        '—');
    setText('gh-bio',          '');
    setText('gh-followers',    '0');
    setText('gh-following',    '0');
    setText('gh-repos-count',  '0');
    setHtml('gh-repo-list',    '');
    setHtml('gh-activity-list','');
    setHtml('gh-contrib-svg',  '');

    var noteEl = document.getElementById('gh-contrib-note');
    if (noteEl) noteEl.textContent = 'Enter a username and press Load Dashboard.';

    var countEl = document.getElementById('gh-filtered-count');
    if (countEl) countEl.textContent = '';

    // Reset filter UI
    var bar = document.getElementById('gh-date-filter-bar');
    if (bar) {
      bar.querySelectorAll('.date-preset-btn').forEach(function(b) { b.classList.remove('active'); });
      var allTimeBtn = bar.querySelector('[data-days="0"]');
      if (allTimeBtn) allTimeBtn.classList.add('active');
      var customRange = document.getElementById('gh-custom-range');
      if (customRange) customRange.style.display = 'none';
      updateFilterBadge(null, null);
    }

    setGithubStatus('Dashboard cleared.');
  });
}

async function loadGithubDashboard(username) {
  setGithubStatus('Loading profile…');

  try {
    var user = await fetchFromGitHub(
      'https://api.github.com/users/' + encodeURIComponent(username)
    );

    var avatarEl = document.getElementById('gh-avatar');
    if (avatarEl) avatarEl.src = user.avatar_url;

    setText('gh-name',      user.name  || '—');
    setText('gh-login',     '@' + user.login);
    setText('gh-bio',       user.bio   || '');
    setText('gh-followers', user.followers || 0);
    setText('gh-following', user.following || 0);

    setGithubStatus('Loading repositories…');
    var repos = await fetchFromGitHub(
      'https://api.github.com/users/' + encodeURIComponent(username) +
      '/repos?per_page=100&sort=updated'
    );

    setText('gh-repos-count', user.public_repos || repos.length);

    var ownRepos = [];
    for (var i = 0; i < repos.length; i++) {
      if (!repos[i].fork) ownRepos.push(repos[i]);
    }
    ownRepos.sort(function(a, b) {
      return (b.stargazers_count || 0) - (a.stargazers_count || 0);
    });

    // Cache all repos before filtering
    lastFetchedRepos = ownRepos;

    setGithubStatus('Loading activity…');
    var events = await fetchFromGitHub(
      'https://api.github.com/users/' + encodeURIComponent(username) +
      '/events/public?per_page=100'
    );

    // Cache all events before filtering
    lastFetchedEvents = events;

    // Apply current filter (may be "all time") and render
    applyDateFilterAndRender();

    setGithubStatus('Done');

  } catch (error) {
    setGithubStatus(error.message || 'Failed to load GitHub data', true);
  }
}

async function fetchFromGitHub(url) {
  var response = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'XAYTHEON-Dashboard' }
  });
  if (!response.ok) {
    var errorText = await response.text();
    throw new Error('GitHub API ' + response.status + ': ' + errorText);
  }
  return response.json();
}

function renderRepos(repos) {
  var list = document.getElementById('gh-repo-list');
  if (!list) return;

  if (!repos || repos.length === 0) {
    list.innerHTML = '<div class="muted">No repositories found in this date range.</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < repos.length; i++) {
    var repo = repos[i];
    var description = repo.description
      ? '<div class="repo-desc">' + safeHtml(repo.description) + '</div>' : '';
    var language = repo.language
      ? '<span>' + safeHtml(repo.language) + '</span>' : '';

    html +=
      '<div class="repo-item">' +
        '<div class="repo-name"><a href="' + repo.html_url + '" target="_blank" rel="noopener">' +
          safeHtml(repo.full_name) + '</a></div>' +
        description +
        '<div class="repo-meta">' +
          '<span>★ ' + (repo.stargazers_count || 0) + '</span>' +
          '<span>⑂ ' + (repo.forks_count     || 0) + '</span>' +
          language +
          '<span>Updated ' + timeAgo(repo.updated_at) + '</span>' +
        '</div>' +
      '</div>';
  }
  list.innerHTML = html;
}

function renderActivity(events) {
  var list = document.getElementById('gh-activity-list');
  if (!list) return;

  if (!events || events.length === 0) {
    list.innerHTML = '<li class="activity-item muted">No activity in this date range.</li>';
    return;
  }

  var html = '';
  for (var i = 0; i < events.length; i++) {
    var ev       = events[i];
    var repoName = ev.repo ? ev.repo.name : '';
    var desc     = describeEvent(ev);
    var time     = timeAgo(ev.created_at);
    var repoLink = repoName
      ? ' in <a href="https://github.com/' + repoName + '" target="_blank" rel="noopener">' +
          safeHtml(repoName) + '</a>' : '';

    html +=
      '<li class="activity-item">' +
        '<div>' + safeHtml(desc) + repoLink + '</div>' +
        '<div class="activity-time">' + time + '</div>' +
      '</li>';
  }
  list.innerHTML = html;
}

function describeEvent(ev) {
  if (ev.type === 'PushEvent') {
    var count = ev.payload && ev.payload.commits ? ev.payload.commits.length : 0;
    return 'Pushed ' + count + ' commit(s)';
  }
  if (ev.type === 'CreateEvent') {
    var refType = ev.payload ? (ev.payload.ref_type || '') : '';
    var ref     = ev.payload ? (ev.payload.ref      || '') : '';
    return 'Created ' + refType + ' ' + ref;
  }
  if (ev.type === 'IssuesEvent') {
    var action = ev.payload ? (ev.payload.action || '') : '';
    var num    = ev.payload && ev.payload.issue ? ev.payload.issue.number : '';
    return 'Issue ' + action + ' #' + num;
  }
  if (ev.type === 'PullRequestEvent') {
    var action = ev.payload ? (ev.payload.action || '') : '';
    var num    = ev.payload && ev.payload.pull_request ? ev.payload.pull_request.number : '';
    return 'Pull request ' + action + ' #' + num;
  }
  if (ev.type === 'WatchEvent') return 'Starred a repository';
  if (ev.type === 'ForkEvent')  return 'Forked a repository';
  return ev.type;
}

function showContributionsChart(username, events) {
  var container = document.getElementById('gh-contrib-svg');
  var noteEl    = document.getElementById('gh-contrib-note');
  if (!container) return;

  // If a date filter is active, skip the third-party image and use local heatmap
  if (ghDateFilter.start || ghDateFilter.end) {
    var svgHtml = buildHeatmapFromEvents(events);
    container.innerHTML = svgHtml;
    if (noteEl) noteEl.textContent = 'Filtered heatmap based on selected date range.';
    return;
  }

  container.innerHTML = '<div class="muted">Loading contributions chart…</div>';

  var chartImg = new Image();
  chartImg.alt            = username + "'s contributions";
  chartImg.style.maxWidth = '100%';
  chartImg.referrerPolicy = 'no-referrer';

  chartImg.onload = function() {
    container.innerHTML = '';
    container.appendChild(chartImg);
    if (noteEl) noteEl.textContent = 'Full-year contribution chart.';
  };

  chartImg.onerror = function() {
    var svgHtml = buildHeatmapFromEvents(events);
    container.innerHTML = svgHtml;
    if (noteEl) noteEl.textContent = 'Approximate heatmap based on recent public activity.';
  };

  var theme = document.documentElement.getAttribute('data-theme') || 'light';
  chartImg.src = 'https://kusa-image.deno.dev/' + encodeURIComponent(username) + '?theme=' + theme;

  if (chartImg.complete) {
    if (chartImg.naturalWidth > 0) chartImg.onload();
    else chartImg.onerror();
  }
}

function buildHeatmapFromEvents(events) {
  if (!events || events.length === 0) {
    return '<div class="muted">No activity in this range.</div>';
  }

  // Determine the date window: filter range or last 90 days
  var endDate, startDate, daysBack;

  if (ghDateFilter.start || ghDateFilter.end) {
    endDate   = ghDateFilter.end   || new Date();
    startDate = ghDateFilter.start || new Date(endDate.getTime() - 90 * 86400000);
    daysBack  = Math.ceil((endDate - startDate) / 86400000);
  } else {
    daysBack  = 90;
    endDate   = new Date();
    startDate = new Date(Date.now() - daysBack * 86400000);
  }

  // Build day map
  var dayCounts = {};
  for (var d = 0; d <= daysBack; d++) {
    var dayDate = new Date(startDate.getTime() + d * 86400000);
    var key = dayDate.toISOString().slice(0, 10);
    dayCounts[key] = 0;
  }

  for (var i = 0; i < events.length; i++) {
    if (!events[i].created_at) continue;
    var eventDate = new Date(events[i].created_at);
    var key = eventDate.toISOString().slice(0, 10);
    if (dayCounts[key] !== undefined) dayCounts[key]++;
  }

  var days = Object.keys(dayCounts).sort();
  if (days.length === 0) return '<div class="muted">No activity data.</div>';

  var maxCount = 1;
  for (var i = 0; i < days.length; i++) {
    if (dayCounts[days[i]] > maxCount) maxCount = dayCounts[days[i]];
  }

  var colors = ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127'];
  if (document.documentElement.getAttribute('data-theme') === 'dark') colors[0] = '#2d333b';

  var cellSize   = 10;
  var gap        = 2;
  var firstDay   = new Date(days[0] + 'T00:00:00Z');
  var startOffset = firstDay.getUTCDay();
  var totalCells  = days.length + startOffset;
  var numCols     = Math.ceil(totalCells / 7);
  var svgWidth    = numCols * (cellSize + gap) + gap;
  var svgHeight   = 7 * (cellSize + gap) + gap + 20;

  var rects = '';
  for (var col = 0; col < numCols; col++) {
    for (var row = 0; row < 7; row++) {
      var dayIndex = col * 7 + row - startOffset;
      if (dayIndex < 0 || dayIndex >= days.length) continue;
      var day      = days[dayIndex];
      var count    = dayCounts[day] || 0;
      var colorIdx = count === 0 ? 0 : Math.min(4, Math.ceil((count / maxCount) * 4));
      var x        = gap + col * (cellSize + gap);
      var y        = gap + row * (cellSize + gap);
      rects +=
        '<rect x="' + x + '" y="' + y + '" width="' + cellSize + '" height="' + cellSize + '"' +
        ' rx="2" fill="' + colors[colorIdx] + '">' +
          '<title>' + day + ': ' + count + ' event(s)</title>' +
        '</rect>';
    }
  }

  var labelText = (ghDateFilter.start || ghDateFilter.end)
    ? 'Filtered range (' + daysBack + ' days)'
    : 'Last ' + daysBack + ' days (approx.)';

  var label =
    '<text x="' + gap + '" y="' + (svgHeight - 4) + '" font-size="10" fill="#666">' +
      labelText +
    '</text>';

  return '<svg width="' + svgWidth + '" height="' + svgHeight + '"' +
         ' viewBox="0 0 ' + svgWidth + ' ' + svgHeight + '"' +
         ' xmlns="http://www.w3.org/2000/svg">' +
           rects + label +
         '</svg>';
}


// ============================================================
// PART 4 — MINI 3D VIEWER
// ============================================================

function initMiniViewer() {
  var canvas = document.getElementById('mini-3d-canvas');
  if (!canvas) return;

  if (typeof THREE === 'undefined' || !THREE.GLTFLoader) {
    var loadingEl = canvas.parentElement.querySelector('.mini-3d-loading');
    if (loadingEl) loadingEl.textContent = '3D unavailable';
    return;
  }

  var container = canvas.parentElement;
  var loadingEl = container.querySelector('.mini-3d-loading');

  var miniScene    = new THREE.Scene();
  var miniCamera   = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  var miniRenderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  miniRenderer.setClearColor(0x000000, 0);

  miniCamera.position.set(2.2, 1.8, 2.2);
  miniCamera.lookAt(0, 0, 0);

  function resizeMini() {
    var w = container.clientWidth;
    var h = container.clientHeight;
    miniRenderer.setSize(w, h);
    miniCamera.aspect = w / h;
    miniCamera.updateProjectionMatrix();
  }
  resizeMini();
  window.addEventListener('resize', resizeMini);

  miniScene.add(new THREE.AmbientLight(0xffffff, 0.9));
  var dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(3, 5, 2);
  miniScene.add(dirLight);

  var loader = new THREE.GLTFLoader();
  loader.load(
    'assets/models/github.glb',
    function(gltf) {
      var model = gltf.scene;
      centerAndScaleModel(model, 3.0);

      var pivot = new THREE.Object3D();
      miniScene.add(pivot);
      pivot.add(model);

      if (loadingEl) loadingEl.style.display = 'none';

      var box  = new THREE.Box3().setFromObject(model);
      var size = new THREE.Vector3();
      box.getSize(size);
      var maxDim = Math.max(size.x, size.y, size.z) || 1;
      var dist   = maxDim * 1.8;
      miniCamera.position.set(dist, dist * 0.8, dist);
      miniCamera.lookAt(0, 0, 0);

      function animateMini() {
        requestAnimationFrame(animateMini);
        pivot.rotation.y += 0.012;
        miniRenderer.render(miniScene, miniCamera);
      }
      animateMini();
    },
    undefined,
    function(err) {
      console.warn('Mini viewer: model failed to load', err);
      if (loadingEl) loadingEl.textContent = '3D not found';
    }
  );
}


// ============================================================
// PART 5 — SHARED UTILITIES
// ============================================================

function safeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function setText(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setHtml(id, value) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = value;
}

function setGithubStatus(message, isError) {
  var el = document.getElementById('github-status');
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? '#b91c1c' : '#111827';
}

function timeAgo(dateString) {
  var secondsAgo = Math.floor((Date.now() - new Date(dateString)) / 1000);
  if (secondsAgo < 60)       return 'just now';
  if (secondsAgo < 3600)     return Math.floor(secondsAgo / 60)      + ' minutes ago';
  if (secondsAgo < 86400)    return Math.floor(secondsAgo / 3600)    + ' hours ago';
  if (secondsAgo < 2592000)  return Math.floor(secondsAgo / 86400)   + ' days ago';
  if (secondsAgo < 31536000) return Math.floor(secondsAgo / 2592000) + ' months ago';
  return Math.floor(secondsAgo / 31536000) + ' years ago';
}


// ============================================================
// PART 6 — START EVERYTHING
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
  var canvas = document.getElementById('three-canvas');
  if (canvas) { init(); addMouseEffects(); }

  initGithubDashboard();
  initMiniViewer();
});

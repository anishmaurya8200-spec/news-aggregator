// Get API base URL from window location or fallback
const API_BASE_URL = (() => {
  // If opened via file://, use localhost:5000
  if (window.location.protocol === 'file:') {
    return 'http://localhost:5000';
  }
  // If on localhost, use localhost:5000
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  // Otherwise construct from current host
  return `${window.location.protocol}//${window.location.host.split(':')[0]}:5000`;
})();

let articles = [];
let currentCat = 'all';
let searchTerm = '';
let uploadedImageFile = null;
let extractedImageText = '';

// Fetch news from backend
async function fetchNews(query = "") {
  try {
    const url = query && query.trim()
      ? `${API_BASE_URL}/api/news?q=${encodeURIComponent(query.trim())}`
      : `${API_BASE_URL}/api/news`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();

    articles = data;
    searchTerm = query.trim().toLowerCase();
    
    // Map API credStatus to badge type
    articles.forEach(article => {
      if (article.credStatus) {
        // Backend returns: "real" (Verified), "unknown" (Caution), "fake" (Likely False)
        const statusMap = {
          "real": "verified",
          "unknown": "caution",
          "fake": "fake"
        };
        article.credBadge = statusMap[article.credStatus] || "caution";
      } else {
        article.credBadge = "caution";  // Default fallback
      }
    });
    
    renderCards();

  } catch (err) {
    console.error("Error fetching news:", err);
    showError("Failed to load news articles. Please refresh the page.");
  }
}

// Show error message to user
function showError(msg) {
  const grid = document.getElementById('cardsGrid');
  if (grid) {
    grid.innerHTML = `<div class="error-state" style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--danger);">${escapeHtml(msg)}</div>`;
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Validate image URL
function isValidImageUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return /^https?:/.test(u.protocol) && /\.(jpg|jpeg|png|gif|webp)$/i.test(u.pathname);
  } catch (e) {
    return false;
  }
}

// Create safe image element
function createImageElement(src) {
  const img = document.createElement('img');
  img.alt = 'news image';
  img.onerror = () => {
    // Replace with placeholder if image fails
    img.style.display = 'none';
  };
  
  if (isValidImageUrl(src)) {
    img.src = src;
  }
  
  return img;
}

// Credibility badge
function credBadge(cred) {
  const badges = {
    verified: { html: '<div class="cred-dot"></div>Verified', class: 'cred-verified' },
    caution: { html: '<div class="cred-dot"></div>Caution', class: 'cred-caution' },
    fake: { html: '<div class="cred-dot"></div>Likely False', class: 'cred-fake' }
  };
  
  const badge = badges[cred] || badges.caution;
  return `<div class="cred-badge ${badge.class}">${badge.html}</div>`;
}

// Render cards
function renderCards() {
  const grid = document.getElementById('cardsGrid');

  const filtered = articles.filter(a => {
    const catMatch = currentCat === 'all' || a.cat === currentCat;
    const searchMatch =
      !searchTerm ||
      (a.title && a.title.toLowerCase().includes(searchTerm)) ||
      (a.desc && a.desc.toLowerCase().includes(searchTerm));

    return catMatch && searchMatch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <h3>No articles found</h3>
        <p>Try adjusting your filters or search term.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = '';
  
  filtered.forEach((a, i) => {
    const card = document.createElement('div');
    card.className = `news-card cat-${escapeHtml(a.cat)}`;
    card.style.animationDelay = `${i * 0.08}s`;

    const imgContainer = document.createElement('div');
    imgContainer.className = 'card-img';
    
    if (isValidImageUrl(a.image)) {
      imgContainer.appendChild(createImageElement(a.image));
    }

    const body = document.createElement('div');
    body.className = 'card-body';

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    
    const catTag = document.createElement('span');
    catTag.className = 'category-tag';
    catTag.textContent = escapeHtml(a.cat);
    
    meta.appendChild(catTag);
    meta.innerHTML += credBadge(a.credBadge || 'caution');

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = a.title || 'No Title';

    const desc = document.createElement('div');
    desc.className = 'card-desc';
    desc.textContent = a.desc || 'No description available';

    const footer = document.createElement('div');
    footer.className = 'card-footer';

    const source = document.createElement('div');
    source.className = 'card-source';
    source.innerHTML = `<div class="source-dot"></div>`;
    const sourceName = document.createElement('span');
    sourceName.textContent = escapeHtml(a.source || 'Unknown');
    source.appendChild(sourceName);

    const readBtn = document.createElement('button');
    readBtn.className = 'read-btn';
    readBtn.textContent = 'Read →';
    readBtn.onclick = (e) => {
      e.preventDefault();
      if (a.url) window.open(a.url, '_blank');
    };

    footer.appendChild(source);
    footer.appendChild(readBtn);

    const time = document.createElement('div');
    time.className = 'card-time';
    time.textContent = a.time || 'just now';

    body.appendChild(meta);
    body.appendChild(title);
    body.appendChild(desc);
    body.appendChild(footer);
    body.appendChild(time);

    card.appendChild(imgContainer);
    card.appendChild(body);
    
    grid.appendChild(card);
  });
}

// Call on page load
fetchNews();

// Category filter
function filterCat(cat, btn) {
  currentCat = cat;

  document.querySelectorAll('.filter-btn')
    .forEach(b => b.classList.remove('active'));

  btn.classList.add('active');

  renderCards();
}

// Search filter
function filterSearch() {
  const query = document
    .getElementById('searchInput')
    ?.value || '';

  searchTerm = query.toLowerCase().trim();
  fetchNews(query);
}

// Search on Enter key
function handleSearchKey(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    filterSearch();
  }
}

const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('keydown', handleSearchKey);
}

function handleImageUpload(event) {
  const file = event.target.files?.[0] || null;
  uploadedImageFile = file;
  extractedImageText = '';

  const previewWrapper = document.getElementById('imagePreviewWrapper');
  const previewImg = document.getElementById('imagePreview');
  const imageInfo = document.getElementById('imageInfo');
  const extractedTextEl = document.getElementById('imageExtractedText');

  if (!file) {
    if (previewWrapper) previewWrapper.style.display = 'none';
    if (imageInfo) imageInfo.textContent = '';
    if (extractedTextEl) extractedTextEl.style.display = 'none';
    return;
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
  if (!validTypes.includes(file.type)) {
    showCheckerError('Please upload a valid image file (jpg, png, webp, gif, bmp).');
    event.target.value = '';
    return;
  }

  if (previewWrapper && previewImg && imageInfo) {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewWrapper.style.display = 'flex';
      imageInfo.innerHTML = `<strong>${escapeHtml(file.name)}</strong><br>${file.type} · ${(file.size / 1024).toFixed(1)} KB`;
    };
    reader.readAsDataURL(file);
  }

  if (extractedTextEl) {
    extractedTextEl.style.display = 'block';
    extractedTextEl.innerHTML = `
      <div class="ocr-loading">
        <div class="ocr-spinner"></div>
        <p>Please wait while we extract text from your image...</p>
      </div>
    `;
  }

  if (window.Tesseract && typeof window.Tesseract.recognize === 'function') {
    window.Tesseract.recognize(file, 'eng')
      .then((result) => {
        extractedImageText = result.data.text.trim();
        if (extractedTextEl) {
          if (extractedImageText.length > 0) {
            extractedTextEl.innerHTML = `
              <div class="ocr-success">
                <div class="success-icon">✅</div>
                <p>Text extracted successfully! Now click on the "Analyze" button to check credibility.</p>
              </div>
            `;
          } else {
            extractedTextEl.innerHTML = `
              <div class="ocr-error">
                <div class="error-icon">⚠️</div>
                <p>No readable text found in the uploaded image. Please try a different image or paste text manually.</p>
              </div>
            `;
          }
        }
      })
      .catch(() => {
        if (extractedTextEl) {
          extractedTextEl.innerHTML = `
            <div class="ocr-error">
              <div class="error-icon">❌</div>
              <p>Unable to extract text from the image. You can still paste text manually.</p>
            </div>
          `;
        }
      });
  } else if (extractedTextEl) {
    extractedTextEl.innerHTML = `
      <div class="ocr-error">
        <div class="error-icon">⚠️</div>
        <p>OCR library not loaded; only image metadata is available.</p>
      </div>
    `;
  }
}

async function analyzeText(text) {
  if (!text || text.length < 10) {
    showCheckerError('Please enter at least 10 characters or upload an image with readable text.');
    return;
  }

  document.getElementById('checkerInput').disabled = true;
  document.getElementById('analyzeBtn').disabled = true;
  document.getElementById('checkerResults').style.display = 'none';
  document.getElementById('checkerError').style.display = 'none';
  document.getElementById('checkerLoading').style.display = 'flex';

  const loadingMessages = {
    deep: '🔍 Performing deep credibility analysis...',
    factcheck: '✓ Fact-checking claims...',
    compare: '⚖️ Comparing headlines...'
  };
  document.getElementById('loadingText').textContent = loadingMessages[currentAnalysisMode];

  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, mode: currentAnalysisMode })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    displayDetailedResults(data.result);
    document.getElementById('checkerResults').style.display = 'block';
    document.getElementById('checkerError').style.display = 'none';
  } catch (error) {
    showCheckerError(error.message || 'Failed to analyze. Please try again.');
  } finally {
    document.getElementById('checkerInput').disabled = false;
    document.getElementById('analyzeBtn').disabled = false;
    document.getElementById('checkerLoading').style.display = 'none';
  }
}

async function analyzeHeadline() {
  const input = document.getElementById('checkerInput').value.trim();
  const imageInput = document.getElementById('checkerImageInput');
  const imageFile = imageInput?.files?.[0];

  if (imageFile && extractedImageText) {
    await analyzeText(extractedImageText);
    return;
  }

  if (imageFile && !extractedImageText) {
    showCheckerError('Image uploaded but text extraction is still pending. Please wait or paste text manually.');
    return;
  }

  if (!input) {
    showCheckerError('Please enter a headline or news text');
    return;
  }

  await analyzeText(input);
}

function resetChecker() {
  document.getElementById('checkerInput').value = '';
  document.getElementById('charCount').textContent = '0';
  document.getElementById('checkerResults').style.display = 'none';
  document.getElementById('checkerError').style.display = 'none';
  document.getElementById('checkerInput').focus();

  const imageInput = document.getElementById('checkerImageInput');
  if (imageInput) imageInput.value = '';
  uploadedImageFile = null;
  extractedImageText = '';

  const previewWrapper = document.getElementById('imagePreviewWrapper');
  const previewImg = document.getElementById('imagePreview');
  const imageInfo = document.getElementById('imageInfo');
  const extractedTextEl = document.getElementById('imageExtractedText');
  if (previewWrapper) previewWrapper.style.display = 'none';
  if (previewImg) previewImg.src = '';
  if (imageInfo) imageInfo.textContent = '';
  if (extractedTextEl) extractedTextEl.style.display = 'none';
}

function showCheckerError(message) {
  const errorEl = document.getElementById('checkerError');
  if (!message) {
    errorEl.style.display = 'none';
    return;
  }
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  document.getElementById('checkerResults').style.display = 'none';
}

// ============================================
// ADVANCED AI CREDIBILITY ANALYZER (FULL GEMINI)
// ============================================

let currentAnalysisMode = 'deep';

function openAIChecker() {
  const modal = document.getElementById('aiCheckerModal');
  modal.classList.add('active');
  document.body.style.overflow = 'hidden'; // Prevent background scrolling
  document.getElementById('checkerInput').focus();
}

function closeAIChecker() {
  const modal = document.getElementById('aiCheckerModal');
  modal.classList.remove('active');
  document.body.style.overflow = ''; // Restore background scrolling
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
  const modal = document.getElementById('aiCheckerModal');
  if (modal && event.target === modal) {
    closeAIChecker();
  }
});

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    const modal = document.getElementById('aiCheckerModal');
    if (modal && modal.classList.contains('active')) {
      closeAIChecker();
    }
  }
});

// SWITCH ANALYSIS MODE
function switchMode(mode) {
  currentAnalysisMode = mode;
  
  // Update tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-mode="${mode}"]`).classList.add('active');

  // Show/hide sections
  document.querySelectorAll('.analysis-mode').forEach(m => m.classList.remove('active'));
  
  if (mode === 'compare') {
    document.getElementById('comparisonMode').classList.add('active');
  } else {
    document.getElementById('singleAnalysisMode').classList.add('active');
    const modeDescEl = document.getElementById('modeDescription');
    if (modeDescEl) {
      const descriptions = {
        deep: '🔍 Deep credibility analysis powered by Gemini AI',
        factcheck: '✓ Fact-checking mode - detailed claim verification',
        compare: '⚖️ Side-by-side comparison of headlines'
      };
      modeDescEl.textContent = descriptions[mode] || '';
    }
  }

  // Clear results
  resetChecker();
}

// UPDATE CHARACTER COUNTS
document.getElementById('checkerInput')?.addEventListener('input', function() {
  document.getElementById('charCount').textContent = this.value.length;
});

document.getElementById('compareInput1')?.addEventListener('input', function() {
  document.getElementById('charCount1').textContent = this.value.length;
});

document.getElementById('compareInput2')?.addEventListener('input', function() {
  document.getElementById('charCount2').textContent = this.value.length;
});

// DISPLAY DETAILED RESULTS WITH UNDERSTANDING FORMAT
function displayDetailedResults(result) {
  // Score and status
  const statusEl = document.getElementById('resultStatus');
  const statusMap = {
    real: { class: 'real', text: '✓ Likely Real', color: 'var(--safe)' },
    fake: { class: 'fake', text: '✗ Likely Fake', color: 'var(--danger)' },
    unknown: { class: 'unknown', text: '? Needs Verification', color: 'var(--warn)' }
  };
  
  const status = statusMap[result.status] || statusMap.unknown;
  statusEl.className = `result-status ${status.class}`;
  statusEl.textContent = status.text;

  // Score circle
  const scorePercent = result.score || 50;
  document.getElementById('resultScore').textContent = scorePercent + '%';
  
  const scoreCircle = document.getElementById('scoreCircle');
  const angle = (scorePercent / 100) * 360;
  scoreCircle.style.background = `conic-gradient(var(--accent) 0deg ${angle}deg, var(--border) ${angle}deg)`;

  // Summary
  document.getElementById('resultSummary').textContent = result.summary || 'Analysis completed';

  // Key Findings
  const keyFindingsList = document.getElementById('keyFindingsList');
  if (result.keyFindings && result.keyFindings.length > 0) {
    keyFindingsList.innerHTML = result.keyFindings
      .map(finding => `<li>${finding}</li>`)
      .join('');
  } else {
    keyFindingsList.innerHTML = '<li>No specific findings identified</li>';
  }

  // Red Flags
  const redFlagsSection = document.getElementById('redFlagsSection');
  const redFlagsList = document.getElementById('redFlagsList');
  if (result.redFlags && result.redFlags.length > 0) {
    redFlagsSection.style.display = 'block';
    redFlagsList.innerHTML = result.redFlags
      .map(flag => `<li>${flag}</li>`)
      .join('');
  } else {
    redFlagsSection.style.display = 'none';
  }

  // Strengths
  const strengthsSection = document.getElementById('strengthsSection');
  const strengthsList = document.getElementById('strengthsList');
  if (result.strengths && result.strengths.length > 0) {
    strengthsSection.style.display = 'block';
    strengthsList.innerHTML = result.strengths
      .map(strength => `<li>${strength}</li>`)
      .join('');
  } else {
    strengthsSection.style.display = 'none';
  }

  // Metrics
  const metricsSection = document.getElementById('metricsSection');
  if (result.breakdown) {
    metricsSection.style.display = 'block';
    const breakdown = result.breakdown;
    
    updateMetric('SourceReliability', breakdown.sourceReliability || 50);
    updateMetric('FactualAccuracy', breakdown.factualAccuracy || 50);
    updateMetric('BiasLevel', breakdown.biasLevel || 50);
    updateMetric('LogicalConsistency', breakdown.logicalConsistency || 50);
    updateMetric('EvidenceQuality', breakdown.evidenceQuality || 50);
  } else {
    metricsSection.style.display = 'none';
  }

  // Recommendation
  const recommendationSection = document.getElementById('recommendationSection');
  const recommendationText = document.getElementById('recommendationText');
  if (result.recommendation) {
    recommendationSection.style.display = 'block';
    recommendationText.textContent = result.recommendation;
  } else {
    recommendationSection.style.display = 'none';
  }
}

function updateMetric(metricName, value) {
  const safeValue = Math.max(0, Math.min(100, value || 50));
  document.getElementById(`metric${metricName}`).style.width = safeValue + '%';
  document.getElementById(`metric${metricName}Val`).textContent = Math.round(safeValue) + '%';
}

// COMPARISON MODE - ALSO USES GEMINI AI
async function compareHeadlines() {
  const input1 = document.getElementById('compareInput1').value.trim();
  const input2 = document.getElementById('compareInput2').value.trim();
  
  if (!input1 || !input2) {
    showComparisonError('Please enter both headlines');
    return;
  }

  if (input1.length < 10 || input2.length < 10) {
    showComparisonError('Each headline must be at least 10 characters');
    return;
  }

  document.getElementById('comparisonResults').style.display = 'none';
  document.getElementById('comparisonError').style.display = 'none';
  document.getElementById('comparisonLoading').style.display = 'flex';

  try {
    const [res1, res2] = await Promise.all([
      fetch(`${API_BASE_URL}/api/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input1, mode: 'deep' })
      }),
      fetch(`${API_BASE_URL}/api/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input2, mode: 'deep' })
      })
    ]);

    if (!res1.ok || !res2.ok) throw new Error('Analysis failed');

    const data1 = await res1.json();
    const data2 = await res2.json();

    displayComparison(data1.result, data2.result);
    document.getElementById('comparisonResults').style.display = 'block';
    document.getElementById('comparisonError').style.display = 'none';

  } catch (error) {
    showComparisonError(error.message || 'Comparison failed');
  } finally {
    document.getElementById('comparisonLoading').style.display = 'none';
  }
}

function displayComparison(result1, result2) {
  // Result 1
  const card1 = document.getElementById('compResult1');
  card1.innerHTML = `
    <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
      <div style="width: 60px; height: 60px; border-radius: 50%; background: conic-gradient(var(--accent) 0deg ${(result1.score/100)*360}deg, var(--border) ${(result1.score/100)*360}deg); display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--accent);">${result1.score}%</div>
      <div>
        <div style="font-weight: 600; color: var(--text);">${result1.status === 'real' ? '✓ Real' : result1.status === 'fake' ? '✗ Fake' : '? Unknown'}</div>
        <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">${result1.summary}</div>
      </div>
    </div>
  `;

  // Result 2
  const card2 = document.getElementById('compResult2');
  card2.innerHTML = `
    <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
      <div style="width: 60px; height: 60px; border-radius: 50%; background: conic-gradient(var(--accent) 0deg ${(result2.score/100)*360}deg, var(--border) ${(result2.score/100)*360}deg); display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--accent);">${result2.score}%</div>
      <div>
        <div style="font-weight: 600; color: var(--text);">${result2.status === 'real' ? '✓ Real' : result2.status === 'fake' ? '✗ Fake' : '? Unknown'}</div>
        <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">${result2.summary}</div>
      </div>
    </div>
  `;

  // Verdict
  const diff = Math.abs(result1.score - result2.score);
  let verdict = '';
  if (diff > 30) {
    const more = result1.score > result2.score ? 'Headline 1' : 'Headline 2';
    verdict = `<strong>Significant difference:</strong> ${more} is ${Math.round(diff)}% more credible`;
  } else if (diff > 10) {
    verdict = `<strong>Moderate difference:</strong> Headline ${result1.score > result2.score ? '1' : '2'} appears more credible`;
  } else {
    verdict = `<strong>Similar credibility:</strong> Both headlines have comparable reliability scores`;
  }
  document.getElementById('comparisonVerdict').innerHTML = verdict;
}

function showComparisonError(message) {
  const errorEl = document.getElementById('comparisonError');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function resetComparison() {
  document.getElementById('compareInput1').value = '';
  document.getElementById('compareInput2').value = '';
  document.getElementById('charCount1').textContent = '0';
  document.getElementById('charCount2').textContent = '0';
  document.getElementById('comparisonResults').style.display = 'none';
  document.getElementById('comparisonError').style.display = 'none';
  document.getElementById('compareInput1').focus();
}
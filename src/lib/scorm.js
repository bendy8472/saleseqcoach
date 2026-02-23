import JSZip from 'jszip'
import { saveAs } from 'file-saver'

// ─────────────────────────────────────────────
//  Generate + download a SCORM 2004 zip for an assignment
//  The zip is a thin launcher that loads from the hosted URL
// ─────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_BASE_URL || 'https://saleseqcoach.com'

export async function downloadScormPackage(assignment) {
  const zip = new JSZip()
  const { slug, title } = assignment

  // ── imsmanifest.xml ──────────────────────────
  zip.file('imsmanifest.xml', buildManifest(slug, title))

  // ── index.html (launcher) ────────────────────
  zip.file('index.html', buildLauncher(slug, title))

  // ── XSD schema stubs (Canvas requires these) ─
  zip.file('imscp_v1p1.xsd',   XSD_STUB)
  zip.file('adlcp_v1p3.xsd',   XSD_STUB)
  zip.file('adlseq_v1p3.xsd',  XSD_STUB)
  zip.file('adlnav_v1p3.xsd',  XSD_STUB)
  zip.file('imsss_v1p0.xsd',   XSD_STUB)

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  saveAs(blob, `${slug}.zip`)
}

// ── Manifest ─────────────────────────────────
function buildManifest(slug, title) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.saleseqcoach.${slug}" version="1"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="
    http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd
    http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd
    http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd
    http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd
    http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">

  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>

  <organizations default="ORG1">
    <organization identifier="ORG1">
      <title>${escapeXML(title)}</title>
      <item identifier="ITEM1" identifierref="RES1" isvisible="true">
        <title>${escapeXML(title)}</title>
        <adlcp:completionThreshold completedByMeasure="true" minProgressMeasure="0.7"/>
      </item>
    </organization>
  </organizations>

  <resources>
    <resource identifier="RES1" type="webcontent" adlcp:scormType="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>

</manifest>`
}

// ── Launcher HTML ────────────────────────────
// This tiny file lives in the zip and immediately loads the real assignment
// It also initialises SCORM so Canvas registers the launch
function buildLauncher(slug, title) {
  const assignmentUrl = `${BASE_URL}/${slug}`
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeHTML(title)}</title>
  <style>
    body { margin:0; background:#0a0c10; display:flex; align-items:center;
           justify-content:center; height:100vh; font-family:sans-serif; color:#eee; }
    .loading { text-align:center; }
    .spinner { width:32px; height:32px; border:2px solid #2c3145;
               border-top-color:#e8c547; border-radius:50%;
               animation:spin .8s linear infinite; margin:0 auto 16px; }
    @keyframes spin { to { transform:rotate(360deg) } }
  </style>
</head>
<body>
<div class="loading">
  <div class="spinner"></div>
  <div>Loading assignment…</div>
</div>
<script>
(function() {
  // Find SCORM 2004 API
  function findAPI(w) {
    var t = 0;
    while (!w.API_1484_11 && w.parent && w.parent !== w && t++ < 7) w = w.parent;
    return w.API_1484_11 || null;
  }
  var api = findAPI(window) || (window.opener ? findAPI(window.opener) : null);
  if (api) {
    api.Initialize('');
    api.SetValue('cmi.completion_status', 'incomplete');
    api.Commit('');
  }

  // Pass SCORM API reference to the assignment page via postMessage
  // The assignment page will call back with score/completion
  var assignmentUrl = '${assignmentUrl}';
  var iframe = document.createElement('iframe');
  iframe.src = assignmentUrl;
  iframe.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:none;';
  document.body.innerHTML = '';
  document.body.appendChild(iframe);

  // Listen for score/completion messages from the assignment iframe
  window.addEventListener('message', function(e) {
    if (!e.data || e.data.source !== 'saleseq') return;
    if (!api) return;
    var d = e.data;
    if (d.type === 'score') {
      api.SetValue('cmi.score.raw',    String(d.raw));
      api.SetValue('cmi.score.min',    '0');
      api.SetValue('cmi.score.max',    '100');
      api.SetValue('cmi.score.scaled', String((d.raw / 100).toFixed(4)));
      api.Commit('');
    }
    if (d.type === 'complete') {
      api.SetValue('cmi.completion_status', 'completed');
      api.SetValue('cmi.success_status', d.passed ? 'passed' : 'failed');
      api.Commit('');
      api.Terminate('');
    }
  });
})();
</script>
</body>
</html>`
}

function escapeXML(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function escapeHTML(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

// Canvas validates against these but doesn't really use them
const XSD_STUB = `<?xml version="1.0" encoding="UTF-8"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"/>`

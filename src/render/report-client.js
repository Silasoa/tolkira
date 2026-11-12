/* global TolkiraSearch */
(function () {
  var views = Array.prototype.slice.call(document.querySelectorAll('[data-view]'));
  var report = document.getElementById('report-view');
  var analysis = document.getElementById('analysis-view');
  function showView(name) {
    if (!report || !analysis) return;
    report.hidden = name !== 'report';
    analysis.hidden = name !== 'analysis';
    views.forEach(function (button) {
      var active = button.getAttribute('data-view') === name;
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    window.scrollTo(0, 0);
  }
  views.forEach(function (button) {
    button.addEventListener('click', function () { showView(button.getAttribute('data-view')); });
  });
  var tablist = document.querySelector('[role="tablist"]');
  if (tablist) tablist.addEventListener('keydown', function (event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    var index = views.indexOf(document.activeElement);
    if (index < 0) return;
    var next = event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + views.length) % views.length;
    views[next].focus();
    showView(views[next].getAttribute('data-view'));
  });
  var state = { query: '', hidden: new Set(), tag: '' };
  var searchOpened = [];
  var searchOpenedHooks = [];
  var hiddenOpen = new WeakMap();
  var scenarios = Array.prototype.slice.call(document.querySelectorAll('[data-scenario]'));
  var highlightTargets = scenarios.concat(Array.prototype.slice.call(document.querySelectorAll('.outlineTitle, .examplesTitle, .ruleTitle, .backgroundTitle')));
  var features = Array.prototype.slice.call(document.querySelectorAll('[data-feature]'));
  var exampleGroups = Array.prototype.slice.call(document.querySelectorAll('[data-examples]')).map(function (group) {
    return { group: group, rows: Array.prototype.slice.call(group.querySelectorAll('[data-scenario]')) };
  });
  var outlineGroups = Array.prototype.slice.call(document.querySelectorAll('[data-outline]')).map(function (group) {
    return { group: group, rows: Array.prototype.slice.call(group.querySelectorAll('[data-scenario]')) };
  });
  var ruleGroups = Array.prototype.slice.call(document.querySelectorAll('[data-rule]')).map(function (group) {
    return { group: group, rows: Array.prototype.slice.call(group.querySelectorAll('[data-scenario]')) };
  });
  var live = document.getElementById('tolkira-live');
  var searchNote = document.getElementById('tolkira-search-note');
  var triage = document.querySelector('[data-triage]');
  var sources = document.querySelector('[data-sources]');
  function apply() {
    var query = state.query.toLowerCase();
    var tag = state.tag;
    var expression = typeof TolkiraSearch !== 'undefined'
      ? TolkiraSearch.compileTagExpression(state.query)
      : undefined;
    var visible = 0;
    scenarios.forEach(function (scenario) {
      var status = scenario.getAttribute('data-status');
      var outline = scenario.closest('[data-outline]');
      var examples = scenario.closest('[data-examples]');
      var rule = scenario.closest('[data-rule]');
      var feature = scenario.closest('[data-feature]');
      var groupSearch = (outline ? ' ' + (outline.getAttribute('data-search') || '') : '') + (examples ? ' ' + (examples.getAttribute('data-search') || '') : '') + (rule ? ' ' + (rule.getAttribute('data-search') || '') : '') + (feature ? ' ' + (feature.getAttribute('data-background-search') || '') : '');
      var text = ((scenario.getAttribute('data-search') || '') + groupSearch).toLowerCase();
      var tags = ' ' + (scenario.getAttribute('data-tags') || '') + ' ';
      var tagMatch = !tag || tags.indexOf(' ' + tag + ' ') !== -1;
      var expressionMatch = !expression || expression((scenario.getAttribute('data-tags') || '').split(' ').filter(Boolean));
      var textMatch = Boolean(expression) || !query || text.indexOf(query) !== -1;
      var match = !state.hidden.has(status) && tagMatch && expressionMatch && textMatch;
      if (!match) {
        if (!scenario.hidden) {
          hiddenOpen.set(scenario, TolkiraSearch.rememberHiddenOpen(scenario.open, searchOpened.indexOf(scenario) !== -1));
        }
        scenario.open = false;
      } else if (scenario.hidden && hiddenOpen.has(scenario)) {
        scenario.open = hiddenOpen.get(scenario);
        hiddenOpen.delete(scenario);
      }
      scenario.hidden = !match;
      if (match) visible += 1;
    });
    features.forEach(function (feature) {
      var children = feature.querySelectorAll('[data-scenario]');
      var any = Array.prototype.some.call(children, function (child) { return !child.hidden; });
      feature.hidden = !any;
      if (any && (query || state.hidden.size || tag)) feature.open = true;
    });
    exampleGroups.forEach(function (entry) {
      var any = entry.rows.some(function (row) { return !row.hidden; });
      entry.group.hidden = !any;
    });
    outlineGroups.forEach(function (entry) {
      var any = entry.rows.some(function (row) { return !row.hidden; });
      entry.group.hidden = !any;
    });
    ruleGroups.forEach(function (entry) {
      var any = entry.rows.some(function (row) { return !row.hidden; });
      entry.group.hidden = !any;
    });
    searchOpened.forEach(function (scenario) { scenario.open = false; });
    searchOpened = [];
    searchOpenedHooks.forEach(function (group) { group.open = false; });
    searchOpenedHooks = [];
    var toOpen = query
      ? TolkiraSearch.rowsToOpen(scenarios.map(function (scenario) {
          return { visible: !scenario.hidden, open: scenario.open };
        }))
      : [];
    toOpen.forEach(function (index) {
      var scenario = scenarios[index];
      scenario.open = true;
      searchOpened.push(scenario);
    });
    var opened = toOpen.length;
    if (query) {
      scenarios.forEach(function (scenario) {
        if (scenario.hidden || !scenario.open) return;
        Array.prototype.slice.call(scenario.querySelectorAll('details.hookGroup')).forEach(function (group) {
          if (!group.open) {
            group.open = true;
            searchOpenedHooks.push(group);
          }
        });
      });
    }
    if (live) live.textContent = visible + ' of ' + scenarios.length + ' scenarios visible';
    if (searchNote) {
      if (query && opened === 20 && visible > 20) {
        searchNote.textContent = '20 of ' + visible + ' matches expanded. Use Expand all to open the rest.';
        searchNote.hidden = false;
      } else {
        searchNote.hidden = true;
        searchNote.textContent = '';
      }
    }
    var empty = document.getElementById('empty-results');
    if (empty) empty.hidden = visible !== 0;
    if (triage) triage.hidden = Boolean(query || tag || state.hidden.size);
    if (sources) sources.hidden = Boolean(query || tag || state.hidden.size);
    highlightSearch();
  }
  function clearHighlights() {
    if (typeof CSS === 'undefined' || !CSS.highlights) return;
    CSS.highlights.delete('tolkira-search');
  }
  function escapeRegex(value) {
    var out = '';
    for (var i = 0; i < value.length; i++) {
      var code = value.charCodeAt(i);
      var ch = value.charAt(i);
      var special = code === 92 || code === 94 || code === 36 || code === 46 || code === 42 || code === 43 || code === 63 || code === 40 || code === 41 || code === 91 || code === 93 || code === 123 || code === 125 || code === 124;
      out += special ? String.fromCharCode(92) + ch : ch;
    }
    return out;
  }
  function highlightSearch() {
    if (typeof CSS === 'undefined' || !CSS.highlights || typeof Highlight === 'undefined') return;
    var needle = state.query.trim();
    if (needle.length < 2) { clearHighlights(); return; }
    try {
      var pattern = new RegExp(escapeRegex(needle), 'gi');
      var ranges = [];
      highlightTargets.forEach(function (target) {
        if (target.hidden || target.closest('[hidden]') || ranges.length >= 200) return;
        if (target.hasAttribute('data-scenario') && !target.open) return;
        var walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, null);
        var node;
        while (ranges.length < 200 && (node = walker.nextNode())) {
          var value = node.nodeValue;
          if (!value) continue;
          var parent = node.parentElement;
          if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) continue;
          pattern.lastIndex = 0;
          var match;
          while (ranges.length < 200 && (match = pattern.exec(value)) !== null) {
            var range = document.createRange();
            range.setStart(node, match.index);
            range.setEnd(node, match.index + match[0].length);
            ranges.push(range);
            if (match[0].length === 0) pattern.lastIndex += 1;
          }
        }
      });
      clearHighlights();
      if (ranges.length) CSS.highlights.set('tolkira-search', new Highlight(...ranges));
    } catch {
      clearHighlights();
    }
  }
  var search = document.querySelector('[data-search]');
  var tagFilter = document.querySelector('[data-tag-filter]');
  function syncUrl() {
    try {
      var next = TolkiraSearch.serializeUrlState(location.href, {
        query: state.query,
        hidden: Array.from(state.hidden),
        tag: state.tag
      });
      if (typeof history.replaceState === 'function') history.replaceState(null, '', next);
    } catch {}
  }
  function restoreUrlState() {
    var statusButtons = Array.prototype.slice.call(document.querySelectorAll('button.filter[data-status]'));
    var knownStatuses = statusButtons.map(function (button) { return button.getAttribute('data-status'); });
    var knownTags = tagFilter ? Array.prototype.map.call(tagFilter.options, function (option) { return option.value; }).filter(Boolean) : [];
    var parsed;
    try {
      parsed = TolkiraSearch.parseUrlState(location.search, knownStatuses, knownTags);
    } catch {
      return;
    }
    if (parsed.query) {
      state.query = parsed.query;
      if (search) search.value = parsed.query;
    }
    parsed.hidden.forEach(function (status) { state.hidden.add(status); });
    statusButtons.forEach(function (button) {
      button.setAttribute('aria-pressed', state.hidden.has(button.getAttribute('data-status')) ? 'false' : 'true');
    });
    if (parsed.tag && tagFilter) {
      state.tag = parsed.tag;
      tagFilter.value = parsed.tag;
    }
    if (state.query || state.hidden.size || state.tag) apply();
  }
  if (search) search.addEventListener('input', function () {
    state.query = search.value;
    apply();
    syncUrl();
  });
  if (tagFilter) tagFilter.addEventListener('change', function () {
    state.tag = tagFilter.value;
    apply();
    syncUrl();
  });
  Array.prototype.slice.call(document.querySelectorAll('button.filter[data-status]')).forEach(function (button) {
    button.addEventListener('click', function () {
      var status = button.getAttribute('data-status');
      var active = button.getAttribute('aria-pressed') !== 'false';
      if (active) { state.hidden.add(status); button.setAttribute('aria-pressed', 'false'); }
      else { state.hidden.delete(status); button.setAttribute('aria-pressed', 'true'); }
      apply();
      syncUrl();
    });
  });
  Array.prototype.slice.call(document.querySelectorAll('[data-expand]')).forEach(function (button) {
    button.addEventListener('click', function () {
      var open = button.getAttribute('data-expand') === 'all';
      features.forEach(function (feature) { feature.open = open; });
      scenarios.forEach(function (scenario) { scenario.open = open; });
    });
  });
  var copyLive = document.getElementById('tolkira-copy-live');
  function legacyCopy(text) {
    var active = document.activeElement;
    var field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.top = '-1000px';
    document.body.appendChild(field);
    var ok = false;
    try {
      field.select();
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    } finally {
      field.remove();
      if (active && typeof active.focus === 'function') active.focus();
    }
    return ok;
  }
  function writeClipboard(text, done) {
    var settled = false;
    function finish(ok) {
      if (settled) return;
      settled = true;
      done(ok);
    }
    function fallback() {
      finish(legacyCopy(text));
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        navigator.clipboard.writeText(text).then(function () { finish(true); }, fallback);
      } catch {
        fallback();
      }
    } else {
      fallback();
    }
  }
  function failureText(button) {
    var scenario = button.closest('[data-scenario]');
    if (!scenario) return '';
    var feature = scenario.closest('[data-feature]');
    var featureTitle = feature ? feature.querySelector('h2') : null;
    var scenarioTitle = scenario.querySelector('.scenarioName');
    var scenarioName = scenario.getAttribute('data-scenario-name') || (scenarioTitle ? scenarioTitle.textContent : '');
    var example = scenario.getAttribute('data-example') || '';
    var examplesName = scenario.getAttribute('data-examples-name') || '';
    var step = scenario.querySelector('.step[data-status="failed"]');
    var hook = !step ? scenario.querySelector('.hook[data-status="failed"]') : null;
    var keyword = step && step.querySelector('.kw') ? step.querySelector('.kw').textContent.trim() : '';
    var body = step ? step.querySelector('div') : null;
    var text = '';
    if (body) {
      Array.prototype.forEach.call(body.childNodes, function (node) {
        if (node.nodeType === 3) text += node.nodeValue;
      });
    }
    var error = step ? step.querySelector('.error') : hook ? hook.querySelector('.error') : null;
    var stepLabel = hook
      ? (hook.querySelector('.hookLabel') ? hook.querySelector('.hookLabel').textContent.trim() : 'Hook')
      : (keyword + ' ' + text.trim()).trim();
    var stepKind = hook ? 'Hook: ' : 'Step: ';
    var lines = [
      'Feature: ' + (featureTitle ? featureTitle.textContent : ''),
      'Scenario: ' + scenarioName
    ];
    if (example) {
      lines.push('Example: ' + example + (examplesName ? ' (' + examplesName + ')' : ''));
    }
    lines.push(
      'URI: ' + (scenario.getAttribute('data-uri') || ''),
      stepKind + stepLabel
    );
    if (error && error.textContent.trim()) {
      lines.push('Error:\n' + error.textContent.trim());
    }
    return lines.join('\n');
  }
  function setupCopyButton(button, label, textFor, copiedMessage, failedMessage) {
    var labelTimer = null;
    button.addEventListener('click', function () {
      button.focus();
      writeClipboard(textFor(button), function (ok) {
        if (labelTimer) clearTimeout(labelTimer);
        button.textContent = ok ? 'Copied' : 'Copy failed';
        if (copyLive) copyLive.textContent = ok ? copiedMessage : failedMessage;
        labelTimer = setTimeout(function () {
          button.textContent = label;
          if (copyLive) copyLive.textContent = '';
        }, 2000);
      });
    });
  }
  Array.prototype.slice.call(document.querySelectorAll('[data-copy-failure]')).forEach(function (button) {
    setupCopyButton(button, 'Copy failure', failureText, 'Failure details copied to clipboard.', 'Could not copy failure details.');
  });
  Array.prototype.slice.call(document.querySelectorAll('[data-copy-log]')).forEach(function (button) {
    button.hidden = false;
    setupCopyButton(button, 'Copy log', function (target) {
      var details = target.closest('details');
      var pre = details ? details.querySelector('pre') : null;
      return pre ? pre.textContent : '';
    }, 'Log copied to clipboard.', 'Could not copy the log.');
  });
  var lightbox = document.getElementById('tolkira-lightbox');
  if (lightbox) {
    var lightboxImage = lightbox.querySelector('img');
    var closeLightbox = lightbox.querySelector('[data-lightbox-close]');
    var lightboxTrigger = null;
    var previousOverflow = '';
    function closeDialog() {
      if (typeof lightbox.close === 'function') lightbox.close();
      else { lightbox.removeAttribute('open'); restoreLightbox(); }
    }
    function restoreLightbox() {
      document.documentElement.style.overflow = previousOverflow;
      if (lightboxTrigger) { lightboxTrigger.focus(); lightboxTrigger = null; }
    }
    Array.prototype.slice.call(document.querySelectorAll('.shotButton')).forEach(function (button) {
      button.addEventListener('click', function () {
        var image = button.querySelector('img');
        if (!image || !lightboxImage) return;
        lightboxImage.src = image.src;
        lightboxImage.alt = image.alt;
        lightboxTrigger = button;
        previousOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        if (typeof lightbox.showModal === 'function') lightbox.showModal();
        else lightbox.setAttribute('open', '');
      });
    });
    if (closeLightbox) closeLightbox.addEventListener('click', closeDialog);
    lightbox.addEventListener('click', function (event) { if (event.target === lightbox) closeDialog(); });
    lightbox.addEventListener('close', restoreLightbox);
  }
  function revealHash() {
    if (!location.hash) return;
    var id = '';
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    var target = document.getElementById(id);
    if (!target) return;
    var node = target;
    while (node) {
      if (node.tagName === 'DETAILS') node.open = true;
      node = node.parentElement;
    }
    var focusTarget = target.tagName === 'DETAILS' ? target.querySelector('summary') : target;
    if (focusTarget) {
      try { focusTarget.focus({ preventScroll: true }); } catch { focusTarget.focus(); }
    }
    target.scrollIntoView();
  }
  var compact = window.matchMedia('(max-width: 560px)');
  function syncCompact() {
    if (triage) triage.open = !compact.matches;
  }
  if (compact.addEventListener) compact.addEventListener('change', syncCompact);
  syncCompact();
  window.addEventListener('hashchange', revealHash);
  restoreUrlState();
  showView('report');
  revealHash();
})();
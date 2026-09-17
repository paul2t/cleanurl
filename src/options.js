'use strict';
(function () {
  const RULES = globalThis.CLEANURL_RULES;
  const Settings = globalThis.CleanURLSettings;

  const TOGGLES = ['enabled', 'cleanAddressBar', 'cleanCopies', 'unwrapRedirects', 'removeAffiliate'];
  const LISTS = ['allowlist', 'keepParams', 'customParams'];

  const saved = document.getElementById('saved');
  let savedTimer = null;

  function flashSaved() {
    saved.classList.add('show');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => saved.classList.remove('show'), 1200);
  }

  function fill(settings) {
    for (const key of TOGGLES) document.getElementById(key).checked = settings[key];
    for (const key of LISTS) document.getElementById(key).value = settings[key].join('\n');
  }

  async function saveToggle(key) {
    await Settings.save({ [key]: document.getElementById(key).checked });
    flashSaved();
  }

  async function saveList(key) {
    const field = document.getElementById(key);
    let values = Settings.parseList(field.value);
    if (key === 'allowlist') values = values.map(Settings.toDomain).filter(Boolean);
    await Settings.save({ [key]: values });
    // Show the values back as they were understood.
    field.value = values.join('\n');
    flashSaved();
  }

  function renderCoverage() {
    const summary = document.getElementById('coverage-summary');
    const list = document.getElementById('coverage');
    const siteParams = RULES.sites.reduce((n, site) => n + (site.params || []).length, 0);
    summary.textContent =
      `${RULES.globalParams.length} parameters removed everywhere, plus ` +
      `${siteParams} rules across ${RULES.sites.length} sites and ` +
      `${RULES.redirects.length} redirect wrappers.`;

    for (const site of RULES.sites) {
      const item = document.createElement('li');
      const name = document.createElement('b');
      name.textContent = site.name;
      item.appendChild(name);
      item.appendChild(document.createTextNode(` (${(site.params || []).length})`));
      list.appendChild(item);
    }
  }

  for (const key of TOGGLES) {
    document.getElementById(key).addEventListener('change', () => saveToggle(key));
  }
  for (const key of LISTS) {
    document.getElementById(key).addEventListener('change', () => saveList(key));
  }

  document.getElementById('reset').addEventListener('click', async () => {
    const defaults = Settings.normalize(null);
    await Settings.save(defaults);
    fill(defaults);
    flashSaved();
  });

  renderCoverage();
  Settings.load().then(fill);
})();

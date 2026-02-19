// ========== Allocation Widget ==========

function createAllocationWidget(containerId, type, options, existing, totalAmount) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const idField = type === 'motive' ? 'motiveId' : 'categoryId';
  const label = type === 'motive' ? 'Motive' : 'Kategorie';
  const defaultName = type === 'motive' ? 'Default' : 'Uncategorized';
  const defaultOpt = options.find(o => o.name === defaultName);

  let rows = [];
  if (existing && existing.length > 0) {
    rows = existing.filter(e => e.name !== defaultName).map(e => ({ id: e[idField], percentage: Math.round(e.percentage) }));
  }

  function render() {
    container.innerHTML = '';
    const totalPct = rows.reduce((s, r) => s + (parseInt(r.percentage) || 0), 0);
    const remainingPct = Math.max(0, 100 - totalPct);
    const amount = totalAmount || 0;

    const selectableOptions = options.filter(o => o.name !== defaultName);

    rows.forEach((row, idx) => {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'flex items-center gap-2 mb-1.5';

      const sel = document.createElement('select');
      sel.className = 'flex-1 max-w-[240px] px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none';
      sel.innerHTML = '<option value="">-- Select --</option>' +
        selectableOptions.map(o => `<option value="${o.id}" ${o.id === row.id ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('');
      sel.addEventListener('change', () => { row.id = parseInt(sel.value) || 0; render(); });

      const pctInput = document.createElement('input');
      pctInput.type = 'number';
      pctInput.min = '0';
      pctInput.max = '100';
      pctInput.step = '1';
      pctInput.value = Math.round(row.percentage);
      pctInput.className = 'w-16 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none';
      pctInput.addEventListener('change', () => { row.percentage = parseInt(pctInput.value) || 0; render(); });

      const pctLabel = document.createElement('span');
      pctLabel.className = 'text-sm text-slate-500';
      pctLabel.textContent = '%';

      const euroAmount = document.createElement('span');
      euroAmount.className = 'ml-2 text-sm text-slate-400';
      euroAmount.textContent = formatCurrency(amount * (parseInt(row.percentage) || 0) / 100);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'text-sm px-2 py-1 bg-rose-500 text-white rounded hover:bg-rose-600 transition-colors';
      removeBtn.textContent = 'x';
      removeBtn.addEventListener('click', () => { rows.splice(idx, 1); render(); });

      rowDiv.appendChild(sel);
      rowDiv.appendChild(pctInput);
      rowDiv.appendChild(pctLabel);
      rowDiv.appendChild(euroAmount);
      rowDiv.appendChild(removeBtn);
      container.appendChild(rowDiv);
    });

    // Show default row (read-only)
    if (remainingPct > 0 && defaultOpt) {
      const uncatDiv = document.createElement('div');
      uncatDiv.className = 'flex items-center gap-2 mb-1.5';

      const uncatSel = document.createElement('select');
      uncatSel.className = 'flex-1 max-w-[240px] px-2 py-1.5 text-sm border border-slate-200 rounded-lg opacity-50';
      uncatSel.innerHTML = `<option selected>${escapeHtml(defaultName)}</option>`;
      uncatSel.disabled = true;

      const uncatInput = document.createElement('input');
      uncatInput.type = 'number';
      uncatInput.value = remainingPct;
      uncatInput.readOnly = true;
      uncatInput.className = 'w-16 px-2 py-1.5 text-sm border border-slate-200 rounded-lg opacity-50';

      const uncatPctLabel = document.createElement('span');
      uncatPctLabel.className = 'text-sm text-slate-500';
      uncatPctLabel.textContent = '%';

      const uncatEuro = document.createElement('span');
      uncatEuro.className = 'ml-2 text-sm text-slate-400';
      uncatEuro.textContent = formatCurrency(amount * remainingPct / 100);

      uncatDiv.appendChild(uncatSel);
      uncatDiv.appendChild(uncatInput);
      uncatDiv.appendChild(uncatPctLabel);
      uncatDiv.appendChild(uncatEuro);
      container.appendChild(uncatDiv);
    }

    // Add button
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'text-sm px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors mt-1';
    addBtn.textContent = '+ Add ' + label;
    addBtn.addEventListener('click', () => {
      rows.push({ id: 0, percentage: 0 });
      render();
    });
    container.appendChild(addBtn);

    // Total indicator
    if (rows.length > 0 || remainingPct < 100) {
      const indicator = document.createElement('div');
      indicator.style.marginTop = '8px';
      indicator.style.fontSize = '0.9em';
      if (totalPct > 100) {
        indicator.style.color = '#e74c3c';
        indicator.textContent = `Total: ${totalPct}% (${totalPct - 100}% over!)`;
      } else {
        indicator.style.color = '#27ae60';
        indicator.textContent = `Total: 100% allocated`;
      }
      container.appendChild(indicator);
    }
  }

  render();

  // Methods attached to container element
  container.getAllocations = function() {
    const allocs = rows.filter(r => r.id > 0 && r.percentage > 0).map(r => {
      const opt = options.find(o => o.id === r.id);
      return { [idField]: r.id, name: opt ? opt.name : '', percentage: Math.round(r.percentage) };
    });
    const totalPct = allocs.reduce((s, a) => s + a.percentage, 0);
    const remainingPct = Math.max(0, 100 - totalPct);
    if (remainingPct > 0 && defaultOpt) {
      allocs.push({ [idField]: defaultOpt.id, name: defaultName, percentage: remainingPct });
    }
    return allocs;
  };
  container.getTotalPercent = function() {
    const allocs = container.getAllocations();
    return allocs.reduce((s, a) => s + Math.round(a.percentage), 0);
  };
  container.updateAmount = function(newAmount) {
    totalAmount = newAmount;
    render();
  };
}

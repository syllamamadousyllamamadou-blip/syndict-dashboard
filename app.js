// SYNDICT PRO — Dashboard de Supervision Cloud
const CONFIG = {
    projectId: 'syndict-app',
    residenceSlug: 'residence_awale',
    adminEmail: 'diakitemakemin9@gmail.com',
    refreshIntervalMs: 5000
};

let appState = {
    settings: {
        residenceName: 'RÉSIDENCE AWALÉ',
        syndicName: 'Syndic de Copropriété',
        currency: 'FCFA',
        initialCashBalance: 0,
        currentGuardName: 'Vigile Principal'
    },
    lots: [],
    payments: [],
    expenses: [],
    logs: [],
    revokedTokens: []
};

// Start application
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initNavigation();
    initFilters();
    loadLiveDashboardData();
    setInterval(loadLiveDashboardData, CONFIG.refreshIntervalMs);

    document.getElementById('btnRefreshLive').addEventListener('click', () => {
        loadLiveDashboardData();
    });

    document.getElementById('btnExportAllCsv').addEventListener('click', exportFullSummaryCsv);
});

// Digital Clock
function initClock() {
    const clockEl = document.getElementById('digitalClock');
    const update = () => {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('fr-FR', { hour12: false });
    };
    update();
    setInterval(update, 1000);
}

// Tab Switching
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanels = document.querySelectorAll('.tab-panel');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');

            navItems.forEach(n => n.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));

            item.classList.add('active');
            const targetPanel = document.getElementById(`tab-${targetTab}`);
            if (targetPanel) targetPanel.classList.add('active');
        });
    });
}

// Search and Filter Listeners
function initFilters() {
    document.getElementById('inputSearchLogs').addEventListener('input', renderLiveLogs);
    document.getElementById('selectLogTypeFilter').addEventListener('change', renderLiveLogs);
    document.getElementById('inputSearchPayments').addEventListener('input', renderPayments);
    document.getElementById('inputSearchLots').addEventListener('input', renderLots);
    document.getElementById('selectLotStatusFilter').addEventListener('change', renderLots);
}

// Fetch live Firestore document
async function loadLiveDashboardData() {
    const url = `https://firestore.googleapis.com/v1/projects/${CONFIG.projectId}/databases/(default)/documents/residences/${CONFIG.residenceSlug}`;
    
    try {
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            parseFirestoreData(data);
        } else {
            console.warn('Firestore response not 200, checking local fallback or empty initial state.');
            loadSampleDataIfNeeded();
        }
    } catch (e) {
        console.warn('Firestore fetch failed, network or CORS:', e);
        loadSampleDataIfNeeded();
    }
}

function parseFirestoreData(data) {
    if (!data.fields) return;

    const f = data.fields;
    if (f.residenceName) appState.settings.residenceName = f.residenceName.stringValue || 'RÉSIDENCE AWALÉ';
    if (f.syndicName) appState.settings.syndicName = f.syndicName.stringValue || 'Syndic de Copropriété';
    if (f.initialCashBalance) appState.settings.initialCashBalance = f.initialCashBalance.doubleValue || 0;
    if (f.currentGuardName) appState.settings.currentGuardName = f.currentGuardName.stringValue || 'Vigile Principal';

    if (f.lotsData && f.lotsData.stringValue) {
        try { appState.lots = JSON.parse(f.lotsData.stringValue); } catch (_) {}
    }
    if (f.paymentsData && f.paymentsData.stringValue) {
        try { appState.payments = JSON.parse(f.paymentsData.stringValue); } catch (_) {}
    }
    if (f.expensesData && f.expensesData.stringValue) {
        try { appState.expenses = JSON.parse(f.expensesData.stringValue); } catch (_) {}
    }
    if (f.logsData && f.logsData.stringValue) {
        try { appState.logs = JSON.parse(f.logsData.stringValue); } catch (_) {}
    }
    if (f.revokedTokensData && f.revokedTokensData.stringValue) {
        try { appState.revokedTokens = JSON.parse(f.revokedTokensData.stringValue); } catch (_) {}
    }

    if (f.lastSyncAt) {
        document.getElementById('lastSyncTime').textContent = `Dernier pointage : ${f.lastSyncAt.stringValue}`;
    }

    renderAllViews();
}

function loadSampleDataIfNeeded() {
    if (appState.lots.length === 0) {
        // Fallback default structure
        appState.settings = {
            residenceName: 'RÉSIDENCE AWALÉ',
            syndicName: 'Syndic de Copropriété',
            currency: 'FCFA',
            initialCashBalance: 1000000,
            currentGuardName: 'Vigile Koffi (Poste 1)'
        };
        renderAllViews();
    }
}

function renderAllViews() {
    document.getElementById('residenceHeaderName').textContent = appState.settings.residenceName.toUpperCase();
    document.getElementById('syndicHeaderSubtitle').textContent = `${appState.settings.syndicName} • Suivi des Accès & Gestion Financière`;
    document.getElementById('guardNameText').textContent = appState.settings.currentGuardName;

    updateKPIs();
    renderLiveLogs();
    renderPayments();
    renderLots();
    renderAudit();
}

function formatNum(num) {
    return (num || 0).toLocaleString('fr-FR');
}

function updateKPIs() {
    const totalEncaissement = appState.payments.reduce((acc, p) => acc + (p.amount || 0), 0);
    const totalDepenses = appState.expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const soldeNet = (appState.settings.initialCashBalance || 0) + totalEncaissement - totalDepenses;

    document.getElementById('kpiSoldeNet').textContent = `${formatNum(soldeNet)} FCFA`;
    document.getElementById('kpiInitialCashDetail').textContent = `Solde Initial : ${formatNum(appState.settings.initialCashBalance)} FCFA`;

    document.getElementById('kpiTotalEncaissement').textContent = `+${formatNum(totalEncaissement)} FCFA`;
    document.getElementById('kpiQuittancesCount').textContent = `${appState.payments.length} quittances validées`;

    const todayStr = new Date().toLocaleDateString('fr-FR');
    const todayLogs = appState.logs.filter(l => l.dateTime && l.dateTime.includes(todayStr));
    const entrees = todayLogs.filter(l => l.logType === 'ENTREE').length;
    const sorties = todayLogs.filter(l => l.logType === 'SORTIE').length;

    document.getElementById('kpiPassagesCount').textContent = appState.logs.length;
    document.getElementById('kpiEntreesSortiesSplit').textContent = `${entrees} Entrées • ${sorties} Sorties`;
    document.getElementById('liveLogsCountBadge').textContent = appState.logs.length;

    const nonScanned = appState.lots.filter(l => !l.lastScanDate);
    document.getElementById('kpiNonScannedCount').textContent = nonScanned.length;
}

function renderLiveLogs() {
    const tbody = document.getElementById('tbodyLiveLogs');
    const query = (document.getElementById('inputSearchLogs').value || '').toLowerCase().trim();
    const typeFilter = document.getElementById('selectLogTypeFilter').value;

    let filtered = appState.logs;
    if (typeFilter !== 'ALL') {
        filtered = filtered.filter(l => l.logType === typeFilter);
    }
    if (query) {
        filtered = filtered.filter(l =>
            (l.lotNumber && l.lotNumber.toLowerCase().includes(query)) ||
            (l.residentName && l.residentName.toLowerCase().includes(query)) ||
            (l.guardName && l.guardName.toLowerCase().includes(query))
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="loading-state">Aucun passage enregistré pour le moment.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(log => {
        const isEntree = log.logType === 'ENTREE';
        const typeBadge = isEntree
            ? `<span class="status-pill in">🟢 ENTRÉE</span>`
            : `<span class="status-pill out">🔵 SORTIE</span>`;

        let statusBadge = `<span class="status-pill authorized">🟢 À JOUR</span>`;
        if (log.status === 'REFUSE') {
            statusBadge = `<span class="status-pill late">🔴 EN RETARD</span>`;
        } else if (log.status === 'REVOQUE') {
            statusBadge = `<span class="status-pill revoked">⛔ RÉVOQUÉ</span>`;
        }

        return `
            <tr>
                <td><strong>${log.dateTime || '-'}</strong></td>
                <td>${typeBadge}</td>
                <td><strong>${log.lotNumber || '-'}</strong></td>
                <td>${log.residentName || '-'}</td>
                <td>${statusBadge}</td>
                <td>👮 ${log.guardName || 'Vigile'}</td>
                <td><small>${log.scanMethod || 'QR'}</small></td>
            </tr>
        `;
    }).join('');
}

function renderPayments() {
    const tbody = document.getElementById('tbodyPayments');
    const query = (document.getElementById('inputSearchPayments').value || '').toLowerCase().trim();

    let filtered = appState.payments;
    if (query) {
        filtered = filtered.filter(p =>
            (p.quittanceNum && p.quittanceNum.toLowerCase().includes(query)) ||
            (p.lotNumber && p.lotNumber.toLowerCase().includes(query)) ||
            (p.residentName && p.residentName.toLowerCase().includes(query))
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="loading-state">Aucun encaissement trouvé.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(p => `
        <tr>
            <td>${p.dateTime || '-'}</td>
            <td><strong>${p.quittanceNum || '-'}</strong></td>
            <td><strong>${p.lotNumber || '-'}</strong></td>
            <td>${p.residentName || '-'}</td>
            <td>${p.monthsText || '-'}</td>
            <td><strong class="text-green">${formatNum(p.amount)} FCFA</strong></td>
            <td>${p.paymentMode || 'Espèces'}</td>
            <td>${p.receivedBy || 'Admin Syndic'}</td>
        </tr>
    `).join('');
}

function renderLots() {
    const tbody = document.getElementById('tbodyLots');
    const query = (document.getElementById('inputSearchLots').value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('selectLotStatusFilter').value;

    let filtered = appState.lots;
    if (statusFilter === 'UP_TO_DATE') {
        filtered = filtered.filter(l => l.isUpToDate);
    } else if (statusFilter === 'LATE') {
        filtered = filtered.filter(l => !l.isUpToDate);
    }
    if (query) {
        filtered = filtered.filter(l =>
            (l.lotNumber && l.lotNumber.toLowerCase().includes(query)) ||
            (l.residentName && l.residentName.toLowerCase().includes(query)) ||
            (l.phone && l.phone.includes(query))
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="loading-state">Aucun lot correspondant.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(l => {
        const isUp = l.isUpToDate;
        const statusBadge = isUp
            ? `<span class="status-pill authorized">🟢 À JOUR</span>`
            : `<span class="status-pill late">🔴 RETARD</span>`;

        return `
            <tr>
                <td><strong>${l.lotNumber || '-'}</strong></td>
                <td>${l.residentName || '-'}</td>
                <td><small>${l.occupantType || 'Propriétaire'}</small></td>
                <td>${l.phone || '-'}</td>
                <td>Mois ${l.startMonth || 1}</td>
                <td><strong>${formatNum(l.totalPaid)} FCFA</strong></td>
                <td>${statusBadge}</td>
                <td><code>${(l.cardToken || '').slice(-8) || 'V' + (l.badgeVersion || 1)}</code></td>
                <td>${l.lastScanDate || '<small class="text-muted">Aucun</small>'}</td>
            </tr>
        `;
    }).join('');
}

function renderAudit() {
    const tbody = document.getElementById('tbodyAudit');
    const nonScanned = appState.lots.filter(l => !l.lastScanDate);

    if (nonScanned.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="loading-state" style="color:#10B981">✅ Toutes les villas enregistrées ont un scan de contrôle valide !</td></tr>`;
        return;
    }

    tbody.innerHTML = nonScanned.map(l => `
        <tr>
            <td><strong>${l.lotNumber || '-'}</strong></td>
            <td>${l.residentName || '-'}</td>
            <td>${l.occupantType || 'Propriétaire'}</td>
            <td>${l.phone || '-'}</td>
            <td>${l.isUpToDate ? '<span class="status-pill authorized">À jour</span>' : '<span class="status-pill late">En retard</span>'}</td>
            <td><span class="status-pill late">Jamais scanné</span></td>
            <td><span class="status-pill revoked">🚨 Vigilance Guérite</span></td>
        </tr>
    `).join('');
}

function exportFullSummaryCsv() {
    let csv = "Type;Identifiant;Lot;Resident;Details;Montant;Date\n";
    appState.logs.forEach(l => {
        csv += `Passage;${l.logType};${l.lotNumber};${l.residentName};Vigile: ${l.guardName};;${l.dateTime}\n`;
    });
    appState.payments.forEach(p => {
        csv += `Paiement;${p.quittanceNum};${p.lotNumber};${p.residentName};${p.monthsText};${p.amount};${p.dateTime}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `SYNDICT_Supervision_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

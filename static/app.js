document.addEventListener('DOMContentLoaded', () => {
    // Navigation/Tab Switching
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            tabPanes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === `tab-${tabId}`) {
                    pane.classList.add('active');
                }
            });
        });
    });

    // Run Analysis Button Handlers
    const runBtn = document.getElementById('run-analysis-btn');
    const runBtnPlaceholder = document.getElementById('run-analysis-btn-placeholder');
    const statusText = document.getElementById('status-text');
    const statusDot = document.querySelector('.status-dot');

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const triggerAnalysis = async () => {
        // Show Loading State
        document.getElementById('no-data-state').classList.add('hidden');
        document.getElementById('dashboard-content').classList.add('hidden');
        document.getElementById('loading-state').classList.remove('hidden');
        
        statusText.textContent = "Running Analysis...";
        statusDot.className = "status-dot orange";

        // Reset stepper classes
        for (let i = 1; i <= 4; i++) {
            const stepEl = document.getElementById(`load-step-${i}`);
            if (stepEl) stepEl.className = "workflow-step glass";
        }

        // Simulate stepper progress visually
        // Stage 1: Ingestion
        const step1 = document.getElementById('load-step-1');
        if (step1) step1.className = "workflow-step glass processing";
        await sleep(500);
        if (step1) step1.className = "workflow-step glass active";

        // Stage 2: Schema & Linking
        const step2 = document.getElementById('load-step-2');
        if (step2) step2.className = "workflow-step glass processing";
        await sleep(500);
        if (step2) step2.className = "workflow-step glass active";

        // Stage 3: Rules Engine
        const step3 = document.getElementById('load-step-3');
        if (step3) step3.className = "workflow-step glass processing";
        await sleep(500);
        if (step3) step3.className = "workflow-step glass active";

        // Stage 4: Reports Generation
        const step4 = document.getElementById('load-step-4');
        if (step4) step4.className = "workflow-step glass processing";

        try {
            const selectedMonth = document.getElementById('filter-analysis-month').value;
            const response = await fetch(`/api/run?month=${selectedMonth}`, { method: 'POST' });
            const result = await response.json();
            
            if (result.status === 'success') {
                if (step4) step4.className = "workflow-step glass active";
                await sleep(300);

                populateDashboard(result.data);
                
                // Show Dashboard Content
                document.getElementById('loading-state').classList.add('hidden');
                document.getElementById('dashboard-content').classList.remove('hidden');
                
                statusText.textContent = "Analysis Complete";
                statusDot.className = "status-dot green";
            } else {
                throw new Error(result.message || "Unknown error during engine run");
            }
        } catch (error) {
            console.error(error);
            alert(`Analysis execution failed:\n${error.message}`);
            
            document.getElementById('loading-state').classList.add('hidden');
            document.getElementById('no-data-state').classList.remove('hidden');
            
            statusText.textContent = "Error Occurred";
            statusDot.className = "status-dot red";
        }
    };

    runBtn.addEventListener('click', triggerAnalysis);
    runBtnPlaceholder.addEventListener('click', triggerAnalysis);
    document.getElementById('filter-analysis-month').addEventListener('change', triggerAnalysis);

    const downloadFullPdfBtn = document.getElementById('download-full-pdf-btn');
    if (downloadFullPdfBtn) {
        downloadFullPdfBtn.addEventListener('click', () => {
            const monthSelect = document.getElementById('filter-analysis-month');
            const selectedMonthName = monthSelect.options[monthSelect.selectedIndex].text.replace(/[\s\(\)]+/g, '_');
            downloadPDF('comprehensive-pdf-report', `Comprehensive_Month_End_Report_${selectedMonthName}.pdf`);
        });
    }

    // Helpers
    const formatCurrency = (val) => {
        if (val === null || val === undefined || isNaN(val)) return '-';
        return '₹' + parseFloat(val).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    };

    let ncfChart = null;

    // Render Data to Dashboard
    const populateDashboard = (data) => {
        // 1. Executive Summary Metrics
        const cashFlow = data.cash_flow_report[0] || {};
        const progress = data.progress_update;
        const escalations = data.escalation_summary;

        const collMetric = progress.find(p => p.Category === 'Collections' && p.Metric === 'Total Collections') || {};
        document.getElementById('summary-collections').textContent = formatCurrency(cashFlow.ActualInflow || cashFlow['Actual Inflow']);
        document.getElementById('summary-ncf').textContent = formatCurrency(cashFlow.ActualNCF || cashFlow['Actual NCF']);
        
        // Find sales value in progress update
        const salesMetric = progress.find(p => p.Category === 'Sales' && p.Metric === 'Booking Value') || {};
        document.getElementById('summary-sales').textContent = formatCurrency(salesMetric.Actual);
        
        document.getElementById('summary-escalations').textContent = escalations.length;

        // Dynamic download links to prevent caching and support serverless download
        const timestamp = Date.now();
        const selectedMonth = document.getElementById('filter-analysis-month').value;
        const cfDownload = document.getElementById('download-excel-cf');
        if (cfDownload) cfDownload.href = `/api/download?month=${selectedMonth}&t=${timestamp}`;
        const perfDownload = document.getElementById('download-excel-perf');
        if (perfDownload) perfDownload.href = `/api/download?month=${selectedMonth}&t=${timestamp}`;

        // Variances
        const setVarianceText = (elId, value) => {
            const el = document.getElementById(elId);
            if (!el) return;
            if (value === undefined || value === null) {
                el.textContent = 'vs Target';
                el.style.color = 'var(--text-secondary)';
                return;
            }
            const isPos = value >= 0;
            el.textContent = `${isPos ? '+' : ''}${formatCurrency(value)} vs Target`;
            el.style.color = isPos ? 'var(--success)' : 'var(--danger)';
        };

        setVarianceText('summary-collections-var', collMetric.Variance);
        setVarianceText('summary-ncf-var', cashFlow['Variance vs Target']);
        setVarianceText('summary-sales-var', salesMetric.Variance);

        // 2. Charts
        renderNCFChart(cashFlow);

        // 3. Populate Tables
        // Summary escalations
        const summaryEscBody = document.querySelector('#summary-escalations-table tbody');
        summaryEscBody.innerHTML = '';
        escalations.slice(0, 5).forEach(e => {
            const tr = document.createElement('tr');
            const owner = e['Suggested Owner'] || e.Owner || 'Unknown';
            const status = e.Severity || e.Status || 'Green';
            tr.innerHTML = `
                <td><strong>${e.Item}</strong></td>
                <td>${owner}</td>
                <td><span class="badge badge-${status.toLowerCase()}">${status}</span></td>
            `;
            summaryEscBody.appendChild(tr);
        });

        // Cash Flow Table
        const cfBody = document.querySelector('#cashflow-table tbody');
        cfBody.innerHTML = '';
        data.cash_flow_report.forEach(row => {
            const tr = document.createElement('tr');
            const variance = row['Variance vs Target'];
            tr.innerHTML = `
                <td><strong>${row.Metric}</strong></td>
                <td>${formatCurrency(row['Actual Inflow'] || row.ActualInflow)}</td>
                <td>${formatCurrency(row['Collections Due / Overdue'] || row.CollectionsDueOverdue)}</td>
                <td>${formatCurrency(row['Actual Outflow CoC'] || row.ActualOutflowCoC)}</td>
                <td>${formatCurrency(row['Other Costs'] || row.OtherCosts)}</td>
                <td style="font-weight: 600;">${formatCurrency(row['Actual NCF'] || row.ActualNCF)}</td>
                <td>${formatCurrency(row['Target NCF'] || row.TargetNCF)}</td>
                <td style="color: ${variance >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">
                    ${variance >= 0 ? '+' : ''}${formatCurrency(variance)}
                </td>
            `;
            cfBody.appendChild(tr);
        });

        // Progress Update Table
        const progBody = document.querySelector('#progress-table tbody');
        progBody.innerHTML = '';
        progress.forEach(row => {
            const tr = document.createElement('tr');
            const isUnits = row.Metric.toLowerCase().includes('unit');
            const formatVal = (v) => {
                if (v === null || v === undefined || isNaN(v)) return '-';
                if (isUnits) {
                    return parseFloat(v).toLocaleString('en-IN', { maximumFractionDigits: 0 });
                } else {
                    return '₹' + parseFloat(v).toLocaleString('en-IN', { maximumFractionDigits: 0 });
                }
            };
            
            let desc = '';
            const metricLower = row.Metric.toLowerCase();
            if (metricLower.includes('booking value')) {
                desc = 'Total agreement contract value of all flats booked in June 2026.';
            } else if (metricLower.includes('1bhk')) {
                desc = 'Count of 1 BHK flats booked by customers.';
            } else if (metricLower.includes('2bhk')) {
                desc = 'Count of 2 BHK flats booked by customers.';
            } else if (metricLower.includes('3bhk')) {
                desc = 'Count of 3 BHK flats booked by customers.';
            } else if (metricLower.includes('collections')) {
                desc = 'Actual cash collections received against milestone completions.';
            } else if (metricLower.includes('construction cost')) {
                desc = 'Outflow cash spent on completed construction milestones.';
            }

            tr.innerHTML = `
                <td><span class="badge badge-green">${row.Category}</span></td>
                <td><strong>${row.Metric}</strong></td>
                <td style="color: var(--text-secondary); font-size: 12px;">${desc}</td>
                <td>${formatVal(row.Actual)}</td>
                <td>${formatVal(row.Target)}</td>
                <td style="color: ${row.Variance >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">
                    ${row.Variance >= 0 ? '+' : ''}${formatVal(row.Variance)}
                </td>
            `;
            progBody.appendChild(tr);
        });

        // Store active data globally for filtering
        window.activeData = data;

        // Render functions for filtered elements
        window.renderEscalations = () => {
            if (!window.activeData || !window.activeData.escalation_summary) return;
            const q = document.getElementById('search-esc').value.toLowerCase();
            const sev = document.getElementById('filter-esc-severity').value.toLowerCase();
            const due = document.getElementById('filter-esc-due').value.toLowerCase();
            const escBody = document.querySelector('#escalations-table tbody');
            escBody.innerHTML = '';
            
            window.activeData.escalation_summary.forEach(e => {
                const owner = e['Suggested Owner'] || e.Owner || 'Unknown';
                const status = e.Severity || e.Status || 'Green';
                const metric = e['Metric Impacted'] || e.MetricImpacted || '';
                const rowDue = (e['Due Date'] || e.DueDate || '').toLowerCase();
                
                const matchQ = e.Item.toLowerCase().includes(q) || 
                               metric.toLowerCase().includes(q) || 
                               e.Reason.toLowerCase().includes(q) || 
                               owner.toLowerCase().includes(q);
                const matchSev = !sev || status.toLowerCase() === sev;
                const matchDue = !due || rowDue.includes(due);
                
                if (matchQ && matchSev && matchDue) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${e.Item}</strong></td>
                        <td>${metric}</td>
                        <td>${e.Reason}</td>
                        <td>${owner}</td>
                        <td>${e['Due Date'] || e.DueDate}</td>
                        <td><span class="badge badge-${status.toLowerCase()}">${status}</span></td>
                    `;
                    escBody.appendChild(tr);
                }
            });
        };

        window.renderActions = () => {
            if (!window.activeData || !window.activeData.action_plan) return;
            const q = document.getElementById('search-act').value.toLowerCase();
            const dept = document.getElementById('filter-act-dept').value.toLowerCase();
            const priority = document.getElementById('filter-act-priority').value.toLowerCase();
            const actBody = document.querySelector('#actions-table tbody');
            actBody.innerHTML = '';
            
            window.activeData.action_plan.forEach(row => {
                const prioClass = (row.Priority || '').toLowerCase() === 'high' ? 'red' : 'amber';
                const rowDept = row.Department || '';
                const rowPrio = (row.Priority || '').toLowerCase();
                
                const matchQ = row.Owner.toLowerCase().includes(q) || 
                               row.Task.toLowerCase().includes(q) || 
                               rowDept.toLowerCase().includes(q);
                const matchDept = !dept || rowDept.toLowerCase() === dept;
                const matchPrio = !priority || rowPrio === priority;
                
                if (matchQ && matchDept && matchPrio) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${row.Owner}</strong></td>
                        <td><span class="badge badge-green">${rowDept}</span></td>
                        <td>${row.Task}</td>
                        <td><span class="badge badge-${prioClass}">${row.Priority}</span></td>
                    `;
                    actBody.appendChild(tr);
                }
            });
        };

        window.renderComms = () => {
            if (!window.activeData || !window.activeData.draft_communications) return;
            const q = document.getElementById('search-comm').value.toLowerCase();
            const commsContainer = document.getElementById('comms-container');
            commsContainer.innerHTML = '';
            
            window.activeData.draft_communications.forEach(comm => {
                const recipient = comm.Recipient || comm.To || '';
                const msg = comm.Message || '';
                
                if (recipient.toLowerCase().includes(q) || msg.toLowerCase().includes(q)) {
                    const div = document.createElement('div');
                    div.className = 'comm-card';
                    div.innerHTML = `
                        <div class="comm-meta">
                            <span class="comm-to"><i class="fa-solid fa-user"></i> To: ${recipient}</span>
                            <span class="comm-channel"><i class="fa-solid fa-paper-plane"></i> Teams / Email</span>
                        </div>
                        <div class="comm-body">${msg}</div>
                    `;
                    commsContainer.appendChild(div);
                }
            });
        };

        // Bind event listeners to input elements for real-time search/filtering
        document.getElementById('search-esc').addEventListener('input', window.renderEscalations);
        document.getElementById('filter-esc-severity').addEventListener('change', window.renderEscalations);
        document.getElementById('filter-esc-due').addEventListener('change', window.renderEscalations);
        document.getElementById('search-act').addEventListener('input', window.renderActions);
        document.getElementById('filter-act-dept').addEventListener('change', window.renderActions);
        document.getElementById('filter-act-priority').addEventListener('change', window.renderActions);
        document.getElementById('search-comm').addEventListener('input', window.renderComms);

        // Run initial render for filtered elements
        window.renderEscalations();
        window.renderActions();
        window.renderComms();

        // Data Quality Table (incorporating File/Sheet and Field/Activity)
        const qBody = document.querySelector('#quality-table tbody');
        qBody.innerHTML = '';
        data.data_quality_report.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.Timestamp}</td>
                <td><span class="badge badge-green">${row.File || ''}</span></td>
                <td><code>${row['Field/Activity'] || row.Field || ''}</code></td>
                <td><span class="badge badge-amber">${row['Issue Type'] || row.IssueType}</span></td>
                <td>${row.Details}</td>
            `;
            qBody.appendChild(tr);
        });

        // Site Performance Report Table
        const perfBody = document.querySelector('#performance-table tbody');
        perfBody.innerHTML = '';
        if (data.site_performance_report) {
            data.site_performance_report.forEach(row => {
                const tr = document.createElement('tr');
                let statusClass = 'green';
                const statusText = row.Status || '';
                const statusLower = statusText.toLowerCase();
                if (statusLower.includes('delay') || statusLower.includes('critically') || statusLower.includes('deficit') || statusLower.includes('red')) {
                    statusClass = 'red';
                } else if (statusLower.includes('review') || statusLower.includes('amber')) {
                    statusClass = 'amber';
                }
                tr.innerHTML = `
                    <td><strong>${row.Section || ''}</strong></td>
                    <td>${row['Key Metric'] || row.KeyMetric || ''}</td>
                    <td>${row['Value / Detail'] || row.ValueDetail || ''}</td>
                    <td><span class="badge badge-${statusClass}">${statusText}</span></td>
                    <td>${row['Key Decision Item'] || row.KeyDecisionItem || ''}</td>
                `;
                perfBody.appendChild(tr);
            });
        }

        // Copy innerHTML to off-screen PDF tables for comprehensive report
        document.querySelector('#pdf-cashflow-table tbody').innerHTML = document.querySelector('#cashflow-table tbody').innerHTML;
        document.querySelector('#pdf-progress-table tbody').innerHTML = document.querySelector('#progress-table tbody').innerHTML;
        document.querySelector('#pdf-escalations-table tbody').innerHTML = document.querySelector('#escalations-table tbody').innerHTML;
        document.querySelector('#pdf-actions-table tbody').innerHTML = document.querySelector('#actions-table tbody').innerHTML;
        document.querySelector('#pdf-quality-table tbody').innerHTML = document.querySelector('#quality-table tbody').innerHTML;

        // Set PDF metadata
        const monthSelect = document.getElementById('filter-analysis-month');
        const selectedMonthText = monthSelect.options[monthSelect.selectedIndex].text;
        document.getElementById('pdf-report-month').textContent = selectedMonthText;
        document.getElementById('pdf-report-timestamp').textContent = new Date().toLocaleString();

        // Populate summary cards inside PDF
        document.getElementById('pdf-summary-collections').textContent = document.getElementById('summary-collections').textContent;
        document.getElementById('pdf-summary-ncf').textContent = document.getElementById('pdf-summary-ncf').textContent;
        document.getElementById('pdf-summary-sales').textContent = document.getElementById('summary-sales').textContent;
        document.getElementById('pdf-summary-escalations').textContent = document.getElementById('summary-escalations').textContent;
    };

    const renderNCFChart = (cashFlow) => {
        if (ncfChart) {
            ncfChart.destroy();
        }

        const ctx = document.getElementById('ncf-chart').getContext('2d');
        ncfChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Actual NCF', 'Target NCF'],
                datasets: [{
                    label: 'Net Cash Flow (INR)',
                    data: [
                        cashFlow['Actual NCF'] || cashFlow.ActualNCF || 0,
                        cashFlow['Target NCF'] || cashFlow.TargetNCF || 0
                    ],
                    backgroundColor: [
                        'rgba(99, 102, 241, 0.8)',
                        'rgba(255, 255, 255, 0.15)'
                    ],
                    borderColor: [
                        '#6366f1',
                        'rgba(255, 255, 255, 0.3)'
                    ],
                    borderWidth: 1.5,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: '#9ca3af',
                            callback: function(value) {
                                return '₹' + (value / 100000).toFixed(0) + 'L';
                            }
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#9ca3af' }
                    }
                }
            }
        });
    };

    // ==========================================
    // DATA WORKFLOW INTERACTIVE LOGIC
    // ==========================================
    const wfDetails = {
        sales: {
            title: '<i class="fa-solid fa-file-invoice-dollar" style="color: var(--primary-color);"></i> Sales Ingestion Variables & Quality Guards',
            body: `
                <p style="margin-bottom: 12px;"><strong>Source File:</strong> <code>AI_Assignment_Input_1_Sales_SANITIZED.xlsx</code> (Sheet: <em>Sales Dump</em>)</p>
                <p style="margin-bottom: 12px;"><strong>Ingested Variables:</strong></p>
                <ul style="margin-left: 20px; margin-bottom: 12px; list-style-type: square;">
                    <li><code>Total Agreement Amount</code>: Key value for booking velocity comparison.</li>
                    <li><code>Type</code>: Mapped to BHK size configurations (1 BHK, 2 BHK, 3 BHK).</li>
                    <li><code>Booking Date</code>: Parsed to datetime, aligned to calendar month bounds.</li>
                    <li><code>Sales Owner</code>: Responsible salesperson for subsequent escalation lists.</li>
                    <li><code>Customer Code</code> & <code>Customer Name</code>: Relational buyer identifiers.</li>
                </ul>
                <p style="margin-bottom: 12px;"><strong>Data Quality Safeguards & Fallbacks:</strong></p>
                <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); padding: 10px; border-radius: 6px; font-size: 12px; margin-bottom: 12px;">
                    <strong>Sanitizing NaNs:</strong> If <code>Sales Owner</code> is blank, the engine intercepts the NaN value and maps it to <code>"Unassigned Sales Owner"</code> to prevent downstream grouping errors.
                </div>
                <div style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2); padding: 10px; border-radius: 6px; font-size: 12px;">
                    <strong>Validation Guard:</strong> Rejects/flags files containing negative agreement amounts or future booking dates.
                </div>
            `
        },
        construction: {
            title: '<i class="fa-solid fa-person-digging" style="color: var(--success);"></i> Construction Tracking Variables & Quality Guards',
            body: `
                <p style="margin-bottom: 12px;"><strong>Source File:</strong> <code>AI_Assignment_Input_2_Construction_Tracking.xlsx</code> (Sheet: <em>R5B - Daily targets</em>)</p>
                <p style="margin-bottom: 12px;"><strong>Ingested Variables:</strong></p>
                <ul style="margin-left: 20px; margin-bottom: 12px; list-style-type: square;">
                    <li><code>Activity</code>: Milestone task identifier.</li>
                    <li><code>Actual Progress %</code>: Used to determine completion rate (100% triggers billing).</li>
                    <li><code>Delay Days</code>: Numeric indicator. Triggers alerts if delay > 15 days.</li>
                    <li><code>Delay Reason</code>: Reason text. Essential for escalation reviews.</li>
                    <li><code>Actual Cost INR</code>: Aggregated for Cost-of-Construction (CoC) cash outflow.</li>
                    <li><code>Milestone Linked</code>: The key variable linking construction progress to customer billing.</li>
                </ul>
                <p style="margin-bottom: 12px;"><strong>Data Quality Safeguards & Fallbacks:</strong></p>
                <div style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2); padding: 10px; border-radius: 6px; font-size: 12px; margin-bottom: 12px;">
                    <strong>Flagging Missing Delay Reasons:</strong> If <code>Delay Days > 0</code> but <code>Delay Reason</code> is empty/blank, the engine logs a <code>"Clarification Required"</code> warning in the Data Quality sheet, and fallbacks the cell to <code>"Not Provided"</code>.
                </div>
                <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); padding: 10px; border-radius: 6px; font-size: 12px;">
                    <strong>Cost Overrun Check:</strong> Compares <code>Actual Cost INR</code> to AOP planned budgets. Flags active alerts if overruns exceed 10%.
                </div>
            `
        },
        collections: {
            title: '<i class="fa-solid fa-file-invoice" style="color: var(--warning);"></i> Collections Tracker Variables & Quality Guards',
            body: `
                <p style="margin-bottom: 12px;"><strong>Source File:</strong> <code>AI_Assignment_Input_3_Collections_AOP.xlsx</code></p>
                <p style="margin-bottom: 12px;"><strong>Ingested Variables:</strong></p>
                <ul style="margin-left: 20px; margin-bottom: 12px; list-style-type: square;">
                    <li><code>Milestone Linked</code>: The billing stage description. Relates to Construction Activity.</li>
                    <li><code>Amount Collected</code>: Inflow cash. Used directly in Cash Flow calculations.</li>
                    <li><code>Collection Status</code>: Paid, Due, Overdue.</li>
                    <li><code>Collections Owner</code>: Assigned billing representative.</li>
                    <li><code>Outstanding Amount</code>: Unpaid dues used in collections risk aging.</li>
                </ul>
                <p style="margin-bottom: 12px;"><strong>Data Quality Safeguards & Fallbacks:</strong></p>
                <div style="background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.2); padding: 10px; border-radius: 6px; font-size: 12px; margin-bottom: 12px;">
                    <strong>Recalculating Outstanding:</strong> The engine validates if <code>Outstanding Amount = (Due - Collected)</code>. It contractually overrides empty outstanding values to maintain math sanity.
                </div>
                <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); padding: 10px; border-radius: 6px; font-size: 12px;">
                    <strong>NaT Parsing:</strong> Invalid or blank due dates are caught and parsed into NaT (Not-a-Time), ensuring date math functions do not throw critical code errors.
                </div>
            `
        },
        aop: {
            title: '<i class="fa-solid fa-bullseye" style="color: var(--danger);"></i> Annual Operations Plan (AOP) Target Alignment',
            body: `
                <p style="margin-bottom: 12px;"><strong>Source File:</strong> <code>AI_Assignment_Input_4_AOP_Targets.xlsx</code></p>
                <p style="margin-bottom: 12px;"><strong>Ingested Targets & Variables:</strong></p>
                <ul style="margin-left: 20px; margin-bottom: 12px; list-style-type: square;">
                    <li>Target Booking Values per month.</li>
                    <li>Target Collection amounts (specified in Crores).</li>
                    <li>Planned Construction CoC milestones and monthly budgets.</li>
                </ul>
                <p style="margin-bottom: 12px;"><strong>Aligning Rules & Scaling:</strong></p>
                <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); padding: 10px; border-radius: 6px; font-size: 12px; margin-bottom: 12px;">
                    <strong>Crores to Rupees Scaling:</strong> AOP Collections are specified in Crores (e.g. 35.2). The engine automatically scales these target values to Rupees (multiplies by <code>10,000,000</code>) to prevent a 10,000,000x scale error during comparison.
                </div>
                <div style="background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.2); padding: 10px; border-radius: 6px; font-size: 12px;">
                    <strong>Name Standardization:</strong> Standardizes tower name strings (e.g. mapping "Eden Square Tower B" targets to "R5B Tower") so that actual collections can be evaluated against plans.
                </div>
            `
        },
        engine: {
            title: '<i class="fa-solid fa-gears" style="color: var(--primary-color);"></i> Rules Engine: Variable Relational Linkage & Math',
            body: `
                <p style="margin-bottom: 12px;"><strong>How the Pandas Engine Links the Datasets:</strong></p>
                <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                    <p style="font-size: 12px; font-family: monospace;">
                        df_linked = pd.merge(df_construction, df_collections, on=['Milestone Linked', 'Project'], how='left')
                    </p>
                    <span style="font-size: 10px; color: var(--text-secondary);">Relates collections statuses to physical milestone completions on site.</span>
                </div>
                <p style="margin-bottom: 12px;"><strong>Cross-Functional Metric Correlations:</strong></p>
                <div style="background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.2); padding: 10px; border-radius: 6px; font-size: 12px; margin-bottom: 12px;">
                    <strong>Construction Delay ➔ Collections Deficit Correlation:</strong> If a milestone's construction progress &lt; 100%, customer invoices cannot be sent. The engine calculates delay counts and tags collections due dates on those incomplete slab milestones as locked capital.
                </div>
                <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); padding: 10px; border-radius: 6px; font-size: 12px; margin-bottom: 12px;">
                    <strong>Cash Flow Leakage Math:</strong> If construction progress is 100% (Completed) but collection status is "Due" or "Unpaid" past the due date ➔ Flags cash-flow leakage.
                </div>
                <p style="font-weight: 600; margin-bottom: 4px;">Main Net Cash Flow (NCF) Formula:</p>
                <div style="background: #0b0f19; padding: 10px; border-radius: 6px; font-family: monospace; font-size: 12px; text-align: center; border: 1px solid var(--border-color); margin-bottom: 12px;">
                    NCF = Collections Received - (Construction CoC + Other Costs)
                </div>
            `
        },
        quality: {
            title: '<i class="fa-solid fa-shield-halved" style="color: var(--warning);"></i> Data Quality Guardrail: Tackling Anomalies',
            body: `
                <p style="margin-bottom: 12px;"><strong>How Anomalies are Flagged & Tackled:</strong></p>
                <p style="margin-bottom: 12px; color: var(--text-secondary);">
                    Month-end reporting must run deterministically. Rather than crashing on bad inputs, the engine logs warnings to a separate <code>Data Quality Report</code> sheet and proceeds with logical fallbacks:
                </p>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border-color);">
                            <th style="padding: 6px; text-align: left;">Detected Anomaly</th>
                            <th style="padding: 6px; text-align: left;">Engine Flag Action</th>
                            <th style="padding: 6px; text-align: left;">Tackled Fallback State</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                            <td style="padding: 6px;">Missing Sales Owner</td>
                            <td style="padding: 6px; color: var(--warning);">Warning logged</td>
                            <td style="padding: 6px;">Mapped to "Unassigned"</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                            <td style="padding: 6px;">Empty Delay Reason</td>
                            <td style="padding: 6px; color: var(--warning);">Warning logged</td>
                            <td style="padding: 6px;">Fallback to "Not Provided"</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                            <td style="padding: 6px;">NaT / Blank Dates</td>
                            <td style="padding: 6px; color: var(--danger);">Critical flagged</td>
                            <td style="padding: 6px;">Assigned as string NaT</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px;">Unmapped tower name</td>
                            <td style="padding: 6px; color: var(--danger);">Critical flagged</td>
                            <td style="padding: 6px;">Excluded from towers groupings</td>
                        </tr>
                    </tbody>
                </table>
            `
        },
        output: {
            title: '<i class="fa-solid fa-file-shield" style="color: var(--success);"></i> Output Compilation & Distribution',
            body: `
                <p style="margin-bottom: 12px;"><strong>Output Verification & Distribution:</strong></p>
                <ul style="margin-left: 20px; margin-bottom: 12px; list-style-type: square;">
                    <li><strong>Formatted Excel Sheet:</strong> Compiles and saves 7 formatted worksheets with uniform column widths and custom styles.</li>
                    <li><strong>Interactive Web State:</strong> Returns sanitized JSON data containing collections, progress metrics, and action checklists.</li>
                    <li><strong>Auto-Draft Communications:</strong> Automatically converts active escalation items into draft notifications, addressing the designated suggested owners with specific required due dates.</li>
                </ul>
            `
        }
    };

    window.showWorkflowDetail = (nodeType) => {
        const detail = wfDetails[nodeType];
        if (!detail) return;
        
        // Highlight active node
        document.querySelectorAll('.flow-node').forEach(node => node.classList.remove('active-node'));
        const nodeEl = document.getElementById(`node-${nodeType}`);
        if (nodeEl) nodeEl.classList.add('active-node');
        
        document.getElementById('wf-detail-title').innerHTML = detail.title;
        document.getElementById('wf-detail-body').innerHTML = detail.body;
    };

    // Simulator Logic
    const btnSimulate = document.getElementById('btn-simulate');
    const simConsole = document.getElementById('sim-console');
    const simLivePreview = document.getElementById('sim-live-preview');
    const simPreviewTable = document.querySelector('#sim-preview-table tbody');
    const gearsIcon = document.getElementById('gears-icon');

    const logConsole = (msg, type='info') => {
        let color = '#9ca3af';
        if (type === 'success') color = 'var(--success)';
        if (type === 'warning') color = 'var(--warning)';
        if (type === 'danger') color = 'var(--danger)';
        if (type === 'header') color = 'var(--primary-color)';
        
        simConsole.innerHTML += `<div style="color: ${color}">&gt; ${msg}</div>`;
        simConsole.scrollTop = simConsole.scrollHeight;
    };

    if (btnSimulate) {
        btnSimulate.addEventListener('click', async () => {
            btnSimulate.disabled = true;
            simConsole.innerHTML = '';
            simPreviewTable.innerHTML = '<tr id="sim-preview-placeholder"><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 12px;">[Awaiting simulation run to populate linked dataset...]</td></tr>';
            logConsole("Initializing Pandas Rules Engine Simulator...", "header");
            await sleep(600);

            // Step 1: File Ingestion
            logConsole("Step 1: Reading Excel source files...", "header");
            showWorkflowDetail('sales');
            logConsole("Reading 'AI_Assignment_Input_1_Sales_SANITIZED.xlsx' (Sales Dump)...");
            await sleep(600);
            
            showWorkflowDetail('construction');
            logConsole("Reading 'AI_Assignment_Input_2_Construction_Tracking.xlsx' (Construction targets)...");
            await sleep(600);
            
            showWorkflowDetail('collections');
            logConsole("Reading 'AI_Assignment_Input_3_Collections_AOP.xlsx' (Collections)...");
            await sleep(600);
            
            showWorkflowDetail('aop');
            logConsole("Reading 'AI_Assignment_Input_4_AOP_Targets.xlsx' (AOP targets)...");
            await sleep(600);
            logConsole("Source files loaded successfully. Sanitizing schemas.", "success");
            await sleep(500);

            // Step 2: Quality Scan & Flagging
            logConsole("Step 2: Checking Data Quality Guardrails...", "header");
            showWorkflowDetail('quality');
            logConsole("Scanning Construction tracker for delayed activities...");
            await sleep(400);
            logConsole("FLAGGED: Milestone activity 'Eden Square Tower A slab cast' has active delay but missing 'Delay Reason'!", "warning");
            await sleep(400);
            logConsole("TACKLED: Logged warning in Quality sheet; mapped missing delay reason to 'Not Provided' fallback.", "success");
            await sleep(500);

            // Step 3: Relational Linkage
            logConsole("Step 3: Relational data merging in progress...", "header");
            showWorkflowDetail('engine');
            if (gearsIcon) gearsIcon.style.transform = "rotate(360deg)";
            logConsole("Linking files on ['Milestone Linked', 'Project', 'Month']...");
            await sleep(600);
            
            // Clear placeholder row
            const placeholder = document.getElementById('sim-preview-placeholder');
            if (placeholder) placeholder.remove();
            const mockRows = [
                { proj: 'Eden Square', mile: 'Excavation', prog: 100, amt: 66047000, stat: 'Paid' },
                { proj: 'Eden Square', mile: 'Foundation', prog: 100, amt: 120500000, stat: 'Unpaid (Leakage)' },
                { proj: 'Eden Square', mile: 'Tower A slab cast', prog: 100, amt: 45000000, stat: 'Paid' }
            ];
            
            for (let r of mockRows) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${r.proj}</td>
                    <td><strong>${r.mile}</strong></td>
                    <td>${r.prog}%</td>
                    <td>₹${(r.amt/10000000).toFixed(2)} Cr</td>
                    <td style="color: ${r.stat.includes('Paid') ? 'var(--success)' : 'var(--danger)'}; font-weight:600;">${r.stat}</td>
                `;
                simPreviewTable.appendChild(tr);
                logConsole(`Linked row: Milestone '${r.mile}' ➔ Inflow Status: ${r.stat}`);
                await sleep(500);
            }

            // Step 4: Deterministic Math
            logConsole("Step 4: Executing monthly rules calculations...", "header");
            logConsole("Collections actual: ₹6.60 Cr vs AOP Target: ₹352.00 Cr");
            logConsole("Booking actual: ₹100.16 Cr vs AOP Target: ₹335.95 Cr");
            logConsole("Construction CoC actual outflow: ₹17.98 Cr vs AOP planned: ₹226.50 Cr");
            logConsole("Result: Under-spent budget indicates slow progress, causing Collections trigger blocks.", "warning");
            await sleep(600);

            // Step 5: Compilation
            logConsole("Step 5: Compiling final outputs...", "header");
            showWorkflowDetail('output');
            logConsole("Compiling 7 formatted sheets in Site_Performance_Report.xlsx...");
            await sleep(400);
            logConsole("Compiling draft communications list...");
            await sleep(400);
            logConsole("Rules engine simulation finished successfully!", "success");
            btnSimulate.disabled = false;
        });
    }

    // Auto-run analysis on page load to populate tabs
    triggerAnalysis();
});

// PDF Export Helper using html2pdf.js
window.downloadPDF = (elementId, filename) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // Configure html2pdf parameters
    const opt = {
        margin:       [0.4, 0.4, 0.4, 0.4], // 0.4 inch margin
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
            scale: 2, 
            useCORS: true, 
            backgroundColor: '#0b0f19' // Keep the premium dark theme background color
        },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' } // Landscape is perfect for wide tables!
    };
    
    // Generate and save the PDF
    html2pdf().set(opt).from(element).save();
};

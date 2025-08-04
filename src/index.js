// Global variables
let salesData = null;
let filteredData = null;
let userFilter = '';
let sortConfig = {
  key: null,
  direction: 'asc',
  year: null // for year-specific columns
};

// Main function that FileMaker can call
window.generateReport = function(json) {
  console.log('Generating report with data:', json);
  
  const data = JSON.parse(json);

  // Handle both direct data and JSON string
  if (typeof data === 'string') {
    try {
      salesData = JSON.parse(data);
    } catch (e) {
      console.error('Error parsing JSON data:', e);
      return;
    }
  } else {
    salesData = data;
  }
  
  // Extract the value array if it exists (FileMaker OData format)
  if (salesData && salesData.value) {
    salesData = salesData.value;
  }
  
  if (!Array.isArray(salesData)) {
    console.error('Invalid data format - expected array');
    return;
  }
  
  initializeInterface();
  generateReportTable();
};

// Initialize the interface
function initializeInterface() {
  populateUserFilter();
  setupEventListeners();
}

// Populate the user filter dropdown
function populateUserFilter() {
  const userSelect = document.getElementById('userFilter');
  const users = [...new Set(salesData.map(item => item.User))].sort();
  
  // Clear existing options except "All Users"
  userSelect.innerHTML = '<option value="">All Users</option>';
  
  users.forEach(user => {
    const option = document.createElement('option');
    option.value = user;
    option.textContent = user;
    userSelect.appendChild(option);
  });
}

// Setup event listeners
function setupEventListeners() {
  const userSelect = document.getElementById('userFilter');
  userSelect.addEventListener('change', (e) => {
    userFilter = e.target.value;
    generateReportTable();
  });
  
  // Export button listeners
  const exportCSVBtn = document.getElementById('exportCSV');
  const exportPDFBtn = document.getElementById('exportPDF');
  
  if (exportCSVBtn) {
    exportCSVBtn.addEventListener('click', exportToCSV);
  }
  
  if (exportPDFBtn) {
    exportPDFBtn.addEventListener('click', exportToPDF);
  }
}

// Sort accounts within a ranking
function sortAccounts(accounts, sortKey, direction, year = null) {
  return [...accounts].sort((a, b) => {
    let aValue, bValue;
    
    if (year) {
      // Year-specific sorting
      const aYearData = a.years[year] || { totalSales: 0, totalMargin: 0, count: 0 };
      const bYearData = b.years[year] || { totalSales: 0, totalMargin: 0, count: 0 };
      
      switch (sortKey) {
        case 'totalSales':
          aValue = aYearData.totalSales;
          bValue = bYearData.totalSales;
          break;
        case 'totalMargin':
          aValue = aYearData.totalMargin;
          bValue = bYearData.totalMargin;
          break;
        case 'count':
          aValue = aYearData.count;
          bValue = bYearData.count;
          break;
        default:
          return 0;
      }
    } else {
      // Total columns sorting
      switch (sortKey) {
        case 'totalSales':
          aValue = a.totalSales;
          bValue = b.totalSales;
          break;
        case 'totalMargin':
          aValue = a.totalMargin;
          bValue = b.totalMargin;
          break;
        case 'count':
          aValue = a.totalCount;
          bValue = b.totalCount;
          break;
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        default:
          return 0;
      }
    }
    
    if (direction === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });
}

// Handle column sorting
function handleSort(key, year = null) {
  // Toggle direction if same column, otherwise default to descending for numbers, ascending for text
  if (sortConfig.key === key && sortConfig.year === year) {
    sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
  } else {
    sortConfig.direction = key === 'name' ? 'asc' : 'desc';
  }
  
  sortConfig.key = key;
  sortConfig.year = year;
  
  generateReportTable();
}

// Get sort indicator for column headers
function getSortIndicator(key, year = null) {
  if (sortConfig.key === key && sortConfig.year === year) {
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  }
  return '';
}

// Filter data based on selected user
function filterData() {
  if (!userFilter) {
    filteredData = salesData;
  } else {
    filteredData = salesData.filter(item => item.User === userFilter);
  }
}

// Generate the main report table
function generateReportTable() {
  filterData();
  
  if (!filteredData || filteredData.length === 0) {
    document.getElementById('reportContent').innerHTML = '<div class="no-data">No data available for the selected filters.</div>';
    return;
  }
  
  const processedData = processData(filteredData);
  const reportHTML = buildReportHTML(processedData);
  
  document.getElementById('reportContent').innerHTML = reportHTML;
}

// Process the raw data into the format needed for the report
function processData(data) {
  const accountData = {};
  
  // Group data by account
  data.forEach(item => {
    // Exclude records with canceled status or Test Corp accounts
    const status = item.Status || '';
    const account = item.Account || '';
    
    // Skip canceled records
    if (status.toLowerCase().includes('canceled')) {
      return;
    }
    
    // Skip Test Corp accounts (handle variations with/without carriage returns)
    if (account.replace(/\r/g, '').trim() === 'Test Corp') {
      return;
    }
    
    const year = new Date(item.Date).getFullYear();
    const total = parseFloat(item.Total) || 0;
    const profit = parseFloat(item.Profit) || 0;
    
    if (!accountData[account]) {
      accountData[account] = {
        name: account,
        years: {},
        totalSales: 0,
        totalMargin: 0,
        totalCount: 0
      };
    }
    
    if (!accountData[account].years[year]) {
      accountData[account].years[year] = {
        totalSales: 0,
        totalMargin: 0,
        count: 0
      };
    }
    
    accountData[account].years[year].totalSales += total;
    accountData[account].years[year].totalMargin += profit;
    accountData[account].years[year].count += 1;
    
    accountData[account].totalSales += total;
    accountData[account].totalMargin += profit;
    accountData[account].totalCount += 1;
  });
  
  // Convert to array and calculate rankings
  const accounts = Object.values(accountData);
  
  accounts.forEach(account => {
    if (account.totalMargin > 30000) {
      account.ranking = 'A';
    } else if (account.totalMargin < 3000) {
      account.ranking = 'C';
    } else {
      account.ranking = 'B';
    }
  });
  
  // Group by ranking
  const rankings = {
    'A': { accounts: [], totalSales: 0, totalMargin: 0, totalCount: 0 },
    'B': { accounts: [], totalSales: 0, totalMargin: 0, totalCount: 0 },
    'C': { accounts: [], totalSales: 0, totalMargin: 0, totalCount: 0 }
  };
  
  accounts.forEach(account => {
    const ranking = account.ranking;
    rankings[ranking].accounts.push(account);
    rankings[ranking].totalSales += account.totalSales;
    rankings[ranking].totalMargin += account.totalMargin;
    rankings[ranking].totalCount += account.totalCount;
  });
  
  // Sort accounts within each ranking
  Object.values(rankings).forEach(ranking => {
    if (sortConfig.key) {
      ranking.accounts = sortAccounts(ranking.accounts, sortConfig.key, sortConfig.direction, sortConfig.year);
    } else {
      // Default sort by 3-year total margin (descending)
      ranking.accounts.sort((a, b) => b.totalMargin - a.totalMargin);
    }
  });
  
  return rankings;
}

// Build the HTML for the report
function buildReportHTML(rankings) {
  // Extract unique years from the data and sort in descending order
  const yearsSet = new Set();
  Object.values(rankings).forEach(ranking => {
    ranking.accounts.forEach(account => {
      Object.keys(account.years).forEach(year => {
        yearsSet.add(parseInt(year));
      });
    });
  });
  const years = Array.from(yearsSet).sort((a, b) => b - a);
  
  let html = '';
  
  ['A', 'B', 'C'].forEach(rank => {
    const rankingData = rankings[rank];
    if (rankingData.accounts.length === 0) return;
    
    const rankLabel = rank === 'A' ? 'A (>$30K margin)' : rank === 'B' ? 'B ($3K-$30K margin)' : 'C (<$3K margin)';
    
    html += `
      <div class="ranking-section">
        <div class="ranking-header rank-${rank.toLowerCase()}">
          <span>Rank ${rankLabel}</span>
          <span class="ranking-summary">
            ${rankingData.accounts.length} accounts | 
            ${formatCurrency(rankingData.totalSales)} total sales | 
            ${formatCurrency(rankingData.totalMargin)} total margin
          </span>
        </div>
        
        <table class="report-table">
          <thead>
            <tr>
              <th rowspan="2" class="account-name sortable" onclick="handleSort('name')">
                Account Name ${getSortIndicator('name')}
              </th>
              ${years.map(year => `
                <th colspan="3" class="year-group">${year}</th>
              `).join('')}
              <th colspan="3" class="total-group">3-Year Total</th>
            </tr>
            <tr>
              ${years.map(year => `
                <th class="year-group sortable" onclick="handleSort('totalSales', ${year})">
                  Total Sales ${getSortIndicator('totalSales', year)}
                </th>
                <th class="year-group sortable" onclick="handleSort('totalMargin', ${year})">
                  Total Margin ${getSortIndicator('totalMargin', year)}
                </th>
                <th class="year-group sortable" onclick="handleSort('count', ${year})">
                  # ${getSortIndicator('count', year)}
                </th>
              `).join('')}
              <th class="total-group sortable" onclick="handleSort('totalSales')">
                Total Sales ${getSortIndicator('totalSales')}
              </th>
              <th class="total-group sortable" onclick="handleSort('totalMargin')">
                Total Margin ${getSortIndicator('totalMargin')}
              </th>
              <th class="total-group sortable" onclick="handleSort('count')">
                # ${getSortIndicator('count')}
              </th>
            </tr>
          </thead>
          <tbody>
            ${rankingData.accounts.map(account => generateAccountRow(account, years)).join('')}
            ${generateSummaryRow(rankingData, years)}
          </tbody>
        </table>
      </div>
    `;
  });
  
  return html;
}

// Generate a single account row
function generateAccountRow(account, years) {
  let html = `<tr>
    <td class="account-name">${account.name}</td>`;
  
  // Year columns
  years.forEach(year => {
    const yearData = account.years[year] || { totalSales: 0, totalMargin: 0, count: 0 };
    html += `
      <td class="currency year-group">${formatCurrency(yearData.totalSales)}</td>
      <td class="currency year-group ${yearData.totalMargin >= 0 ? 'positive' : 'negative'}">${formatCurrency(yearData.totalMargin)}</td>
      <td class="count year-group">${yearData.count}</td>
    `;
  });
  
  // Total columns
  html += `
    <td class="currency total-group">${formatCurrency(account.totalSales)}</td>
    <td class="currency total-group ${account.totalMargin >= 0 ? 'positive' : 'negative'}">${formatCurrency(account.totalMargin)}</td>
    <td class="count total-group">${account.totalCount}</td>
  `;
  
  html += '</tr>';
  return html;
}

// Generate summary row for a ranking
function generateSummaryRow(rankingData, years) {
  let html = `<tr class="summary-row">
    <td class="account-name">RANK TOTAL</td>`;
  
  // Calculate year totals for this ranking
  years.forEach(year => {
    let yearSales = 0;
    let yearMargin = 0;
    let yearCount = 0;
    
    rankingData.accounts.forEach(account => {
      const yearData = account.years[year] || { totalSales: 0, totalMargin: 0, count: 0 };
      yearSales += yearData.totalSales;
      yearMargin += yearData.totalMargin;
      yearCount += yearData.count;
    });
    
    html += `
      <td class="currency year-group">${formatCurrency(yearSales)}</td>
      <td class="currency year-group ${yearMargin >= 0 ? 'positive' : 'negative'}">${formatCurrency(yearMargin)}</td>
      <td class="count year-group">${yearCount}</td>
    `;
  });
  
  // Total columns
  html += `
    <td class="currency total-group">${formatCurrency(rankingData.totalSales)}</td>
    <td class="currency total-group ${rankingData.totalMargin >= 0 ? 'positive' : 'negative'}">${formatCurrency(rankingData.totalMargin)}</td>
    <td class="count total-group">${rankingData.totalCount}</td>
  `;
  
  html += '</tr>';
  return html;
}

// Format currency values
function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

// Initialize with sample data for testing
document.addEventListener('DOMContentLoaded', async () => {
  // Check if we're running on file:// protocol or HTTP
  if (window.location.protocol === 'file:') {
    console.log('Running on file:// protocol - cannot load sample data via fetch');
    document.getElementById('reportContent').innerHTML = '<div class="no-data">Waiting for data from FileMaker...</div>';
  } else {
    try {
      // Try to load sample data for testing (only works on HTTP)
      const response = await fetch('./data.json');
      const data = await response.json();
      generateReport(JSON.stringify(data));
    } catch (error) {
      console.log('No sample data available - waiting for FileMaker data');
      document.getElementById('reportContent').innerHTML = '<div class="no-data">Waiting for data from FileMaker...</div>';
    }
  }
});

// Export functions for global access
window.generateReport = generateReport;
window.handleSort = handleSort;
window.exportToCSV = exportToCSV;
window.exportToPDF = exportToPDF;
window.exportToCSV = exportToCSV;

// Test function for demonstration
window.testReport = function() {
  // Sample test data in the expected format
  const testData = {
    "value": [
      {
        "Account": "Test Company A",
        "Account_ID": "test1",
        "Date": "2025-01-15",
        "Profit": 5000,
        "Total": 25000,
        "User": "John Smith"
      },
      {
        "Account": "Test Company B", 
        "Account_ID": "test2",
        "Date": "2024-06-10",
        "Profit": 1200,
        "Total": 8000,
        "User": "Jane Doe"
      },
      {
        "Account": "Test Company C",
        "Account_ID": "test3", 
        "Date": "2023-03-22",
        "Profit": 800,
        "Total": 2500,
        "User": "John Smith"
      }
    ]
  };
  
  generateReport(JSON.stringify(testData));
};

// Export to PDF functionality
function exportToPDF() {
  // Show export overlay
  const overlay = document.getElementById('exportOverlay');
  if (overlay) overlay.classList.remove('hide');
  try {
    const exportBtn = document.getElementById('exportPDF');
    exportBtn.disabled = true;
    exportBtn.textContent = '📄 Exporting...';
    
    // Get the report content
    const reportContent = document.getElementById('reportContent');
    
    if (!reportContent || reportContent.innerHTML.includes('no-data')) {
      alert('No report data available to export');
      return;
    }
    
    // Create a copy for PDF export (without interactive elements)
    const clonedContent = reportContent.cloneNode(true);
    
    // Remove sortable onclick handlers and hover effects
    const sortableElements = clonedContent.querySelectorAll('.sortable');
    sortableElements.forEach(el => {
      el.removeAttribute('onclick');
      el.style.cursor = 'default';
    });
    
    // Remove any iframes to prevent html2canvas iframe errors
    clonedContent.querySelectorAll('iframe').forEach(iframe => iframe.remove());
    // Append cloned content to a hidden wrapper so html2canvas can find it
    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.top = '0';
    wrapper.style.left = '0';
    wrapper.style.opacity = '0';
    wrapper.style.pointerEvents = 'none';
    wrapper.appendChild(clonedContent);
    document.body.appendChild(wrapper);
    // Use html2canvas to capture the content
    html2canvas(clonedContent, {
      scale: 2,
      backgroundColor: '#ffffff',
      height: clonedContent.scrollHeight,
      width: clonedContent.scrollWidth,
      useCORS: true
    }).then(canvas => {
      
      // Create PDF with .5in margins
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('l', 'mm', 'a4'); // landscape orientation
      const margin = 12.7; // 0.5 inch base margin in mm
      const marginTop = margin + 5;    // add extra 5mm at top
      const marginBottom = margin + 5; // add extra 5mm at bottom
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 2 * margin;
      let position = marginTop;
      
      // Add title
      pdf.setFontSize(16);
      const userFilterText = userFilter ? ` (Filtered by: ${userFilter})` : '';
      pdf.text(`Customer Ranking - 3 Year Report${userFilterText}`, margin, position);
      position += 10;
      
      // Slice the canvas into page-sized portions with top/bottom margins
      const usablePageHeightMm = pageHeight - marginTop - marginBottom;
      const sliceHeightPx = Math.floor(usablePageHeightMm * canvas.width / imgWidth);
      let yOffsetPx = 0;
      let isFirstPage = true;
      while (yOffsetPx < canvas.height) {
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.min(sliceHeightPx, canvas.height - yOffsetPx);
        const ctx = pageCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, yOffsetPx, canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height);
        const pageImgData = pageCanvas.toDataURL('image/png');
        const pageImgHeightMm = pageCanvas.height * imgWidth / canvas.width;
        if (isFirstPage) {
          pdf.addImage(pageImgData, 'PNG', margin, position, imgWidth, pageImgHeightMm);
          isFirstPage = false;
        } else {
          pdf.addPage();
          pdf.addImage(pageImgData, 'PNG', margin, margin, imgWidth, pageImgHeightMm);
        }
        yOffsetPx += pageCanvas.height;
      }
      // Prepare PDF data for FileMaker
      const userFilterFile = userFilter ? `_${userFilter.replace(/\s+/g, '_')}` : '';
      const filename = `Customer_Ranking_Report${userFilterFile}_${new Date().toISOString().split('T')[0]}.pdf`;
      // Get Base64 string (strip prefix)
      const pdfDataUri = pdf.output('datauristring');
      const pdfBase64 = pdfDataUri.split(',')[1];

      const scriptParameter = {
        pdfData: pdfBase64,
        filename: filename,
        mode: 'exportPDF',
        userFilter: userFilter || '',
        generatedDate: new Date().toISOString()
      };
      // Call FileMaker script to import PDF
      if (window.FileMaker && window.FileMaker.PerformScript) {
        window.FileMaker.PerformScript('ImportPDF', JSON.stringify(scriptParameter));
      } else if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.FileMaker) {
        window.webkit.messageHandlers.FileMaker.postMessage({
          script: 'ImportPDF',
          parameter: JSON.stringify(scriptParameter)
        });
      } else if (window.fmp && window.fmp.performScript) {
        window.fmp.performScript('ImportPDF', JSON.stringify(scriptParameter));
      } else {
        const encodedParam = encodeURIComponent(JSON.stringify(scriptParameter));
        window.location.href = `fmp://$/ImportPDF?script=${encodedParam}`;
      }
      // Remove the hidden wrapper after capture
      document.body.removeChild(wrapper);
    }).catch(error => {
      console.error('PDF export error:', error);
      alert('Error exporting to PDF. Please try again.');
      // Clean up wrapper on error
      document.body.removeChild(wrapper);
    });
    
  } catch (error) {
    console.error('PDF export error:', error);
    alert('Error exporting to PDF. Please try again.');
  } finally {
    // Hide export overlay
    if (overlay) overlay.classList.add('hide');
    const exportBtn = document.getElementById('exportPDF');
    exportBtn.disabled = false;
    exportBtn.textContent = '📄 Export to PDF';
  }
}

// Export CSV for FileMaker - Calls FileMaker script with CSV data
function exportToCSV() {
  // Show export overlay
  const overlay = document.getElementById('exportOverlay');
  if (overlay) overlay.classList.remove('hide');
  try {
    const exportBtn = document.getElementById('exportCSV');
    exportBtn.disabled = true;
    exportBtn.textContent = '📋 Exporting...';
    
    // Get current filter for filename
    const userFilterText = userFilter ? `_${userFilter.replace(/\s+/g, '_')}` : '';
    const filename = `Customer_Ranking_Report${userFilterText}_${new Date().toISOString().split('T')[0]}.csv`;
    
    const processedData = processData(filteredData);
    
    // Extract years dynamically
    const yearsSet = new Set();
    Object.values(processedData).forEach(ranking => {
      ranking.accounts.forEach(account => {
        Object.keys(account.years).forEach(year => {
          yearsSet.add(parseInt(year));
        });
      });
    });
    const years = Array.from(yearsSet).sort((a, b) => b - a);
    
    let csvContent = '';
    
    // Add header with report info
    csvContent += `Customer Ranking - 3 Year Report\n`;
    if (userFilter) {
      csvContent += `Filtered by User: ${userFilter}\n`;
    }
    csvContent += `Generated: ${new Date().toLocaleDateString()}\n\n`;
    
    // Process each ranking
    ['A', 'B', 'C'].forEach(rank => {
      const rankingData = processedData[rank];
      if (rankingData.accounts.length === 0) return;
      
      const rankLabel = rank === 'A' ? 'A (>$30K margin)' : rank === 'B' ? 'B ($3K-$30K margin)' : 'C (<$3K margin)';
      
      csvContent += `Rank ${rankLabel}\n`;
      
      // Header row
      let header = 'Account Name';
      years.forEach(year => {
        header += `,${year} Total Sales,${year} Total Margin,${year} # Sales`;
      });
      header += ',3-Year Total Sales,3-Year Total Margin,3-Year # Sales';
      csvContent += header + '\n';
      
      // Data rows
      rankingData.accounts.forEach(account => {
        let row = `"${account.name.replace(/"/g, '""')}"`;  // Escape quotes in account names
        
        years.forEach(year => {
          const yearData = account.years[year] || { totalSales: 0, totalMargin: 0, count: 0 };
          row += `,${yearData.totalSales},${yearData.totalMargin},${yearData.count}`;
        });
        
        row += `,${account.totalSales},${account.totalMargin},${account.totalCount}`;
        csvContent += row + '\n';
      });
      
      // Summary row
      let summaryRow = '"RANK TOTAL"';
      years.forEach(year => {
        let yearSales = 0, yearMargin = 0, yearCount = 0;
        rankingData.accounts.forEach(account => {
          const yearData = account.years[year] || { totalSales: 0, totalMargin: 0, count: 0 };
          yearSales += yearData.totalSales;
          yearMargin += yearData.totalMargin;
          yearCount += yearData.count;
        });
        summaryRow += `,${yearSales},${yearMargin},${yearCount}`;
      });
      summaryRow += `,${rankingData.totalSales},${rankingData.totalMargin},${rankingData.totalCount}`;
      csvContent += summaryRow + '\n\n';
    });
    
    // Call FileMaker script with CSV data and filename
    const scriptParameter = {
      csvData: csvContent,
      filename: filename,
      mode: 'exportCSV',
      userFilter: userFilter || '',
      generatedDate: new Date().toISOString()
    };
    
    // Try different methods to call FileMaker script
    if (window.FileMaker && window.FileMaker.PerformScript) {
      // FileMaker 19+ Web Viewer API
      window.FileMaker.PerformScript('Manage: ABC 3 Year', JSON.stringify(scriptParameter));
    } else if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.FileMaker) {
      // iOS/WebKit FileMaker method
      window.webkit.messageHandlers.FileMaker.postMessage({
        script: 'Manage: ABC 3 Year',
        parameter: JSON.stringify(scriptParameter)
      });
    } else if (window.fmp && window.fmp.performScript) {
      // Older FileMaker method
      window.fmp.performScript('Manage: ABC 3 Year', JSON.stringify(scriptParameter));
    } else {
      // Fallback: try fmp:// URL scheme
      const encodedParam = encodeURIComponent(JSON.stringify(scriptParameter));
      window.location.href = `fmp://$/Manage: ABC 3 Year?script=${encodedParam}`;
    }
 
  } catch (error) {
    console.error('CSV export error:', error);
  } finally {
    // Hide export overlay
    if (overlay) overlay.classList.add('hide');
    const exportBtn = document.getElementById('exportCSV');
    exportBtn.disabled = false;
    exportBtn.textContent = '📋 Export CSV';
  }
}
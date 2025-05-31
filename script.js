// KML/KMZ to CSV Converter
class KMLConverter {
    constructor() {
        this.fileInput = document.getElementById('fileInput');
        this.dropZone = document.getElementById('dropZone');
        this.browseBtn = document.getElementById('browseBtn');
        this.processingStatus = document.getElementById('processingStatus');
        this.resultsSection = document.getElementById('resultsSection');
        this.errorSection = document.getElementById('errorSection');
        this.errorMessage = document.getElementById('errorMessage');
        this.filesList = document.getElementById('filesList');

        this.initEventListeners();
    }

    initEventListeners() {
        // File input change event
        this.fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));

        // Browse button click
        this.browseBtn.addEventListener('click', () => this.fileInput.click());

        // Drag and drop events
        this.dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.dropZone.addEventListener('drop', (e) => this.handleDrop(e));
    }

    handleDragOver(e) {
        e.preventDefault();
        this.dropZone.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        if (!this.dropZone.contains(e.relatedTarget)) {
            this.dropZone.classList.remove('dragover');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        this.dropZone.classList.remove('dragover');
        this.handleFiles(e.dataTransfer.files);
    }

    async handleFiles(files) {
        if (files.length === 0) return;

        this.showProcessing();
        this.hideError();
        this.hideResults();

        try {
            const results = [];
            
            for (const file of files) {
                const result = await this.processFile(file);
                results.push(result);
            }

            this.showResults(results);
            this.hideProcessing();
        } catch (error) {
            this.showError(error.message);
            this.hideProcessing();
        }
    }

    async processFile(file) {
        const fileName = file.name;
        const fileExtension = fileName.split('.').pop().toLowerCase();

        if (fileExtension === 'kmz') {
            return await this.processKMZFile(file);
        } else if (fileExtension === 'kml') {
            return await this.processKMLFile(file);
        } else {
            throw new Error('Unsupported file format. Please use .kml or .kmz files.');
        }
    }

    async processKMZFile(file) {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);
        const results = [];

        for (const [filename, zipEntry] of Object.entries(zipContent.files)) {
            if (filename.endsWith('.kml') && !zipEntry.dir) {
                const kmlContent = await zipEntry.async('text');
                const csvData = this.parseKMLToCSV(kmlContent);
                const csvBlob = this.createCSVBlob(csvData);
                
                results.push({
                    name: filename.replace('.kml', ''),
                    originalName: file.name,
                    csvBlob: csvBlob,
                    rowCount: csvData.length - 1 // Exclude header
                });
            }
        }

        return { type: 'kmz', files: results };
    }

    async processKMLFile(file) {
        const kmlContent = await this.readFileAsText(file);
        const csvData = this.parseKMLToCSV(kmlContent);
        const csvBlob = this.createCSVBlob(csvData);

        return {
            type: 'kml',
            files: [{
                name: file.name.replace('.kml', ''),
                originalName: file.name,
                csvBlob: csvBlob,
                rowCount: csvData.length - 1 // Exclude header
            }]
        };
    }

    parseKMLToCSV(kmlContent) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(kmlContent, 'text/xml');
        
        // Check for parsing errors
        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
            throw new Error('Invalid KML file format');
        }

        const placemarks = xmlDoc.getElementsByTagName('Placemark');
        const csvData = [];

        // Define the exact header order as requested
        const headerArray = [
            'HOMEPASS_ID',
            'CLUSTER_NAME', 
            'PREFIX_ADDRESS',
            'STREET_NAME',
            'HOUSE_NUMBER',
            'BLOCK',
            'FLOOR',
            'RT',
            'RW',
            'DISTRICT',
            'SUB_DISTRICT',
            'FDT_CODE',
            'FAT_CODE',
            'BUILDING_LATITUDE',
            'BUILDING_LONGITUDE',
            'Category_BizPass',
            'POST_CODE',
            'ADDRESS_POLE___FAT',
            'OV_UG',
            'HOUSE_COMMENT_',
            'BUILDING_NAME',
            'TOWER',
            'APTN',
            'FIBER_NODE__HFC_',
            'ID_Area',
            'Clamp_Hook_ID'
        ];
        
        csvData.push(headerArray);

        // Extract data for each placemark
        for (const placemark of placemarks) {
            const row = {};
            
            // Initialize all fields with empty string
            headerArray.forEach(header => {
                row[header] = '';
            });

            // Get extended data
            const extendedData = placemark.getElementsByTagName('ExtendedData')[0];
            if (extendedData) {
                const simpleData = extendedData.getElementsByTagName('SimpleData');
                for (const data of simpleData) {
                    const name = data.getAttribute('name');
                    const value = data.textContent.trim();
                    if (headerArray.includes(name)) {
                        row[name] = value;
                    }
                }
            }

            // Create row array in the exact order of headers
            const rowArray = headerArray.map(header => row[header] || '');
            csvData.push(rowArray);
        }

        return csvData;
    }

    createCSVBlob(csvData) {
        const csvContent = csvData.map(row => {
            return row.map(field => {
                // Escape quotes and wrap in quotes if necessary
                if (typeof field === 'string' && (field.includes(',') || field.includes('"') || field.includes('\n'))) {
                    return '"' + field.replace(/"/g, '""') + '"';
                }
                return field;
            }).join(',');
        }).join('\n');

        return new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    downloadCSV(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    showProcessing() {
        this.processingStatus.classList.remove('hidden');
    }

    hideProcessing() {
        this.processingStatus.classList.add('hidden');
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorSection.classList.remove('hidden');
    }

    hideError() {
        this.errorSection.classList.add('hidden');
    }

    showResults(results) {
        this.filesList.innerHTML = '';
        
        results.forEach((result, index) => {
            result.files.forEach((file, fileIndex) => {
                const resultCard = this.createResultCard(file, index, fileIndex);
                this.filesList.appendChild(resultCard);
            });
        });

        this.resultsSection.classList.remove('hidden');
    }

    hideResults() {
        this.resultsSection.classList.add('hidden');
    }

    createResultCard(file, resultIndex, fileIndex) {
        const card = document.createElement('div');
        card.className = 'result-card bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow';
        
        card.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex-1">
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">${file.name}</h3>
                    <p class="text-sm text-gray-600 mb-3">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ${file.rowCount} records
                        </span>
                        <span class="ml-2 text-gray-500">from ${file.originalName}</span>
                    </p>
                    <div class="flex flex-wrap gap-2">
                        <button 
                            onclick="converter.downloadCSV(converter.getFileBlob(${resultIndex}, ${fileIndex}), '${file.name}')"
                            class="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            <span>Download CSV</span>
                        </button>
                    </div>
                </div>
                <div class="ml-4">
                    <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                </div>
            </div>
        `;

        return card;
    }

    getFileBlob(resultIndex, fileIndex) {
        // This method will be used to retrieve the blob when downloading
        // We need to store results globally for this to work
        return this.lastResults[resultIndex].files[fileIndex].csvBlob;
    }
}

// Initialize the converter when the page loads
let converter;
document.addEventListener('DOMContentLoaded', () => {
    converter = new KMLConverter();
    
    // Store results globally for download access
    const originalShowResults = converter.showResults.bind(converter);
    converter.showResults = function(results) {
        this.lastResults = results;
        originalShowResults(results);
    };
});
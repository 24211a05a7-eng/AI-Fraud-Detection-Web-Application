import React, { useState } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, FileText, Download } from 'lucide-react';

export default function BatchUpload({ apiBase, onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // Trigger download of a mock template CSV
  const handleDownloadTemplate = () => {
    const csvContent = 
      "amount,type,origin_id,dest_id,old_balance_org,new_balance_orig,old_balance_dest,new_balance_dest,geo_mismatch,velocity\n" +
      "450000.00,UPI,C102948203,M829104820,450000.00,0.00,0.00,450000.00,1,1\n" +
      "12500.50,UPI,C394029481,M294029402,45000.00,32499.50,0.00,0.00,0,1\n" +
      "80000.00,CASH_OUT,C492049102,C920491029,80000.00,0.00,32000.00,112000.00,1,6\n" +
      "50000.00,NEFT,C294019482,C940294029,200000.00,150000.00,105000.00,155000.00,0,2\n" +
      "150000.00,RTGS,C892019402,C392019402,1000000.00,1150000.00,500000.00,350000.00,0,1\n";
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "transaction_scan_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile);
      setError(null);
      setResult(null);
    } else {
      setError("Please drop a valid CSV file.");
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.name.endsWith('.csv')) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
    } else {
      setError("Please select a valid CSV file.");
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setResult(null);
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const response = await fetch(`${apiBase}/predict-bulk`, {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      if (response.ok) {
        setResult(data);
        onUploadSuccess();
      } else {
        setError(data.detail || "Bulk scan failed. Check CSV formatting.");
      }
    } catch (e) {
      setError("Server connection lost. Try again later.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      
      {/* Description card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <FileText size={22} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-800 text-[15px]">Offline Batch Analysis Engine</h3>
            <p className="text-xs text-slate-500 mt-1">
              Upload a transaction ledger in CSV format to classify large volumes of transactions. Our ensemble model pipeline will scan and record predictions for every record in the file.
            </p>
            <button
              onClick={handleDownloadTemplate}
              className="mt-3.5 inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <Download size={14} />
              Download Standard Template CSV
            </button>
          </div>
        </div>
      </section>

      {/* Upload Box Dropzone */}
      <section className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm flex flex-col items-center">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full max-w-xl border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
            dragOver 
              ? 'border-indigo-500 bg-indigo-50/20' 
              : 'border-slate-200 hover:border-indigo-400 bg-slate-50/50'
          }`}
          onClick={() => document.getElementById('csv-file-input').click()}
        >
          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileSelect}
          />
          <UploadCloud size={40} className="text-slate-400 mb-3" />
          <h4 className="font-semibold text-sm text-slate-800">
            {file ? file.name : "Drag & Drop CSV File here"}
          </h4>
          <p className="text-[11px] text-slate-400 font-semibold mt-1">
            {file ? `${(file.size / 1024).toFixed(1)} KB` : "or click to browse local files"}
          </p>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-4 py-2">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {file && (
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => { setFile(null); setResult(null); setError(null); }}
              disabled={isUploading}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Clear
            </button>
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isUploading ? "Scanning Batch..." : "Execute Scan"}
            </button>
          </div>
        )}
      </section>

      {/* Uploading progress bar simulation */}
      {isUploading && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Analyzing transactions...</span>
            <span>Running models inference</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div className="bg-indigo-500 h-full rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {/* Result metrics card */}
      {result && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 animate-fade-in">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
            <CheckCircle className="text-green-500" size={20} />
            <h4 className="font-semibold text-slate-800 text-[15px]">Scan Operations Completed</h4>
          </div>

          <div className="grid grid-cols-3 gap-6 text-center">
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Processed Rows</span>
              <span className="text-xl font-bold text-slate-800 mt-1 block">{result.processed_records}</span>
            </div>
            <div className="bg-rose-50/50 rounded-lg p-4 border border-rose-100/50">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">Flagged Threats</span>
              <span className="text-xl font-bold text-rose-600 mt-1 block">{result.flagged_fraud_records}</span>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Batch Threat Rate</span>
              <span className="text-xl font-bold text-slate-800 mt-1 block">
                {((result.flagged_fraud_records / result.processed_records) * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="bg-amber-50/40 border border-amber-100 text-[11px] font-semibold text-amber-800 rounded-lg p-3">
            Note: All scanned records have been ingested into the database and are now reviewable in the Historical Ledger tab.
          </div>
        </section>
      )}
    </div>
  );
}

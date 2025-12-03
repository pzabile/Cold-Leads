import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { extractLeadsFromFile } from './services/geminiService';
import { Lead, ProcessingStatus } from './types';
import LeadTable from './components/LeadTable';
import { Upload, FileSpreadsheet, Sparkles, Loader2, AlertCircle, Layers, Settings } from 'lucide-react';

const App: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [isDragActive, setIsDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Campaign Settings
  const [senderName, setSenderName] = useState("");
  const [companyName, setCompanyName] = useState("");

  // Stats
  const totalLeads = leads.length;
  const duplicateCount = leads.filter(l => l.isDuplicate).length;
  const newLeads = totalLeads - duplicateCount;

  // --- File Processing Helper ---
  const readFile = (file: File): Promise<{ content: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      if (file.type.startsWith("image/")) {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve({ content: base64Data, mimeType: file.type });
        };
        reader.readAsDataURL(file);
      } else if (
        file.type === "text/csv" || 
        file.type === "text/plain" || 
        file.name.endsWith('.csv') || 
        file.name.endsWith('.txt')
      ) {
        reader.onload = () => resolve({ content: reader.result as string, mimeType: "text/plain" });
        reader.readAsText(file);
      } else {
        reject(new Error(`Unsupported file type: ${file.name}`));
      }
      
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    });
  };

  // --- Main Processing Logic ---
  const processFiles = async (files: FileList) => {
    if (files.length === 0) return;
    
    // Limit to 10 files
    if (files.length > 10) {
      setErrorMsg("Please upload a maximum of 10 files at a time.");
      return;
    }

    setStatus(ProcessingStatus.PROCESSING);
    setErrorMsg(null);

    const fileArray = Array.from(files);
    const newLeadsAccumulator: Lead[] = [];
    const errors: string[] = [];

    try {
      // Process files concurrently
      const promises = fileArray.map(async (file) => {
        try {
          const { content, mimeType } = await readFile(file);
          // Pass campaign settings to extraction service
          const extractedData = await extractLeadsFromFile(content, mimeType, senderName, companyName);
          
          if (extractedData.length === 0) {
            console.warn(`No leads found in ${file.name}`);
            return [];
          }

          // Map to Lead objects immediately
          return extractedData.map(item => ({
            id: crypto.randomUUID(),
            fullName: item.fullName,
            phoneNumber: item.phoneNumber,
            outreachMessage: item.outreachMessage,
            sourceFile: file.name,
            isDuplicate: false, // We check this later
            extractedAt: new Date().toISOString()
          }));
        } catch (err: any) {
          console.error(`Error processing ${file.name}:`, err);
          errors.push(`${file.name}: ${err.message || 'Unknown error'}`);
          return [];
        }
      });

      const results = await Promise.all(promises);
      
      // Flatten results
      results.forEach(batch => newLeadsAccumulator.push(...batch));

      if (newLeadsAccumulator.length === 0 && errors.length > 0) {
        throw new Error(`Failed to extract leads from uploaded files. Errors: ${errors.join(' | ')}`);
      } else if (newLeadsAccumulator.length === 0) {
        throw new Error("No valid leads found in the uploaded files.");
      }

      // --- Robust Duplicate Detection ---
      // We must detect duplicates within the NEW batch AND against OLD history.
      setLeads(prevLeads => {
        const existingPhones = new Set(prevLeads.map(l => l.phoneNumber));
        
        const processedBatch = newLeadsAccumulator.map(lead => {
          // Check if it exists in history OR if we've already seen it in this current batch processing
          if (existingPhones.has(lead.phoneNumber)) {
            return { ...lead, isDuplicate: true };
          } else {
            // Mark as seen so subsequent occurrences in this batch are marked duplicate
            existingPhones.add(lead.phoneNumber);
            return { ...lead, isDuplicate: false };
          }
        });

        return [...processedBatch, ...prevLeads];
      });

      setStatus(ProcessingStatus.SUCCESS);
      if (errors.length > 0) {
        setErrorMsg(`Processed with some errors: ${errors.join(', ')}`);
      }

    } catch (err: any) {
      console.error(err);
      setStatus(ProcessingStatus.ERROR);
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setTimeout(() => setStatus(ProcessingStatus.IDLE), 4000);
    }
  };

  // --- Handlers ---
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  // --- Export Logic ---
  const exportToExcel = () => {
    if (leads.length === 0) return;

    const exportData = leads.map(lead => ({
      "Full Name": lead.fullName,
      "Phone Number": lead.phoneNumber,
      "SMS Message": lead.outreachMessage,
      "Source File": lead.sourceFile,
      "Duplicate": lead.isDuplicate ? "Yes" : "No",
      "Extracted Date": new Date(lead.extractedAt).toLocaleDateString()
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cold Leads");

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Cold_Leads_${dateStr}.xlsx`);
  };

  return (
    <div className="min-h-screen p-6 md:p-12 relative">
       {/* Background Decoration */}
       <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-navy-800 to-navy-900 -z-10"></div>
       <div className="absolute -top-24 -right-24 w-96 h-96 bg-accent-cyan/10 rounded-full blur-3xl"></div>

      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-accent-cyan to-blue-600 rounded-lg shadow-lg shadow-accent-cyan/20">
                 <Sparkles className="w-6 h-6 text-navy-900" />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Cold Leads Inbox</h1>
            </div>
            <p className="text-slate-400 mt-2 text-sm ml-1">AI-Powered Driver Extraction & Outreach Compliance</p>
          </div>

          <div className="flex gap-4">
            <div className="glass px-4 py-2 rounded-lg flex flex-col items-center min-w-[100px]">
                <span className="text-xs text-slate-400 uppercase tracking-wide">Total</span>
                <span className="text-2xl font-bold text-white">{totalLeads}</span>
            </div>
             <div className="glass px-4 py-2 rounded-lg flex flex-col items-center min-w-[100px] border-l-4 border-l-emerald-500">
                <span className="text-xs text-slate-400 uppercase tracking-wide">New</span>
                <span className="text-2xl font-bold text-emerald-400">{newLeads}</span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 gap-8">
          
          {/* Campaign Config */}
          <div className="glass-card p-6 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-4 text-white font-medium">
                <Settings className="w-4 h-4 text-accent-cyan" />
                <h2>Campaign Settings (Optional)</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-slate-400 uppercase tracking-wide mb-2">Sender Name</label>
                    <input 
                        type="text" 
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        placeholder="e.g. Paul" 
                        className="w-full bg-navy-900/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-accent-cyan/50 transition-colors"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">If empty, messages will not have a sender name.</p>
                </div>
                <div>
                    <label className="block text-xs text-slate-400 uppercase tracking-wide mb-2">Company Name</label>
                    <input 
                        type="text" 
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g. TLG" 
                        className="w-full bg-navy-900/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-accent-cyan/50 transition-colors"
                    />
                     <p className="text-[10px] text-slate-500 mt-1">If empty, messages will not mention a company.</p>
                </div>
            </div>
          </div>

          {/* Upload Zone */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative group cursor-pointer transition-all duration-300 ease-out
              h-48 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center
              ${isDragActive 
                ? 'border-accent-cyan bg-accent-cyan/10 scale-[1.01]' 
                : 'border-slate-600 hover:border-slate-400 bg-navy-800/50'}
              ${status === ProcessingStatus.PROCESSING ? 'opacity-50 pointer-events-none' : ''}
            `}
          >
             <input 
                type="file" 
                multiple
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleInputChange}
                accept=".csv, .txt, image/png, image/jpeg, image/jpg"
                disabled={status === ProcessingStatus.PROCESSING}
             />
             
             {status === ProcessingStatus.PROCESSING ? (
               <div className="flex flex-col items-center animate-pulse">
                 <Loader2 className="w-10 h-10 text-accent-cyan animate-spin mb-4" />
                 <p className="text-accent-cyan font-medium">AI is analyzing files...</p>
                 <p className="text-xs text-slate-400 mt-2">Extracting leads & verifying uniqueness</p>
               </div>
             ) : (
               <>
                 <div className="p-4 bg-navy-900 rounded-full mb-4 shadow-xl ring-1 ring-white/10 group-hover:scale-110 transition-transform relative">
                    <Upload className="w-8 h-8 text-accent-cyan" />
                    <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-1 border border-navy-900">
                       <Layers className="w-3 h-3 text-white" />
                    </div>
                 </div>
                 <h3 className="text-lg font-medium text-white mb-1">Upload Driver Lists</h3>
                 <p className="text-slate-400 text-sm">Drag & drop up to 10 files (Images or CSV)</p>
               </>
             )}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5" />
                <span>{errorMsg}</span>
            </div>
          )}

          {/* Controls & Table */}
          <div className="space-y-4">
             <div className="flex justify-between items-end">
                <h2 className="text-xl font-semibold text-white">Extracted Leads</h2>
                
                {leads.length > 0 && (
                    <button 
                        onClick={exportToExcel}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg font-medium shadow-lg shadow-emerald-900/50 transition-all active:translate-y-0.5"
                    >
                        <FileSpreadsheet className="w-5 h-5" />
                        Export to Excel
                    </button>
                )}
             </div>

             <LeadTable leads={leads} />
          </div>

        </div>
      </div>
    </div>
  );
};

export default App;
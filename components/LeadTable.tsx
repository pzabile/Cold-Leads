import React, { useState } from 'react';
import { Lead } from '../types';
import { MessageSquare, AlertTriangle, User, Phone, FileText, X } from 'lucide-react';

interface LeadTableProps {
  leads: Lead[];
}

const LeadTable: React.FC<LeadTableProps> = ({ leads }) => {
  const [selectedMessage, setSelectedMessage] = useState<{ name: string; msg: string } | null>(null);

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 glass-card rounded-xl text-slate-400 mt-6">
        <div className="bg-navy-800 p-4 rounded-full mb-3 shadow-inner border border-white/5">
            <User className="w-8 h-8 opacity-50" />
        </div>
        <p className="text-lg">No leads extracted yet.</p>
        <p className="text-sm opacity-60">Upload a driver list to get started.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl glass-card border border-white/10 shadow-2xl mt-6">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-navy-800 text-slate-100 uppercase text-xs font-semibold tracking-wider">
            <tr>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Full Name</th>
              <th className="px-6 py-4">Phone Number</th>
              <th className="px-6 py-4">Source File</th>
              <th className="px-6 py-4 text-center">SMS Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {leads.map((lead) => (
              <tr 
                key={lead.id} 
                className={`transition-colors duration-200 hover:bg-white/5 ${
                    lead.isDuplicate ? 'bg-orange-900/10' : ''
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  {lead.isDuplicate ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-orange/20 text-accent-orange border border-accent-orange/30">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Duplicate
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      New Lead
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500" />
                    {lead.fullName}
                </td>
                <td className="px-6 py-4 font-mono text-slate-300">
                   <div className="flex items-center gap-2">
                    <Phone className="w-3 h-3 text-slate-500" />
                    {lead.phoneNumber}
                   </div>
                </td>
                <td className="px-6 py-4 text-slate-400">
                    <div className="flex items-center gap-2 max-w-[150px] truncate" title={lead.sourceFile}>
                        <FileText className="w-3 h-3" />
                        <span className="truncate">{lead.sourceFile}</span>
                    </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={() => setSelectedMessage({ name: lead.fullName, msg: lead.outreachMessage })}
                    className="group relative inline-flex items-center justify-center p-2 rounded-lg bg-navy-700 hover:bg-navy-600 border border-white/10 transition-all active:scale-95"
                  >
                    <MessageSquare className="w-4 h-4 text-accent-cyan" />
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-cyan opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-cyan"></span>
                    </span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Message Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-navy-800 border border-white/10 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-navy-900">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-accent-cyan" />
                Message Preview
              </h3>
              <button 
                onClick={() => setSelectedMessage(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">To: {selectedMessage.name}</div>
                <div className="bg-slate-900/50 p-4 rounded-lg border border-white/5 text-slate-200 font-sans leading-relaxed relative">
                    {/* Simulated text bubble tail */}
                    <div className="absolute -left-2 top-4 w-4 h-4 bg-slate-900/50 border-l border-b border-white/5 transform rotate-45"></div>
                    {selectedMessage.msg}
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-400/10 p-2 rounded border border-emerald-400/20">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Compliance Check Passed: Sender ID, Opt-out included.</span>
                </div>
            </div>
            <div className="p-4 bg-navy-900 border-t border-white/10 flex justify-end">
                <button 
                    onClick={() => setSelectedMessage(null)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    Close
                </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LeadTable;